import postgres from 'postgres';
import { readFileSync } from 'fs';
import path from 'path';

const sql = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL)
  : postgres({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'jobapplier',
      password: process.env.DB_PASSWORD || 'jobapplier',
      database: process.env.DB_NAME || 'job_applier',
      onnotice: () => {},
    });

export async function query(text: string, params?: any[]) {
  const start = Date.now();
  try {
    const result = await sql.unsafe(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: result.length });
    return { rows: result, rowCount: result.length };
  } catch (error) {
    console.error('Query error', { text, error });
    throw error;
  }
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS user_goals (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  min_salary INTEGER,
  max_salary INTEGER,
  required_tech_stack TEXT[] DEFAULT '{}',
  avoid_tech_stack TEXT[] DEFAULT '{}',
  preferred_roles TEXT[] DEFAULT '{}',
  preferred_companies TEXT[] DEFAULT '{}',
  avoid_companies TEXT[] DEFAULT '{}',
  remote_preference TEXT,
  locations TEXT[] DEFAULT '{}',
  min_years_experience INTEGER,
  seniority_level TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS resumes (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  version_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  content TEXT NOT NULL,
  file_path VARCHAR(500)
);

CREATE TABLE IF NOT EXISTS job_postings (
  id SERIAL PRIMARY KEY,
  linkedin_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scraped_at TIMESTAMP,
  title VARCHAR(255) NOT NULL,
  company VARCHAR(255) NOT NULL,
  location VARCHAR(255),
  job_description TEXT,
  salary_min INTEGER,
  salary_max INTEGER,
  salary_currency VARCHAR(10),
  job_url TEXT,
  posted_date TIMESTAMP,
  application_count INTEGER,
  is_saved BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES job_postings(id),
  resume_id INTEGER REFERENCES resumes(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  applied_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending',
  agent_score INTEGER,
  agent_decision TEXT,
  notes TEXT,
  outcome VARCHAR(50)
);

CREATE TABLE IF NOT EXISTS agent_decisions (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES job_postings(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  decision VARCHAR(50),
  score INTEGER,
  reasoning TEXT,
  goal_match JSONB,
  applied BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS application_context (
  id SERIAL PRIMARY KEY,
  application_id INTEGER REFERENCES applications(id),
  key VARCHAR(255),
  value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS agent_feedback (
  id SERIAL PRIMARY KEY,
  application_id INTEGER REFERENCES applications(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  field_name VARCHAR(100),
  original_answer TEXT,
  corrected_answer TEXT,
  user_feedback TEXT,
  category VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_job_postings_company ON job_postings(company);
CREATE INDEX IF NOT EXISTS idx_job_postings_title ON job_postings(title);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_resumes_active ON resumes(is_active);
`;

export async function initializeDatabase() {
  try {
    console.log('Initializing database schema...');
    const statements = SCHEMA_SQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Running ${statements.length} schema statements...`);
    for (const statement of statements) {
      await sql.unsafe(statement);
    }

    console.log('✅ Database schema initialized successfully');
  } catch (error) {
    console.warn('⚠️ Database initialization warning:', error);
  }
}

export async function closePool() {
  await sql.end();
}

export default sql;
