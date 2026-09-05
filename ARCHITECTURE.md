# Job Applier Architecture

## System Overview

This is a multi-tier application for intelligent job application management with AI-driven decision making and workflow orchestration.

## Components

### 1. Backend (Node.js + TypeScript)

**Express Server** (`src/backend/server.ts`)
- RESTful API for frontend consumption
- Endpoints for jobs, applications, resumes, goals
- Port: 3001
- Handles all business logic requests

**Temporal Workflows** (`src/backend/workflows.ts`)
- `scrapeLinkedInJobs()` - Trigger LinkedIn scraping
- `evaluateJobFitWorkflow()` - Score jobs against goals
- `fillJobApplicationWorkflow()` - Auto-fill job applications
- `dailyJobScrapeWorkflow()` - Daily scrape scheduler

**Temporal Activities** (`src/backend/activities.ts`)
- `scrapeLinkedInJobsActivity()` - Uses Playwright to scrape LinkedIn
- `evaluateJobFitActivity()` - Calls Claude API to score jobs
- `fillJobApplicationActivity()` - Automated form filling (human-in-loop)

**Temporal Worker** (`src/backend/worker.ts`)
- Executes workflows and activities
- Listens on task queue: `job-applier`
- Connects to Temporal server

### 2. Frontend (React + TypeScript)

**Components:**
- `JobsList` - Shows available jobs, trigger scraping
- `ApplicationsList` - Track applications & outcomes
- `Stats` - Dashboard with success metrics
- `GoalsPanel` - Configure job search criteria
- `ResumesPanel` - Manage multiple resume versions

**Styling:** CSS with responsive grid layout

### 3. Database (PostgreSQL)

**Schema:**
- `user_goals` - Job search criteria (salary, tech stack, location, etc.)
- `job_postings` - Scraped LinkedIn jobs
- `resumes` - Multiple resume versions with content
- `applications` - Application records with status & outcomes
- `agent_decisions` - Audit log of AI decisions
- `application_context` - Metadata for each application

### 4. External Services

**Anthropic Claude API**
- Model: `claude-opus-5`
- Used for: Job evaluation against goals
- Prompt: Analyzes JD vs. user goals → score + decision

**LinkedIn via Playwright**
- Opens browser (headless: false) to manual login
- Scrapes job postings
- Opens job application forms
- Human-in-loop for completing forms (5-minute wait)

**Temporal Server** (Docker)
- Orchestrates long-running workflows
- Retries failed activities
- Manages workflow history

## Data Flow

### Daily Scrape Workflow

```
1. Temporal scheduler triggers dailyJobScrapeWorkflow
2. Activity: scrapeLinkedInJobsActivity()
   - Playwright opens LinkedIn in browser
   - User logs in manually (if needed)
   - Extract job cards (title, company, location, URL)
   - Save to job_postings table
3. Deduplicate by linkedin_id (ON CONFLICT DO NOTHING)
4. Return count of new jobs
```

### Job Evaluation Workflow

```
1. API: POST /api/jobs/:id/evaluate
2. Temporal: evaluateJobFitWorkflow(jobId)
3. Activity: evaluateJobFitActivity()
   - Fetch job from DB
   - Fetch user goals
   - Build prompt: JD + goals → score this fit
   - Call Claude API
   - Parse response: {score, decision, reasoning}
   - Store in agent_decisions table
4. Return score, decision (apply/skip), reasoning
```

### Application Workflow

```
1. API: POST /api/applications/create
   {jobId, resumeId}
2. Temporal: fillJobApplicationWorkflow()
3. Activity: fillJobApplicationActivity()
   - Fetch job URL & resume content
   - Playwright opens job URL in headless: false
   - Click "Easy Apply" button
   - Insert record in applications table
   - Log in application_context: browser_open = true
   - Wait 5 minutes for human to fill & submit form
   - Update applications status = 'applied'
4. Return applicationId, success status
```

### API Request Flow

```
Frontend -> Express API (Port 3001)
         -> PostgreSQL query
         -> Return JSON

For async work:
Frontend -> Express API
         -> Temporal Client (triggers workflow)
         -> Return workflow_id
         -> Frontend polls /api/workflows/:id for status
```

## Key Design Decisions

1. **Manual LinkedIn Login**
   - LinkedIn blocks automation; requires real browser interaction
   - Playwright opens with `headless: false` for UI
   - User logs in, then scraping proceeds

2. **Human-in-Loop Form Filling**
   - Some job forms are complex (ask screening Qs, file uploads)
   - Agent opens form, human completes it, agent polls for submission
   - 5-minute timeout with warning message

3. **Temporal for Workflows**
   - Handles retries, failures, scheduling
   - Audit log of all decisions
   - Can pause/resume workflows mid-execution

4. **Claude API for Job Evaluation**
   - Scores jobs against user goals (0-100)
   - Provides reasoning for apply/skip decision
   - Can be tweaked per-user without code changes

5. **PostgreSQL for State**
   - All job postings, applications, goals stored locally
   - No external API dependencies (except Claude)
   - Historical data for pattern analysis

## Scalability Considerations

**Current MVP:**
- Single Temporal worker
- Single Playwright browser (headless: false)
- Small job batch (10 jobs per scrape)

**Future scaling:**
- Worker pool for parallel workflow execution
- Playwright pool with multiple browser instances
- Caching of job descriptions to avoid re-scraping
- Batch evaluation (score 100 jobs in parallel)
- Read replicas for analytics

## Error Handling

- **LinkedIn login timeout** → User see message, can retry
- **Claude API failure** → Activity retries 3x via Temporal
- **Job form complexity** → Timeout after 5 min, mark as pending review
- **DB connection lost** → Express returns 500, frontend shows error

## Security

- `.env` stores API keys (not in repo)
- PostgreSQL runs in Docker, isolated network
- Playwright runs headless or with `headless: false` (user choice)
- No credentials stored (except user's browser session)
- Application_context table audit-logs all decisions

## Monitoring & Debugging

- Temporal Web UI available (default: `localhost:8233`)
- PostgreSQL logs available in Docker container
- Express logs to stdout
- Agent decisions logged for accountability
- Success metrics available in stats endpoint
