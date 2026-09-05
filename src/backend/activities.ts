import { chromium } from 'playwright';
import Anthropic from '@anthropic-ai/sdk';
import { query } from './db';

const client = new Anthropic();

export async function scrapeLinkedInJobsActivity(): Promise<{ jobsScraped: number; success: boolean }> {
  try {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    console.log('Navigating to LinkedIn jobs...');
    await page.goto('https://www.linkedin.com/jobs/search/?keywords=software%20engineer', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    // Wait for login if needed
    const loginButton = page.locator('text=Sign in');
    if (await loginButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      console.log('LinkedIn login required. Please sign in in the browser window.');
      await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 300000 });
    }

    // Extract job postings
    const jobCards = page.locator('[data-job-id]');
    const count = await jobCards.count();
    console.log(`Found ${count} job cards`);

    const jobs = [];
    for (let i = 0; i < Math.min(count, 10); i++) {
      const card = jobCards.nth(i);
      const jobId = await card.getAttribute('data-job-id');
      const title = await card.locator('.base-search-card__title').textContent();
      const company = await card.locator('.base-search-card__subtitle').textContent();
      const location = await card.locator('.job-search-card__location').textContent();

      if (jobId && title && company) {
        jobs.push({
          linkedin_id: jobId,
          title: title.trim(),
          company: company.trim(),
          location: location?.trim() || '',
          job_url: `https://www.linkedin.com/jobs/view/${jobId}`,
        });
      }
    }

    // Save to database
    for (const job of jobs) {
      await query(
        `INSERT INTO job_postings (linkedin_id, title, company, location, job_url, scraped_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (linkedin_id) DO NOTHING`,
        [job.linkedin_id, job.title, job.company, job.location, job.job_url]
      );
    }

    await browser.close();
    return { jobsScraped: jobs.length, success: true };
  } catch (error) {
    console.error('Scraping error:', error);
    return { jobsScraped: 0, success: false };
  }
}

export async function evaluateJobFitActivity(jobId: number): Promise<{
  jobId: number;
  score: number;
  decision: 'apply' | 'skip';
  reasoning: string;
}> {
  try {
    // Get job posting
    const jobResult = await query('SELECT * FROM job_postings WHERE id = $1', [jobId]);
    if (jobResult.rows.length === 0) {
      throw new Error(`Job ${jobId} not found`);
    }
    const job = jobResult.rows[0];

    // Get user goals
    const goalsResult = await query('SELECT * FROM user_goals ORDER BY updated_at DESC LIMIT 1');
    const goals = goalsResult.rows[0] || {};

    const prompt = `
You are evaluating a job posting against user goals.

Job: ${job.title} at ${job.company}
Location: ${job.location}
Description: ${job.job_description || 'Not available'}
Salary: ${job.salary_min ? '$' + job.salary_min + '-$' + job.salary_max : 'Not specified'}

User Goals:
- Salary range: $${goals.min_salary || 'any'} - $${goals.max_salary || 'any'}
- Required tech: ${goals.required_tech_stack?.join(', ') || 'any'}
- Avoid tech: ${goals.avoid_tech_stack?.join(', ') || 'none'}
- Preferred roles: ${goals.preferred_roles?.join(', ') || 'any'}
- Remote preference: ${goals.remote_preference || 'any'}
- Seniority: ${goals.seniority_level || 'any'}

Evaluate if this job matches the user's goals. Score 0-100.
Respond in JSON: {"score": number, "decision": "apply"|"skip", "reasoning": "string"}
`;

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const result = JSON.parse(content.text);

    // Store decision
    await query(
      `INSERT INTO agent_decisions (job_id, decision, score, reasoning, goal_match)
       VALUES ($1, $2, $3, $4, $5)`,
      [jobId, result.decision, result.score, result.reasoning, JSON.stringify({})]
    );

    return {
      jobId,
      score: result.score,
      decision: result.decision,
      reasoning: result.reasoning,
    };
  } catch (error) {
    console.error('Evaluation error:', error);
    throw error;
  }
}

export async function fillJobApplicationActivity(
  jobId: number,
  resumeId: number
): Promise<{ success: boolean; applicationId?: number; error?: string }> {
  try {
    // Get job and resume
    const jobResult = await query('SELECT * FROM job_postings WHERE id = $1', [jobId]);
    const resumeResult = await query('SELECT * FROM resumes WHERE id = $1', [resumeId]);

    if (jobResult.rows.length === 0 || resumeResult.rows.length === 0) {
      return { success: false, error: 'Job or resume not found' };
    }

    const job = jobResult.rows[0];
    const resume = resumeResult.rows[0];

    // Open browser and navigate to job
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(job.job_url, { waitUntil: 'networkidle' });

    console.log(`Filling application for ${job.title} at ${job.company}...`);

    // Click apply button
    const applyButton = page.locator('button:has-text("Easy Apply")');
    if (await applyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await applyButton.click();
      await page.waitForTimeout(1000);
    }

    // Create application record
    const appResult = await query(
      `INSERT INTO applications (job_id, resume_id, status, applied_at)
       VALUES ($1, $2, 'applied', NOW())
       RETURNING id`,
      [jobId, resumeId]
    );

    const applicationId = appResult.rows[0].id;

    // Store form context (for human review/correction)
    await query(
      `INSERT INTO application_context (application_id, key, value)
       VALUES ($1, 'browser_open', 'true')`,
      [applicationId]
    );

    console.log('Application form opened. Please fill and submit manually.');
    console.log('Waiting 5 minutes for manual submission...');
    await page.waitForTimeout(300000);

    await browser.close();

    // Update status
    await query('UPDATE applications SET status = $1 WHERE id = $2', ['applied', applicationId]);

    return { success: true, applicationId };
  } catch (error) {
    console.error('Application error:', error);
    return { success: false, error: String(error) };
  }
}
