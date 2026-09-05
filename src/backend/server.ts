import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { Document, Packer, Paragraph, TextRun, ExternalHyperlink } from 'docx';
import authRouter, { initializeAuthDB, authenticateToken } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

// Helper function to parse text and create runs with hyperlinks
function createTextRunsWithLinks(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return parts.map((part, idx) => {
    if (part.match(urlRegex)) {
      // It's a URL - create a hyperlink
      return new ExternalHyperlink({
        children: [
          new TextRun({
            text: part,
            color: '0563C1',
            underline: { type: 'single' }
          })
        ],
        link: part
      });
    } else {
      // Regular text
      return new TextRun({
        text: part,
        bold: false
      });
    }
  });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, '../..', 'public')));

// Initialize auth database
initializeAuthDB();

// Auth routes
app.use('/auth', authRouter);

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/generate-answers', authenticateToken, async (req, res) => {
  try {
    const { questions, context } = req.body;

    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: 'questions array required' });
    }

    const prompt = `You are helping someone fill out a job application. Here is the context about them:
${context || 'No additional context provided'}

Please answer the following ${questions.length} question(s) professionally and concisely:

${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Provide answers in JSON format with keys like "answer_1", "answer_2", etc.`;

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((c: any) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    let jsonText = textContent.text;
    const jsonMatch = jsonText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    res.json({ answers: JSON.parse(jsonText) });
  } catch (error) {
    console.error('Error generating answers:', error);
    res.status(500).json({ error: String(error) });
  }
});

app.post('/api/tailor-resume', authenticateToken, async (req, res) => {
  try {
    const { resume, jobDescription } = req.body;

    if (!resume || !jobDescription) {
      return res.status(400).json({ error: 'resume and jobDescription required' });
    }

    const prompt = `You are an expert human resume writer with 20+ years of experience helping candidates. Your task is to tailor a resume to match a job description while maintaining authenticity and human-like qualities.

CRITICAL INSTRUCTIONS:
1. Keep the exact same structure, sections, and formatting as the original
2. NEVER copy the job title or exact role name into the resume
3. Rewrite bullet points to reflect genuine experience that aligns with job requirements
4. ADD METRICS AND NUMBERS to every bullet point where possible:
   - Percentages (e.g., "Improved efficiency by 25%")
   - Dollar amounts (e.g., "Generated $500K in revenue")
   - Headcount (e.g., "Led team of 12 engineers")
   - Time savings (e.g., "Reduced load time from 8s to 2s")
   - Growth metrics (e.g., "Grew user base by 40%")
   - If exact numbers aren't in original, estimate realistic ranges based on typical impact
5. Use varied, natural language - avoid repetitive phrasing and AI-like patterns
6. Incorporate keywords subtly through natural context, not forced insertion
7. Vary sentence structure (some short, some longer, mix passive and active voice)
8. Use different phrasings for similar concepts to avoid sounding templated
9. Keep professional summary focused on the candidate's unique value, not copying the job description
10. Maintain the same visual structure and spacing - no formatting changes

Job Description (use for reference, do NOT copy):
${jobDescription}

Original Resume:
${resume}

Write the tailored resume to highlight relevant experience naturally with strong metrics. Make it sound like it was written by the candidate themselves, not by an AI. Focus on authentic alignment between their experience and the job, not keyword matching.

Return ONLY the tailored resume in the exact same format as the original. Do not add any explanations, metadata, or commentary.`;

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((c: any) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    const tailoredResume = textContent.text;

    // Save to local folder as Word document
    try {
      const tailoredDir = path.join(__dirname, '../../tailored-resumes');
      await fs.mkdir(tailoredDir, { recursive: true });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const filename = `tailored-resume-${timestamp}-${Date.now()}.docx`;
      const filepath = path.join(tailoredDir, filename);

      // Parse the resume text into paragraphs with formatting
      const lines = tailoredResume.split('\n');
      const paragraphs = [];
      let headerIndex = 0;
      let sectionHeaderCount = 0;

      lines.forEach((line, idx) => {
        const trimmedLine = line.trim();
        const isEmpty = !trimmedLine;

        // Check if line is a section header (AREAS OF EXPERTISE, EXPERIENCE, etc)
        const isSectionHeader = /^[A-Z][A-Z\s]*$/.test(trimmedLine) &&
                               (trimmedLine.length < 60) &&
                               (trimmedLine.includes('EXPERTISE') ||
                                trimmedLine.includes('EXPERIENCE') ||
                                trimmedLine.includes('EDUCATION') ||
                                trimmedLine.includes('SKILLS'));

        // Center first 3 non-empty lines (Name, title, contact)
        let isCentered = sectionHeaderCount === 0 && !isEmpty && headerIndex < 3;

        // After AREAS OF EXPERTISE header, center the next 2 non-empty lines
        if (isSectionHeader && trimmedLine.includes('EXPERTISE')) {
          headerIndex = idx;
        }
        if (headerIndex > 0 && idx > headerIndex && idx <= headerIndex + 2 && !isEmpty && !isSectionHeader) {
          isCentered = true;
        }

        // Check if line is a section header itself
        if (isSectionHeader) {
          isCentered = true;
          sectionHeaderCount++;
        }

        // Check if line is a bullet point
        const isBullet = trimmedLine.startsWith('-') || trimmedLine.startsWith('•');
        const cleanLine = trimmedLine.replace(/^[-•]\s*/, '').trim();

        if (!isEmpty) {
          headerIndex++;
        }

        const paragraph = new Paragraph({
          children: createTextRunsWithLinks(cleanLine || ''),
          spacing: { line: 240, lineRule: 'auto' },
          alignment: isCentered ? 'center' : undefined,
          bullet: isBullet ? {
            level: 0
          } : undefined,
          indent: isBullet ? { left: 720, hanging: 360 } : undefined
        });

        paragraphs.push(paragraph);
      });

      // Create Word document
      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs
        }]
      });

      // Write to file
      const buffer = await Packer.toBuffer(doc);
      await fs.writeFile(filepath, buffer);
      console.log(`✅ Tailored resume saved to: ${filepath}`);
    } catch (saveError) {
      console.error('Warning: Could not save tailored resume locally:', saveError);
    }

    res.json({ tailoredResume });
  } catch (error) {
    console.error('Error tailoring resume:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Download tailored resume as Word document
app.post('/api/download-resume-word', authenticateToken, async (req, res) => {
  try {
    const { resumeText, company, jobTitle, saveToFolder } = req.body;

    if (!resumeText) {
      return res.status(400).json({ error: 'resumeText required' });
    }

    // Create folder path - allow custom folder or use company/job title
    let folderPath = 'tailored-resumes';
    if (saveToFolder) {
      folderPath = `tailored-resumes/${saveToFolder}`;
    } else if (company || jobTitle) {
      const folderName = (company || jobTitle || 'general').replace(/[/\\:*?"<>|]/g, '_').substring(0, 50);
      folderPath = `tailored-resumes/${folderName}`;
    }

    // Ensure folder exists
    const fullFolderPath = path.join(__dirname, `../../${folderPath}`);
    await fs.mkdir(fullFolderPath, { recursive: true });

    // Save to folder
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const filename = `${timestamp}-${Date.now()}.docx`;
      const filepath = path.join(fullFolderPath, filename);

      // Parse and create document (same as before)
      const lines = resumeText.split('\n');
      const paragraphs = [];
      let headerIndex = 0;
      let sectionHeaderCount = 0;

      lines.forEach((line, idx) => {
        const trimmedLine = line.trim();
        const isEmpty = !trimmedLine;

        const isSectionHeader = /^[A-Z][A-Z\s]*$/.test(trimmedLine) &&
                               (trimmedLine.length < 60) &&
                               (trimmedLine.includes('EXPERTISE') ||
                                trimmedLine.includes('EXPERIENCE') ||
                                trimmedLine.includes('EDUCATION') ||
                                trimmedLine.includes('SKILLS'));

        let isCentered = sectionHeaderCount === 0 && !isEmpty && headerIndex < 3;

        if (isSectionHeader && trimmedLine.includes('EXPERTISE')) {
          headerIndex = idx;
        }
        if (headerIndex > 0 && idx > headerIndex && idx <= headerIndex + 2 && !isEmpty && !isSectionHeader) {
          isCentered = true;
        }

        if (isSectionHeader) {
          isCentered = true;
          sectionHeaderCount++;
        }

        const isBullet = trimmedLine.startsWith('-') || trimmedLine.startsWith('•');
        const cleanLine = trimmedLine.replace(/^[-•]\s*/, '').trim();

        if (!isEmpty) {
          headerIndex++;
        }

        const paragraph = new Paragraph({
          children: createTextRunsWithLinks(cleanLine || ''),
          spacing: { line: 240, lineRule: 'auto' },
          alignment: isCentered ? 'center' : undefined,
          bullet: isBullet ? {
            level: 0
          } : undefined,
          indent: isBullet ? { left: 720, hanging: 360 } : undefined
        });

        paragraphs.push(paragraph);
      });

      const doc = new Document({
        sections: [{
          properties: {},
          children: paragraphs
        }]
      });

      const buffer = await Packer.toBuffer(doc);
      await fs.writeFile(filepath, buffer);
      console.log(`✅ Tailored resume saved to: ${filepath}`);
    } catch (saveError) {
      console.error('Warning: Could not save tailored resume locally:', saveError);
    }

    // Create Word document for download
    const downloadLines = resumeText.split('\n');
    const downloadParagraphs = [];
    let downloadHeaderIndex = 0;
    let downloadSectionHeaderCount = 0;

    downloadLines.forEach((line, idx) => {
      const trimmedLine = line.trim();
      const isEmpty = !trimmedLine;

      const isSectionHeader = /^[A-Z][A-Z\s]*$/.test(trimmedLine) &&
                             (trimmedLine.length < 60) &&
                             (trimmedLine.includes('EXPERTISE') ||
                              trimmedLine.includes('EXPERIENCE') ||
                              trimmedLine.includes('EDUCATION') ||
                              trimmedLine.includes('SKILLS'));

      let isCentered = downloadSectionHeaderCount === 0 && !isEmpty && downloadHeaderIndex < 3;

      if (isSectionHeader && trimmedLine.includes('EXPERTISE')) {
        downloadHeaderIndex = idx;
      }
      if (downloadHeaderIndex > 0 && idx > downloadHeaderIndex && idx <= downloadHeaderIndex + 2 && !isEmpty && !isSectionHeader) {
        isCentered = true;
      }

      if (isSectionHeader) {
        isCentered = true;
        downloadSectionHeaderCount++;
      }

      const isBullet = trimmedLine.startsWith('-') || trimmedLine.startsWith('•');
      const cleanLine = trimmedLine.replace(/^[-•]\s*/, '').trim();

      if (!isEmpty) {
        downloadHeaderIndex++;
      }

      const paragraph = new Paragraph({
        children: createTextRunsWithLinks(cleanLine || ''),
        spacing: { line: 240, lineRule: 'auto' },
        alignment: isCentered ? 'center' : undefined,
        bullet: isBullet ? {
          level: 0
        } : undefined,
        indent: isBullet ? { left: 720, hanging: 360 } : undefined
      });

      downloadParagraphs.push(paragraph);
    });

    const doc = new Document({
      sections: [{
        properties: {},
        children: downloadParagraphs
      }]
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="tailored-resume-${new Date().toISOString().split('T')[0]}.docx"`);
    res.send(buffer);
  } catch (error) {
    console.error('Error creating Word document:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Analyze skills gap between job and resume
app.post('/api/analyze-skills-gap', authenticateToken, async (req, res) => {
  try {
    const { jobDescription, resumeId } = req.body;

    if (!jobDescription) {
      return res.status(400).json({ error: 'Job description required' });
    }

    // For now, get a sample resume or use a placeholder
    // In production, this would fetch from DB using resumeId
    const sampleResume = `Senior Full Stack Engineer
2020-Present: Tech Company
- Built microservices using Node.js and Python
- Led team of 5 engineers
- Improved performance by 40%

2018-2020: Startup
- Developed React applications
- Managed PostgreSQL databases
- Deployed to AWS`;

    const analysisPrompt = `Analyze the skills gap between a job description and a resume.

Job Description:
${jobDescription}

Current Resume:
${sampleResume}

Return a JSON object with:
- missingSkills: array of skills mentioned in the job that are NOT clearly in the resume
- recommendedBullets: array of 2-3 suggested resume bullet points that would address the missing skills

Focus on technical skills, tools, and relevant experience. Be concise.

Return ONLY valid JSON, no markdown formatting.`;

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1000,
      messages: [{ role: 'user', content: analysisPrompt }],
    });

    const textContent = response.content.find((c: any) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    let jsonText = textContent.text.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }

    const analysis = JSON.parse(jsonText);
    res.json(analysis);
  } catch (error) {
    console.error('Error analyzing skills gap:', error);
    res.status(500).json({ error: String(error) });
  }
});

// Update job application status (applied, recruiter contacted)
app.post('/api/jobs/:id/update-status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { field } = req.body;

    if (!id || !field) {
      return res.status(400).json({ error: 'Job ID and field required' });
    }

    res.json({ success: true, message: `Updated ${field}` });
  } catch (error) {
    console.error('Error updating job status:', error);
    res.status(500).json({ error: String(error) });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
  console.log(`POST /api/generate-answers - Generate answers to questions`);
  console.log(`POST /api/tailor-resume - Tailor resume to job description`);
  console.log(`POST /api/download-resume-word - Download resume as Word document`);
});
