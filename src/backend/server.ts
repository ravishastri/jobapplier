import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import authRouter, { initializeAuthDB, authenticateToken } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

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

    const prompt = `You are an expert resume writer. Your task is to tailor a resume to match a job description while preserving the EXACT formatting, structure, and layout of the original.

CRITICAL: Keep all formatting exactly as is - including spacing, indentation, line breaks, sections, bullets, and visual structure. Do NOT change the format at all.

Job Description:
${jobDescription}

Original Resume:
${resume}

Please tailor this resume by:
1. Keeping the exact same structure, sections, and formatting as the original
2. Replacing or reordering bullet points to highlight most relevant experience for this specific job
3. Adjusting language to match keywords from the job description
4. Emphasizing relevant skills and achievements
5. Maintaining the same visual structure and spacing

Return ONLY the tailored resume in the exact same format as the original. Do not add any explanations or metadata.`;

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

      // Parse the resume text into paragraphs
      const lines = tailoredResume.split('\n');
      const paragraphs = lines.map(line =>
        new Paragraph({
          text: line || '',
          spacing: { line: 240, lineRule: 'auto' }
        })
      );

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

app.listen(PORT, () => {
  console.log(`✅ Server listening on port ${PORT}`);
  console.log(`POST /api/generate-answers - Generate answers to questions`);
  console.log(`POST /api/tailor-resume - Tailor resume to job description`);
});
