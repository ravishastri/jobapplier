import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { query, initializeDatabase } from './db';
import { chromium } from 'playwright';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// Setup endpoint to initialize database
app.post('/api/setup', async (req: Request, res: Response) => {
  try {
    await initializeDatabase();
    res.json({ success: true, message: 'Database initialized successfully' });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ success: false, error: String(error) });
  }
});

// Goals
app.get('/api/goals', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT * FROM user_goals ORDER BY updated_at DESC LIMIT 1');
    res.json(result.rows[0] || {});
  } catch (error) {
    console.error('DB Error:', error);
    res.status(503).json({ error: 'Database unavailable. Please start PostgreSQL: npm run db:up' });
  }
});

app.post('/api/goals', async (req: Request, res: Response) => {
  try {
    const {
      min_salary,
      max_salary,
      required_tech_stack,
      avoid_tech_stack,
      preferred_roles,
      remote_preference,
      seniority_level,
    } = req.body;

    const result = await query(
      `INSERT INTO user_goals (min_salary, max_salary, required_tech_stack, avoid_tech_stack, preferred_roles, remote_preference, seniority_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [min_salary, max_salary, required_tech_stack, avoid_tech_stack, preferred_roles, remote_preference, seniority_level]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('DB Error:', error);
    res.status(503).json({ error: 'Database unavailable. Please start PostgreSQL: npm run db:up' });
  }
});

// Resumes
app.get('/api/resumes', async (req: Request, res: Response) => {
  try {
    const result = await query('SELECT id, version_name, is_active, created_at FROM resumes ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('DB Error:', error);
    res.status(503).json({ error: 'Database unavailable. Please start PostgreSQL: npm run db:up' });
  }
});

app.post('/api/resumes', async (req: Request, res: Response) => {
  try {
    const { version_name, content, is_active } = req.body;
    if (is_active) {
      await query('UPDATE resumes SET is_active = false');
    }
    const result = await query(
      `INSERT INTO resumes (version_name, content, is_active) VALUES ($1, $2, $3) RETURNING *`,
      [version_name, content, is_active || false]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('DB Error:', error);
    res.status(503).json({ error: 'Database unavailable. Please start PostgreSQL: npm run db:up' });
  }
});

// Manually add a job
app.post('/api/jobs/add', async (req: Request, res: Response) => {
  try {
    const { title, company, location, salary_min, salary_max, description, job_url } = req.body;

    if (!title || !company) {
      return res.status(400).json({ error: 'Title and company are required' });
    }

    const result = await query(
      `INSERT INTO job_postings (title, company, location, salary_min, salary_max, job_description, job_url, scraped_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       RETURNING id`,
      [title, company, location, salary_min || 0, salary_max || 0, description || '', job_url || '']
    );

    const jobId = result.rows[0].id;

    // Run quick analysis
    setImmediate(async () => {
      try {
        const analysis = await quickAnalyzeJob(jobId, 1);
        if (analysis) {
          await query(
            `UPDATE job_postings SET agent_decision = $1, agent_score = $2 WHERE id = $3`,
            [analysis.summary, analysis.fitScore, jobId]
          );
        }
      } catch (err) {
        console.error(`Error analyzing job ${jobId}:`, err);
      }
    });

    res.json({
      id: jobId,
      message: 'Job added successfully! Agent is analyzing it.',
      status: 'added'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to add job' });
  }
});

// Jobs
app.get('/api/jobs', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT jp.*,
              COUNT(CASE WHEN a.status = 'applied' THEN 1 END) as applied,
              COUNT(CASE WHEN a.status = 'rejected' THEN 1 END) as rejected
       FROM job_postings jp
       LEFT JOIN applications a ON jp.id = a.job_id
       GROUP BY jp.id
       ORDER BY jp.scraped_at DESC
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('DB Error:', error);
    res.status(503).json({ error: 'Database unavailable. Please start PostgreSQL: npm run db:up' });
  }
});

// Applications
app.get('/api/applications', async (req: Request, res: Response) => {
  try {
    const result = await query(
      `SELECT a.*, jp.title, jp.company, r.version_name
       FROM applications a
       LEFT JOIN job_postings jp ON a.job_id = jp.id
       LEFT JOIN resumes r ON a.resume_id = r.id
       ORDER BY a.created_at DESC
       LIMIT 100`
    );
    res.json(result.rows);
  } catch (error) {
    console.error('DB Error:', error);
    res.status(503).json({ error: 'Database unavailable. Please start PostgreSQL: npm run db:up' });
  }
});

app.get('/api/applications/stats', async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'applied' THEN 1 END) as applied,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
        COUNT(CASE WHEN status = 'interview' THEN 1 END) as interviews,
        COUNT(CASE WHEN status = 'offer' THEN 1 END) as offers
      FROM applications
    `);
    res.json(result.rows[0]);
  } catch (error) {
    console.error('DB Error:', error);
    res.status(503).json({ error: 'Database unavailable. Please start PostgreSQL: npm run db:up' });
  }
});

// Real LinkedIn scraper
async function scrapeLinkedInJobs(searchQuery: string = 'Field Development Engineer AI', location: string = 'New York') {
  let browser;
  try {
    console.log('🔍 Starting LinkedIn scraper...');
    browser = await chromium.launch({ headless: false }); // Non-headless so user can log in
    const page = await browser.newPage();

    // Navigate to LinkedIn jobs
    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(searchQuery)}&location=${encodeURIComponent(location)}`;
    console.log(`📍 Navigating to: ${searchUrl}`);

    try {
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (err) {
      console.log('⚠️ Navigation took long, continuing anyway...');
    }

    // Wait for user to log in if needed
    console.log('⏳ Waiting for login (if needed)...');
    try {
      await page.waitForSelector('[data-job-id]', { timeout: 90000 });
    } catch {
      console.log('⚠️ Job listings not found. Please log in to LinkedIn in the browser window.');
      await page.waitForSelector('[data-job-id]', { timeout: 180000 });
    }

    console.log('✅ Login successful, scraping jobs...');

    // Scroll to load more jobs
    try {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight * 3);
      });
      await page.waitForTimeout(3000);
    } catch (err) {
      console.log('⚠️ Scroll error, continuing...');
    }

    // Extract job listings
    const jobs: any[] = await page.evaluate(() => {
      const jobElements = document.querySelectorAll('[data-job-id]');
      const scrapedJobs: any[] = [];

      jobElements.forEach((el: Element) => {
        const jobId = el.getAttribute('data-job-id');
        const titleEl = el.querySelector('.base-search-card__title');
        const companyEl = el.querySelector('.base-search-card__company-name');
        const locationEl = el.querySelector('.job-search-card__location');
        const linkEl = el.querySelector('a.base-card__full-link') as HTMLAnchorElement;

        if (titleEl && companyEl) {
          scrapedJobs.push({
            linkedin_id: jobId,
            title: titleEl.textContent?.trim() || '',
            company: companyEl.textContent?.trim() || '',
            location: locationEl?.textContent?.trim() || 'Remote',
            url: linkEl?.href || '',
            description: el.textContent?.substring(0, 500) || ''
          });
        }
      });

      return scrapedJobs;
    });

    console.log(`📊 Found ${jobs.length} jobs`);

    // Store in database
    let insertedCount = 0;
    for (const job of jobs) {
      try {
        await query(
          `INSERT INTO job_postings (linkedin_id, title, company, location, job_url, job_description, scraped_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (linkedin_id) DO NOTHING
           RETURNING id`,
          [job.linkedin_id, job.title, job.company, job.location, job.url, job.description]
        );
        insertedCount++;
      } catch (err) {
        console.error(`Error inserting job ${job.linkedin_id}:`, err);
      }
    }

    await browser.close();

    return { success: true, jobsScraped: jobs.length, jobsInserted: insertedCount };
  } catch (error) {
    console.error('❌ LinkedIn scraper error:', error);
    if (browser) await browser.close();
    throw error;
  }
}

// Quick fit analysis for a single job
async function quickAnalyzeJob(jobId: number, resumeId: number) {
  try {
    const jobResult = await query('SELECT * FROM job_postings WHERE id = $1', [jobId]);
    const resumeResult = await query('SELECT * FROM resumes WHERE id = $1', [resumeId]);
    const goalsResult = await query('SELECT * FROM user_goals ORDER BY updated_at DESC LIMIT 1');

    if (jobResult.rows.length === 0 || resumeResult.rows.length === 0) return null;

    const job = jobResult.rows[0];
    const resume = resumeResult.rows[0];
    const goals = goalsResult.rows[0] || {};

    const Anthropic = await import('@anthropic-ai/sdk');
    const client = new Anthropic.default();

    const quickPrompt = `Quick analysis - respond ONLY with valid JSON (no markdown, no explanation):

Job: ${job.title} at ${job.company}
Salary: $${job.salary_min}-$${job.salary_max}
Location: ${job.location}

User goals: $${goals.min_salary}-$${goals.max_salary}, ${goals.seniority_level}, Remote: ${goals.remote_preference}

Respond with ONLY this JSON (no other text):
{
  "fitScore": <0-100>,
  "summary": "<1-2 sentence summary of fit>"
}`;

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 150,
      messages: [{ role: 'user', content: quickPrompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return jsonMatch ? JSON.parse(jsonMatch[0]) : { fitScore: 50, summary: 'Unable to analyze' };
    } catch {
      return { fitScore: 50, summary: 'Unable to analyze' };
    }
  } catch (error) {
    console.error('Error in quick analyze:', error);
    return null;
  }
}

// Scrape trigger (manual) - Real LinkedIn scraping
app.post('/api/scrape', async (req: Request, res: Response) => {
  try {
    const { searchQuery = 'Field Development Engineer AI', location = 'New York' } = req.body || {};

    // Run scraper asynchronously and return immediately
    scrapeLinkedInJobs(searchQuery, location)
      .then(async (result) => {
        console.log('✅ Scraping complete:', result);
        // Run quick analysis on newly scraped jobs in background
        const jobsResult = await query(
          `SELECT id FROM job_postings WHERE scraped_at > NOW() - INTERVAL '5 minutes' ORDER BY id DESC LIMIT $1`,
          [result.jobsInserted]
        );

        for (const job of jobsResult.rows) {
          setImmediate(async () => {
            try {
              const analysis = await quickAnalyzeJob(job.id, 1);
              if (analysis) {
                await query(
                  `UPDATE job_postings SET agent_decision = $1, agent_score = $2 WHERE id = $3`,
                  [analysis.summary, analysis.fitScore, job.id]
                );
              }
            } catch (err) {
              console.error(`Error analyzing job ${job.id}:`, err);
            }
          });
        }
      })
      .catch((err) => console.error('❌ Scraping failed:', err));

    res.json({
      message: 'LinkedIn scraping started. Browser will open - please log in if needed.',
      status: 'scraping'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to start scraping' });
  }
});

// Fallback: test jobs if needed
app.post('/api/scrape/test', async (req: Request, res: Response) => {
  try {
    const testJobs = [
      { title: 'Senior AI Field Development Engineer', company: 'OpenAI', location: 'San Francisco, CA', salary_min: 250000, salary_max: 350000, description: 'Work directly with Fortune 500 customers to deploy production AI systems. Deep technical expertise in LLMs, prompt engineering, and agent architecture.', url: 'https://openai.com/careers/senior-ai-fde' },
      { title: 'AI Solutions Architect (FSI)', company: 'AWS', location: 'New York, NY', salary_min: 240000, salary_max: 320000, description: 'Lead AI/ML solution architecture for financial services clients. Work with C-suite executives. AWS Bedrock, SageMaker expertise.', url: 'https://aws.amazon.com/careers/ai-solutions-architect-fsi' },
      { title: 'Principal Agentic AI Engineer', company: 'Databricks', location: 'Remote', salary_min: 280000, salary_max: 380000, description: 'Build multi-agent systems and RAG pipelines for enterprise customers. Leadership of technical implementations.', url: 'https://databricks.com/careers/principal-agentic-ai' },
      { title: 'Senior FDE - Enterprise AI', company: 'Anthropic', location: 'Remote, San Francisco', salary_min: 260000, salary_max: 340000, description: 'Deploy Claude to enterprise customers in regulated industries. Work with executive teams. Own technical strategy and customer success.', url: 'https://anthropic.com/careers/senior-fde-enterprise' },
      { title: 'AI Strategy Consultant', company: 'McKinsey', location: 'New York, NY', salary_min: 220000, salary_max: 300000, description: 'Advise Fortune 500 CIOs on AI/data transformation strategy. Lead technical due diligence. Executive presentations.', url: 'https://mckinsey.com/careers/ai-strategy-consultant' },
      { title: 'Field Development Engineer - AI Platform', company: 'Google Cloud', location: 'New York, NY', salary_min: 245000, salary_max: 315000, description: 'Help enterprise customers build and deploy AI solutions on Google Cloud. Vertex AI, LangChain integration expertise.', url: 'https://careers.google.com/jobs/fde-ai-platform' },
      { title: 'Senior Solutions Engineer (AI/ML)', company: 'Microsoft Azure', location: 'Boston, MA', salary_min: 235000, salary_max: 305000, description: 'Drive AI adoption at Fortune 1000 companies. Azure OpenAI, Copilot expertise. Customer advisory board participation.', url: 'https://careers.microsoft.com/jobs/senior-solutions-engineer-ai' },
      { title: 'AI Deployment Lead', company: 'Meta', location: 'Menlo Park, CA', salary_min: 255000, salary_max: 335000, description: 'Lead AI deployment for enterprise customers. LLaMA, llm.css expertise. Work with global clients.', url: 'https://careers.meta.com/jobs/ai-deployment-lead' },
      { title: 'Enterprise AI Engineer', company: 'IBM', location: 'Remote', salary_min: 230000, salary_max: 310000, description: 'Build enterprise AI solutions. Watson, enterprise LLM deployment. Customer-facing technical leadership.', url: 'https://careers.ibm.com/jobs/enterprise-ai-engineer' },
      { title: 'AI Solutions Manager', company: 'Salesforce', location: 'San Francisco, CA', salary_min: 240000, salary_max: 320000, description: 'Manage AI solution implementations for Fortune 500 accounts. Einstein AI expertise. Executive stakeholder management.', url: 'https://careers.salesforce.com/jobs/ai-solutions-manager' },
      { title: 'Senior FDE - Financial Services', company: 'JPMorgan Chase', location: 'New York, NY', salary_min: 270000, salary_max: 360000, description: 'Deploy AI systems for financial services. Regulatory compliance expertise. Work with C-suite executives.', url: 'https://careers.jpmorgan.com/jobs/senior-fde-ai' },
      { title: 'AI Customer Success Lead', company: 'Stripe', location: 'San Francisco, CA', salary_min: 235000, salary_max: 315000, description: 'Help global customers integrate AI into payment workflows. LLM API integration expertise.', url: 'https://careers.stripe.com/jobs/ai-success-lead' },
      { title: 'Field Solutions Engineer', company: 'Hugging Face', location: 'Remote', salary_min: 240000, salary_max: 330000, description: 'Work with enterprise customers on transformers and LLM deployment. Open-source expertise required.', url: 'https://careers.huggingface.co/jobs/field-solutions-engineer' },
      { title: 'Senior Solutions Architect (LLM)', company: 'Cohere', location: 'Remote', salary_min: 250000, salary_max: 340000, description: 'Help enterprise deploy Cohere LLMs. RAG pipeline architecture expertise. Customer advisory.', url: 'https://careers.cohere.com/jobs/senior-solutions-architect' },
      { title: 'Enterprise AI Lead', company: 'LinkedIn', location: 'Sunnyvale, CA', salary_min: 245000, salary_max: 325000, description: 'Lead AI initiatives for enterprise customers. Data strategy and implementation. Executive presentations.', url: 'https://careers.linkedin.com/jobs/enterprise-ai-lead' },
      { title: 'AI Solutions Consultant', company: 'Deloitte', location: 'New York, NY', salary_min: 225000, salary_max: 295000, description: 'Consult Fortune 500 on AI transformation. Strategy and implementation. Client relationship management.', url: 'https://careers.deloitte.com/jobs/ai-solutions-consultant' },
      { title: 'Technical FDE - AI/ML', company: 'Accenture', location: 'Remote', salary_min: 230000, salary_max: 310000, description: 'Support enterprise AI implementations. LLM and ML ops expertise. Global customer base.', url: 'https://careers.accenture.com/jobs/technical-fde-ai' },
      { title: 'Senior AI Architect', company: 'Capital One', location: 'Richmond, VA', salary_min: 240000, salary_max: 320000, description: 'Design AI solutions for banking. Regulatory compliance and security expertise. Executive stakeholder management.', url: 'https://careers.capitalone.com/jobs/senior-ai-architect' },
      { title: 'Field Engineer - Generative AI', company: 'Nvidia', location: 'Santa Clara, CA', salary_min: 260000, salary_max: 350000, description: 'Help customers deploy generative AI on Nvidia infrastructure. CUDA and optimization expertise.', url: 'https://careers.nvidia.com/jobs/field-engineer-gen-ai' },
      { title: 'Solutions Engineer (AI Platform)', company: 'HashiCorp', location: 'Remote', salary_min: 235000, salary_max: 315000, description: 'Support enterprise AI infrastructure deployment. Terraform and cloud expertise. Customer advisory.', url: 'https://careers.hashicorp.com/jobs/solutions-engineer-ai' },
      { title: 'AI Enterprise Strategist', company: 'Bain & Company', location: 'Boston, MA', salary_min: 220000, salary_max: 300000, description: 'Advise C-suite on AI strategy. Digital transformation and organizational change expertise.', url: 'https://careers.bain.com/jobs/ai-enterprise-strategist' },
      { title: 'Senior FDE - Retail & CPG', company: 'Mastercard', location: 'Purchase, NY', salary_min: 245000, salary_max: 325000, description: 'Deploy AI for retail and CPG customers. Transaction analytics and fraud detection expertise.', url: 'https://careers.mastercard.com/jobs/senior-fde-retail' },
      { title: 'Generative AI Solutions Lead', company: 'Cisco', location: 'Remote', salary_min: 240000, salary_max: 320000, description: 'Lead AI solution implementation for enterprise customers. Network security and AI integration.', url: 'https://careers.cisco.com/jobs/gen-ai-solutions-lead' },
      { title: 'AI Customer Engineer', company: 'Figma', location: 'San Francisco, CA', salary_min: 235000, salary_max: 315000, description: 'Help enterprise design teams leverage AI. Design tools and AI integration expertise.', url: 'https://careers.figma.com/jobs/ai-customer-engineer' },
      { title: 'Field Development Engineer - AI', company: 'Workday', location: 'Pleasanton, CA', salary_min: 245000, salary_max: 325000, description: 'Deploy AI for enterprise HR and finance. CRM and enterprise software expertise.', url: 'https://careers.workday.com/jobs/fde-ai' },
      { title: 'Solutions Architect (Enterprise AI)', company: 'Zoom', location: 'San Jose, CA', salary_min: 240000, salary_max: 320000, description: 'Implement AI features for enterprise customers. Communications infrastructure expertise.', url: 'https://careers.zoom.com/jobs/solutions-architect-ai' },
      { title: 'Senior FDE - Healthcare AI', company: 'UnitedHealth', location: 'Minnetonka, MN', salary_min: 250000, salary_max: 330000, description: 'Deploy AI for healthcare providers. HIPAA compliance and healthcare domain expertise.', url: 'https://careers.unitedhealthgroup.com/jobs/senior-fde-healthcare' },
      { title: 'AI Solutions Engineer', company: 'Palantir', location: 'Remote', salary_min: 260000, salary_max: 360000, description: 'Implement Palantir AI solutions for government and enterprise. Data integration and analytics.', url: 'https://careers.palantir.com/jobs/ai-solutions-engineer' },
      { title: 'Field AI Engineer', company: 'ServiceNow', location: 'San Diego, CA', salary_min: 235000, salary_max: 315000, description: 'Help enterprises automate workflows with Now Platform AI. Enterprise software expertise.', url: 'https://careers.servicenow.com/jobs/field-ai-engineer' },
      { title: 'Enterprise Solutions Manager', company: 'Notion', location: 'Remote', salary_min: 230000, salary_max: 310000, description: 'Support enterprise AI adoption. Product expertise and customer success leadership.', url: 'https://careers.notion.com/jobs/enterprise-solutions-manager' },
      { title: 'AI Deployment Engineer', company: 'Snap', location: 'Los Angeles, CA', salary_min: 235000, salary_max: 315000, description: 'Deploy Snap AI capabilities for business customers. AR/ML and mobile expertise.', url: 'https://careers.snap.com/jobs/ai-deployment-engineer' },
      { title: 'Senior FDE - Enterprise SaaS', company: 'Zendesk', location: 'San Francisco, CA', salary_min: 240000, salary_max: 320000, description: 'Drive AI integration for enterprise customers. SaaS and CRM expertise. Executive advisory.', url: 'https://careers.zendesk.com/jobs/senior-fde-saas' },
      { title: 'Solutions Engineer - AI/ML', company: 'Twilio', location: 'Remote', salary_min: 235000, salary_max: 315000, description: 'Help customers integrate AI into communications. APIs and cloud infrastructure expertise.', url: 'https://careers.twilio.com/jobs/solutions-engineer-ai' },
      { title: 'AI Business Solutions Architect', company: 'Oracle', location: 'Remote', salary_min: 245000, salary_max: 325000, description: 'Deploy Oracle AI for enterprise customers. Database and enterprise software expertise.', url: 'https://careers.oracle.com/jobs/ai-solutions-architect' },
      { title: 'Field Development Engineer', company: 'Canva', location: 'Remote', salary_min: 230000, salary_max: 310000, description: 'Support enterprise design automation with AI. Product expertise and customer success.', url: 'https://careers.canva.com/jobs/field-development-engineer' },
      { title: 'Senior Solutions Architect - AI', company: 'Booking.com', location: 'Amsterdam, Netherlands', salary_min: 240000, salary_max: 320000, description: 'Build AI solutions for travel industry. Machine learning and travel tech expertise.', url: 'https://careers.booking.com/jobs/solutions-architect-ai' },
      { title: 'AI Solutions Lead', company: 'Square', location: 'San Francisco, CA', salary_min: 235000, salary_max: 315000, description: 'Drive AI adoption for SMB and enterprise customers. Payments and commerce expertise.', url: 'https://careers.square.com/jobs/ai-solutions-lead' },
      { title: 'Enterprise FDE (AI)', company: 'Uber', location: 'San Francisco, CA', salary_min: 250000, salary_max: 340000, description: 'Deploy AI for marketplace optimization. Logistics and ML expertise. Executive engagement.', url: 'https://careers.uber.com/jobs/enterprise-fde-ai' },
      { title: 'Technical Consultant - AI', company: 'Capgemini', location: 'New York, NY', salary_min: 225000, salary_max: 305000, description: 'Consult on AI transformation. Strategic advisory and implementation. Global accounts.', url: 'https://careers.capgemini.com/jobs/technical-consultant-ai' },
      { title: 'Solutions Engineer - Large Enterprise', company: 'Vercel', location: 'Remote', salary_min: 240000, salary_max: 320000, description: 'Support enterprise AI and ML deployments on Vercel. Edge computing and frameworks expertise.', url: 'https://careers.vercel.com/jobs/solutions-engineer-enterprise' },
      { title: 'AI Enterprise Architect', company: 'BlackRock', location: 'New York, NY', salary_min: 260000, salary_max: 360000, description: 'Design AI solutions for financial services. Risk management and compliance expertise.', url: 'https://careers.blackrock.com/jobs/ai-enterprise-architect' },
      { title: 'Senior Solutions Consultant', company: 'Epsilon', location: 'Plano, TX', salary_min: 235000, salary_max: 315000, description: 'Help marketers deploy AI solutions. Marketing tech and data expertise.', url: 'https://careers.epsilon.com/jobs/senior-solutions-consultant' },
      { title: 'Field Engineer - AI Platform', company: 'Dell Technologies', location: 'Remote', salary_min: 240000, salary_max: 320000, description: 'Support enterprise AI infrastructure. Systems and infrastructure expertise.', url: 'https://careers.dell.com/jobs/field-engineer-ai-platform' },
      { title: 'Enterprise Solutions Architect', company: 'Shopify', location: 'Toronto, Canada', salary_min: 235000, salary_max: 315000, description: 'Drive AI adoption for merchant platform. E-commerce and marketplace expertise.', url: 'https://careers.shopify.com/jobs/enterprise-solutions-architect' },
      { title: 'AI Technical Lead', company: 'Goldman Sachs', location: 'New York, NY', salary_min: 270000, salary_max: 370000, description: 'Lead AI initiatives for financial services clients. Trading, risk, and compliance expertise.', url: 'https://careers.gs.com/jobs/ai-technical-lead' },
      { title: 'Solutions Engineer - AI/Data', company: 'Elastic', location: 'Remote', salary_min: 235000, salary_max: 315000, description: 'Help enterprises leverage AI with Elastic Search. Data analytics and search expertise.', url: 'https://careers.elastic.co/jobs/solutions-engineer-ai' },
      { title: 'Field Development Manager', company: 'Everbridge', location: 'Boston, MA', salary_min: 230000, salary_max: 310000, description: 'Manage critical event management and AI adoption. Enterprise software expertise.', url: 'https://careers.everbridge.com/jobs/field-development-manager' },
      { title: 'Senior Enterprise Architect - AI', company: 'Bank of America', location: 'Charlotte, NC', salary_min: 260000, salary_max: 360000, description: 'Design AI architecture for banking. Regulatory compliance and large-scale systems expertise.', url: 'https://careers.bofa.com/jobs/senior-enterprise-architect-ai' },
      { title: 'AI Solutions Manager', company: 'HubSpot', location: 'Remote', salary_min: 240000, salary_max: 320000, description: 'Support enterprise CRM AI adoption. Sales and marketing automation expertise.', url: 'https://careers.hubspot.com/jobs/ai-solutions-manager' },
    ];

    let insertedCount = 0;
    const insertedJobIds: number[] = [];

    for (const job of testJobs) {
      const result = await query(
        `INSERT INTO job_postings (title, company, location, salary_min, salary_max, job_description, job_url, scraped_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         ON CONFLICT (linkedin_id) DO NOTHING
         RETURNING id`,
        [job.title, job.company, job.location, job.salary_min, job.salary_max, job.description, job.url]
      );
      if (result.rows.length > 0) {
        insertedJobIds.push(result.rows[0].id);
        insertedCount++;
      }
    }

    // Run quick analysis on all inserted jobs (non-blocking)
    if (insertedJobIds.length > 0) {
      setImmediate(async () => {
        for (const jobId of insertedJobIds) {
          try {
            const analysis = await quickAnalyzeJob(jobId, 1);
            if (analysis) {
              await query(
                `UPDATE job_postings SET agent_decision = $1, agent_score = $2 WHERE id = $3`,
                [analysis.summary, analysis.fitScore, jobId]
              );
            }
          } catch (err) {
            console.error(`Error analyzing job ${jobId}:`, err);
          }
        }
      });
    }

    res.json({ message: 'Scrape complete', jobs_added: insertedCount, analyzing: true });
  } catch (error) {
    console.error('DB Error:', error);
    res.status(503).json({ error: 'Database unavailable. Please start PostgreSQL: npm run db:up' });
  }
});

// Smart Application with Agent Analysis
app.post('/api/applications/create', async (req: Request, res: Response) => {
  try {
    const { jobId, resumeId } = req.body;

    // Fetch job, resume, and goals
    const jobResult = await query('SELECT * FROM job_postings WHERE id = $1', [jobId]);
    const resumeResult = await query('SELECT * FROM resumes WHERE id = $1', [resumeId]);
    const goalsResult = await query('SELECT * FROM user_goals ORDER BY updated_at DESC LIMIT 1');

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }
    if (resumeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    const job = jobResult.rows[0];
    const resume = resumeResult.rows[0];
    const goals = goalsResult.rows[0] || {};

    // Call Claude agent to analyze job and suggest/fill application
    const Anthropic = await import('@anthropic-ai/sdk');
    const client = new Anthropic.default();

    const agentPrompt = `You are an expert job application agent. Your job is to help fill out job applications intelligently.

CANDIDATE PROFILE:
Name: Ravi Shastri
Email: ravi_shastri@outlook.com
Resume: ${resume.content}

CANDIDATE GOALS:
- Salary Range: $${goals.min_salary} - $${goals.max_salary}
- Desired Tech: ${goals.required_tech_stack?.join(', ') || 'Not specified'}
- Remote Preference: ${goals.remote_preference || 'Any'}
- Seniority Level: ${goals.seniority_level || 'Not specified'}

JOB POSTING:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Salary: ${job.salary_min ? '$' + job.salary_min + ' - $' + job.salary_max : 'Not specified'}
Description: ${job.job_description || 'Not provided'}

TASK:
1. Analyze how well this job matches the candidate's goals and profile
2. Extract key requirements and qualifications from the job description
3. Map candidate's experience to job requirements
4. Provide suggested answers for common application questions:
   - Why are you interested in this role?
   - What makes you a good fit?
   - Why do you want to work here?
5. Identify any gaps or concerns
6. Provide a fit score (0-100)

Please provide:
- Overall fit score (0-100)
- Key matching points (3-5 bullet points)
- Suggested answers for the questions above
- Any concerns or gaps to address
- Final recommendation (APPLY / MAYBE / SKIP)`;

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: agentPrompt }],
    });

    const analysis = response.content[0].type === 'text' ? response.content[0].text : '';

    // Create application record
    const appResult = await query(
      `INSERT INTO applications (job_id, resume_id, status, applied_at, agent_score, agent_decision)
       VALUES ($1, $2, 'pending', NOW(), 75, $3)
       RETURNING id`,
      [jobId, resumeId, analysis.substring(0, 500)]
    );

    res.json({
      applicationId: appResult.rows[0].id,
      jobTitle: job.title,
      company: job.company,
      agentAnalysis: analysis,
      status: 'ready_to_apply',
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to process application' });
  }
});

// Generate tailored resume and answers from job details
app.post('/api/applications/generate-from-details', async (req: Request, res: Response) => {
  try {
    const { resumeId, jobDescription, applicationQuestions } = req.body;

    const resumeResult = await query('SELECT * FROM resumes WHERE id = $1', [resumeId]);
    if (resumeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Resume not found' });
    }

    const resume = resumeResult.rows[0];
    const Anthropic = await import('@anthropic-ai/sdk');
    const client = new Anthropic.default();

    // First: Generate tailored resume
    const resumePrompt = `You are an expert resume writer. Tailor this resume to highlight experience relevant to this job description.

ORIGINAL RESUME:
${resume.content}

JOB DESCRIPTION:
${jobDescription}

INSTRUCTIONS:
- Keep the exact same format and structure
- Rewrite bullet points in the Experience section to emphasize relevant skills
- Highlight achievements that match job requirements
- Make it compelling and specific to this job

OUTPUT ONLY THE TAILORED RESUME, NO EXPLANATIONS.`;

    const resumeResponse = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: resumePrompt }],
    });

    const tailoredResume = resumeResponse.content[0].type === 'text' ? resumeResponse.content[0].text : '';

    // Second: Generate answers to questions
    const answersPrompt = `You are an expert career coach. Generate specific answers to these job application questions based on the candidate's resume and the job description.

CANDIDATE RESUME:
${resume.content}

JOB DESCRIPTION:
${jobDescription}

APPLICATION QUESTIONS:
${applicationQuestions}

INSTRUCTIONS:
- Answer each question specifically and authentically
- Reference relevant experience from the resume
- Make answers 2-3 sentences each
- Be compelling and professional

FORMAT:
For each question provided, give the answer. Start each with "Q: " followed by the question, then "A: " followed by your answer.`;

    const answersResponse = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: answersPrompt }],
    });

    const answers = answersResponse.content[0].type === 'text' ? answersResponse.content[0].text : '';

    res.json({
      tailoredResume,
      answers
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to generate content' });
  }
});

// Generate proposed answers for application form
app.post('/api/applications/generate-answers', async (req: Request, res: Response) => {
  try {
    const { jobId, resumeId } = req.body;

    const jobResult = await query('SELECT * FROM job_postings WHERE id = $1', [jobId]);
    const resumeResult = await query('SELECT * FROM resumes WHERE id = $1', [resumeId]);
    const goalsResult = await query('SELECT * FROM user_goals ORDER BY updated_at DESC LIMIT 1');

    // Fetch past feedback to learn from corrections
    const feedbackResult = await query(`
      SELECT field_name, user_feedback, COUNT(*) as frequency
      FROM agent_feedback
      WHERE user_feedback IS NOT NULL AND user_feedback != ''
      GROUP BY field_name, user_feedback
      ORDER BY frequency DESC
      LIMIT 10
    `);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobResult.rows[0];
    const resume = resumeResult.rows[0];
    const goals = goalsResult.rows[0] || {};

    // Build learning context from past feedback
    const learningContext = feedbackResult.rows.length > 0
      ? `\n\nLEARNED PREFERENCES FROM PAST APPLICATIONS:\n${
          feedbackResult.rows
            .map(row => `- For "${row.field_name}": User often adjusts for "${row.user_feedback}"`)
            .join('\n')
        }\n\nApply these insights to make answers more aligned with user preferences.`
      : '';

    const Anthropic = await import('@anthropic-ai/sdk');
    const client = new Anthropic.default();

    const answerPrompt = `You are an expert job application writer who learns from user feedback.

CANDIDATE PROFILE:
${resume.content}

CANDIDATE GOALS:
- Salary: $${goals.min_salary} - $${goals.max_salary}
- Seniority: ${goals.seniority_level}
- Tech Stack: ${goals.required_tech_stack?.join(', ') || 'Not specified'}

JOB:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description: ${job.job_description}
${learningContext}

Generate 4 specific, compelling answers (2-3 sentences each) that:
1. Are authentic and based on real experience
2. Highlight both technical depth AND leadership/customer-facing experience
3. Show strategic thinking, not just execution
4. Address business impact and ROI where relevant
5. Demonstrate industry expertise (FSI/Retail if applicable)

Questions:
1. "How do you fit for this role?" - Focus on direct skill alignment + unique value
2. "Why are you interested in this role?" - Genuine interest + growth opportunity
3. "Why do you think you're a good fit?" - Relevant experience + leadership credentials
4. "Why do you want to work at ${job.company}?" - Company-specific insights + alignment

Format your response ONLY as JSON (no markdown, no explanation):
{
  "fitDescription": "answer 1",
  "whyInterested": "answer 2",
  "whyGoodFit": "answer 3",
  "whyCompany": "answer 4"
}`;

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 800,
      messages: [{ role: 'user', content: answerPrompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';

    // Extract JSON from response (Claude may add markdown formatting)
    let proposedAnswers;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      proposedAnswers = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        fitDescription: '',
        whyInterested: '',
        whyGoodFit: '',
        whyCompany: ''
      };
    } catch {
      proposedAnswers = {
        fitDescription: text,
        whyInterested: '',
        whyGoodFit: '',
        whyCompany: ''
      };
    }

    res.json({ proposedAnswers });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to generate answers' });
  }
});

// Tailor resume for a specific job
app.post('/api/resume/tailor', async (req: Request, res: Response) => {
  try {
    const { jobId, resumeId } = req.body;

    const jobResult = await query('SELECT * FROM job_postings WHERE id = $1', [jobId]);
    const resumeResult = await query('SELECT * FROM resumes WHERE id = $1', [resumeId]);

    if (jobResult.rows.length === 0 || resumeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job or resume not found' });
    }

    const job = jobResult.rows[0];
    const originalResume = resumeResult.rows[0].content;

    const Anthropic = await import('@anthropic-ai/sdk');
    const client = new Anthropic.default();

    const tailorPrompt = `You are an expert resume writer. Tailor the provided resume for a specific job while KEEPING THE EXACT SAME FORMATTING AND STRUCTURE.

ORIGINAL RESUME:
${originalResume}

TARGET JOB:
Title: ${job.title}
Company: ${job.company}
Description: ${job.job_description}
Salary: $${job.salary_min}-$${job.salary_max}

INSTRUCTIONS:
1. Keep ALL section headers, bullet structure, and formatting exactly the same
2. Regenerate only the EXPERIENCE and SKILLS sections to highlight job-relevant achievements
3. Emphasize skills and experiences that match this specific role
4. Keep all contact info, education, and awards exactly as-is
5. Do NOT add new sections or change the overall structure
6. Preserve the exact same line breaks, spacing, and bullet point style
7. Output ONLY the tailored resume text, no markdown, no explanations

Generate the tailored resume:`;

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: tailorPrompt }],
    });

    const tailoredResume = response.content[0].type === 'text' ? response.content[0].text : '';

    res.json({
      originalResume,
      tailoredResume,
      jobTitle: job.title,
      company: job.company
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to tailor resume' });
  }
});

// Submit application with confirmed answers
app.post('/api/applications/submit', async (req: Request, res: Response) => {
  try {
    const { jobId, resumeId, answers, feedback, originalAnswers } = req.body;

    const appResult = await query(
      `INSERT INTO applications (job_id, resume_id, status, applied_at, agent_decision)
       VALUES ($1, $2, 'applied', NOW(), $3)
       RETURNING id`,
      [jobId, resumeId, JSON.stringify(answers)]
    );

    const applicationId = appResult.rows[0].id;

    // Store feedback for learning
    const fields = ['fitDescription', 'whyInterested', 'whyGoodFit', 'whyCompany'];
    for (const field of fields) {
      const original = originalAnswers?.[field] || '';
      const corrected = answers?.[field] || '';
      const userFeedback = feedback?.[field] || '';

      // Only store if there was a change or feedback
      if (original !== corrected || userFeedback) {
        await query(
          `INSERT INTO agent_feedback (application_id, field_name, original_answer, corrected_answer, user_feedback)
           VALUES ($1, $2, $3, $4, $5)`,
          [applicationId, field, original, corrected, userFeedback]
        );
      }
    }

    res.json({
      applicationId,
      status: 'applied',
      message: 'Application submitted! Agent learned from your feedback.'
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Serve frontend static files in production
if (process.env.NODE_ENV === 'production') {
  const frontendPath = path.join(process.cwd(), 'dist/frontend');
  app.use(express.static(frontendPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
