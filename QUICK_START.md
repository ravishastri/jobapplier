# Quick Start - Job Applier

## ✅ What's Ready Right Now

The backend is **fully compiled and working**. You can start the API server immediately.

```bash
npm run server
# Output: Server running on port 3001
# Test: curl http://localhost:3001/health
```

## 🔴 What Requires Docker

The full workflow needs:
- **PostgreSQL** (database)
- **Temporal** (workflow orchestration)

## Prerequisites

### Install Docker

**macOS:**
```bash
brew install docker
# or: Download Docker Desktop from https://www.docker.com/products/docker-desktop
```

**Linux:**
```bash
sudo apt-get install docker.io docker-compose
```

**Windows:**
- Download Docker Desktop from https://www.docker.com/products/docker-desktop

### Verify Installation
```bash
docker --version
docker ps
```

## Full Setup (5 minutes)

### 1. Start Services (Terminal 1)
```bash
cd /Users/ravishastri/projects/job-applier
npm run db:up
# Starts PostgreSQL (port 5432) and Temporal (port 7233)
# Wait 30 seconds for database to be ready
```

### 2. Start API Server (Terminal 2)
```bash
npm run server
# Output: Server running on port 3001
```

### 3. Start Temporal Worker (Terminal 3)
```bash
npm run worker
# Output: Worker started, listening on queue: job-applier
```

### 4. Test the System

```bash
# Health check
curl http://localhost:3001/health
# Response: {"status":"ok"}

# Get current goals
curl http://localhost:3001/api/goals
# Response: {} (empty, create one first)

# Create job goals
curl -X POST http://localhost:3001/api/goals \
  -H "Content-Type: application/json" \
  -d '{
    "min_salary": 120000,
    "max_salary": 200000,
    "required_tech_stack": ["TypeScript", "React", "Node.js"],
    "remote_preference": "remote",
    "seniority_level": "Senior"
  }'

# List jobs (empty initially)
curl http://localhost:3001/api/jobs

# List applications
curl http://localhost:3001/api/applications

# Get stats
curl http://localhost:3001/api/applications/stats
```

## Next: Set Up Frontend (Optional)

To run the React dashboard:

```bash
# Install Vite
npm install -D vite @vitejs/plugin-react

# Create vite.config.ts
cat > vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 }
})
EOF

# Run dev server
npm run dev
# Open http://localhost:3000
```

## Workflow: Manual Test

Once everything is running:

### 1. Create a Resume
```bash
curl -X POST http://localhost:3001/api/resumes \
  -H "Content-Type: application/json" \
  -d '{
    "version_name": "Senior Engineer v1",
    "content": "... your resume text ...",
    "is_active": true
  }'
```

### 2. Trigger LinkedIn Scrape
- In browser, navigate to `http://localhost:3000` (or use API)
- Click "Scrape LinkedIn" button
- A browser window will open with LinkedIn
- **Sign in manually** (LinkedIn requires real login)
- Scraper extracts 10 jobs and saves them

### 3. Evaluate Jobs
- Agent (Claude) scores each job against your goals
- Scores appear in the UI (0-100)
- Decision: apply or skip

### 4. Apply to Jobs
- Click "Apply" on a job
- Browser opens the application form
- **Fill form manually** (some fields need human input)
- Submit the form
- Status updates to "Applied"

### 5. Track Outcomes
- Mark applications as rejected/interview/offer
- Dashboard shows success rate
- Learn what works for your profile

## Troubleshooting

### "docker: command not found"
**Solution:** Install Docker Desktop or use `brew install docker`

### "Connection refused to 127.0.0.1:5432"
**Solution:** Run `npm run db:up` and wait 30 seconds for DB to start

### "Connection refused to 127.0.0.1:7233"
**Solution:** Ensure `npm run db:up` ran successfully and Temporal container is running
```bash
docker ps | grep job-applier
```

### API returns "Database unavailable"
**Solution:** 
1. Check if Docker containers are running: `docker ps`
2. Check DB logs: `docker logs job-applier-db`
3. Restart: `npm run db:down && npm run db:up`

### Can't access http://localhost:3000
**Solution:** 
1. Check if Vite is running: `npm run dev`
2. Check if port 3000 is available: `lsof -i :3000`
3. Kill any process on port 3000 if needed

## Environment Variables

Create `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

Edit `.env` and add:
```
ANTHROPIC_API_KEY=your-key-here
```

Get your API key from: https://console.anthropic.com

## Architecture

```
┌─────────────────┐
│  React UI       │ (localhost:3000)
│  JobsList       │
│  Stats          │
└────────┬────────┘
         │
         │ HTTP
         ▼
┌─────────────────┐
│  Express API    │ (localhost:3001)
│  /api/jobs      │
│  /api/goals     │
└────────┬────────┘
         │
    ┌────┴─────┬──────────┐
    │           │          │
    ▼           ▼          ▼
┌──────────┐ ┌────────┐ ┌──────────┐
│PostgreSQL│ │Temporal│ │Claude API│
└──────────┘ └────────┘ └──────────┘
```

## Commands Reference

```bash
npm run db:up           # Start Docker services
npm run db:down         # Stop Docker services
npm run server          # Start API server
npm run worker          # Start Temporal worker
npm run build           # Compile TypeScript
npm run dev            # Start frontend (after setup)
```

## Files Structure

```
job-applier/
├── src/
│   ├── backend/       # Express + Temporal
│   └── frontend/      # React components
├── db/                # SQL schema
├── docker-compose.yml # Services config
├── package.json       # Dependencies
└── README.md          # Full documentation
```

## Success Indicators

✅ All of these should work:
- `curl http://localhost:3001/health` returns `{"status":"ok"}`
- `docker ps` shows `job-applier-db` and `job-applier-temporal`
- Worker logs show "listening on queue: job-applier"
- React app loads at http://localhost:3000
- Can create goals via API
- Can upload resumes

## Support

- See `README.md` for full documentation
- See `ARCHITECTURE.md` for system design
- See `TEST_RESULTS.md` for what's been tested
- Check logs: `docker logs job-applier-db` or `docker logs job-applier-temporal`
