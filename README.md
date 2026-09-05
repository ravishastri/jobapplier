# Job Applier

An intelligent job application workflow that uses Claude AI to evaluate job postings against your goals, scrapes LinkedIn jobs with Playwright, and tracks applications.

## Features

- **LinkedIn Job Scraping** via Playwright (manual login in browser)
- **AI Job Evaluation** using Claude API to score jobs against your goals
- **Application Tracking** with status (pending, applied, rejected, interview, offer)
- **Resume Management** - multiple versions, easy selection
- **Goals Management** - salary range, tech stack, location, seniority, etc.
- **Application Dashboard** with stats (total, success rate, outcomes)
- **Temporal Workflows** for orchestrating long-running operations

## Architecture

```
job-applier/
├── src/
│   ├── backend/
│   │   ├── db.ts              # Database connection
│   │   ├── server.ts          # Express API server
│   │   ├── workflows.ts       # Temporal workflow definitions
│   │   ├── activities.ts      # Temporal activities (business logic)
│   │   └── worker.ts          # Temporal worker
│   └── frontend/
│       ├── App.tsx            # React main component
│       ├── App.css            # Styles
│       └── components/        # React components
├── db/
│   └── schema.sql             # PostgreSQL schema
├── docker-compose.yml         # Services: PostgreSQL, Temporal
└── package.json               # Dependencies & scripts
```

## Tech Stack

- **Backend**: Node.js + TypeScript + Express
- **Orchestration**: Temporal
- **Database**: PostgreSQL
- **Browser Automation**: Playwright
- **AI**: Claude API (Anthropic)
- **Frontend**: React + TypeScript

## Getting Started

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- Playwright browsers: `npx playwright install`
- ANTHROPIC_API_KEY environment variable

### Setup

1. **Clone & install**
   ```bash
   cd /Users/ravishastri/projects/job-applier
   npm install
   npx playwright install
   ```

2. **Create .env file**
   ```bash
   cp .env.example .env
   # Edit .env and add your ANTHROPIC_API_KEY
   ```

3. **Start services**
   ```bash
   npm run db:up           # Start PostgreSQL & Temporal (Docker)
   npm run server          # Start Express API (terminal 1)
   npm run worker          # Start Temporal worker (terminal 2)
   ```

4. **Start frontend** (separate terminal)
   ```bash
   # After you set up frontend tooling (Vite, etc.)
   npm run dev:frontend
   ```

## API Endpoints

### Jobs
- `GET /api/jobs` - List available jobs
- `POST /api/scrape` - Trigger LinkedIn scrape

### Goals
- `GET /api/goals` - Current job goals
- `POST /api/goals` - Update job goals

### Resumes
- `GET /api/resumes` - List resume versions
- `POST /api/resumes` - Upload new resume

### Applications
- `GET /api/applications` - List applications
- `GET /api/applications/stats` - Application statistics

## Workflow: Job to Application

1. **Scrape** → Playwright opens LinkedIn in browser (manual login)
2. **Extract** → Get job title, company, description, URL
3. **Store** → Save to PostgreSQL
4. **Evaluate** → Claude scores against your goals
5. **Decide** → Apply/Skip based on score
6. **Fill** → Playwright opens job application form
7. **Track** → Store result (pending/applied/rejected/interview/offer)

## Database Schema

- `user_goals` - Your job search criteria
- `job_postings` - Scraped LinkedIn jobs
- `resumes` - Multiple resume versions
- `applications` - Your applications & outcomes
- `agent_decisions` - AI evaluation logs

## Next Steps

1. **Frontend Build** - Set up Vite or Next.js with React components
2. **Auto Apply** - Agent automatically fills forms when score > threshold
3. **Scheduled Scraping** - Cron job for daily/weekly LinkedIn scrapes
4. **Email Alerts** - Notify on new high-scoring jobs
5. **Learning Loop** - Track rejection patterns, refine agent prompt
6. **Interview Tracking** - Schedule interviews, track feedback

## Running Without Frontend

```bash
curl http://localhost:3001/api/goals
curl -X POST http://localhost:3001/api/goals -H "Content-Type: application/json" \
  -d '{"min_salary": 120000, "max_salary": 200000, "remote_preference": "remote"}'
```

## Troubleshooting

**Playwright timeout on LinkedIn login:**
- Increase browser timeout in `activities.ts`
- LinkedIn may require CAPTCHA or 2FA - do it manually in the browser

**Temporal connection refused:**
- Check `docker-compose up` is running
- Verify `TEMPORAL_HOST` and `TEMPORAL_PORT` in `.env`

**PostgreSQL connection error:**
- Check `DB_*` environment variables
- Verify Docker container is healthy: `docker ps`

## Notes

- LinkedIn scraping requires manual browser login (LinkedIn blocks automation)
- Agent decisions are logged for review and refinement
- All data stays local (PostgreSQL in Docker)
