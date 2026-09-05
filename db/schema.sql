-- Users goals (what they're looking for)
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
  remote_preference TEXT, -- 'remote', 'hybrid', 'onsite', 'any'
  locations TEXT[] DEFAULT '{}',
  min_years_experience INTEGER,
  seniority_level TEXT,
  notes TEXT
);

-- Resume versions
CREATE TABLE IF NOT EXISTS resumes (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  version_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT false,
  content TEXT NOT NULL,
  file_path VARCHAR(500)
);

-- LinkedIn job postings
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

-- Job applications (tracking what we applied to)
CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES job_postings(id),
  resume_id INTEGER REFERENCES resumes(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  applied_at TIMESTAMP,
  recruiter_contacted_at TIMESTAMP,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'applied', 'rejected', 'interview', 'offer'
  agent_score INTEGER, -- 0-100 score from agent evaluation
  agent_decision TEXT, -- reasoning from agent (why apply/skip)
  notes TEXT,
  outcome VARCHAR(50) -- 'rejected', 'ghosted', 'interview_scheduled', 'offer_received'
);

-- Agent decision log (for understanding patterns)
CREATE TABLE IF NOT EXISTS agent_decisions (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES job_postings(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  decision VARCHAR(50), -- 'apply', 'skip'
  score INTEGER,
  reasoning TEXT,
  goal_match JSONB, -- which goals matched/didn't match
  applied BOOLEAN DEFAULT false
);

-- Application context/memory
CREATE TABLE IF NOT EXISTS application_context (
  id SERIAL PRIMARY KEY,
  application_id INTEGER REFERENCES applications(id),
  key VARCHAR(255),
  value TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Agent feedback (corrections to improve future answers)
CREATE TABLE IF NOT EXISTS agent_feedback (
  id SERIAL PRIMARY KEY,
  application_id INTEGER REFERENCES applications(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  field_name VARCHAR(100), -- 'fitDescription', 'whyInterested', 'whyGoodFit', 'whyCompany'
  original_answer TEXT,
  corrected_answer TEXT,
  user_feedback TEXT, -- why the user changed it
  category VARCHAR(100) -- inferred category for learning
);

-- Add recruiter_contacted_at column if it doesn't exist
ALTER TABLE applications ADD COLUMN IF NOT EXISTS recruiter_contacted_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_job_postings_company ON job_postings(company);
CREATE INDEX IF NOT EXISTS idx_job_postings_title ON job_postings(title);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_resumes_active ON resumes(is_active);
