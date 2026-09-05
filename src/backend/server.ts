import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../..', 'public')));

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/generate-answers', async (req, res) => {
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

app.post('/api/tailor-resume', async (req, res) => {
  try {
    const { resume, jobDescription } = req.body;

    if (!resume || !jobDescription) {
      return res.status(400).json({ error: 'resume and jobDescription required' });
    }

    const prompt = `You are an expert resume writer. Here is a job description:

${jobDescription}

And here is a resume:

${resume}

Please tailor this resume to better match the job description. Focus on:
1. Reordering bullet points to highlight most relevant experience
2. Adjusting language to match keywords from the job description
3. Emphasizing relevant skills and achievements

Return the tailored resume in plain text format.`;

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = response.content.find((c: any) => c.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      throw new Error('No text content in response');
    }

    res.json({ tailoredResume: textContent.text });
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
