# Quick Start - Run Everything

## 🚀 Start All Services (3 Commands)

### Terminal 1: Docker & Database
```bash
npm run db:up
```
**Output:** Containers starting... PostgreSQL healthy ✅

### Terminal 2: Backend API
```bash
npm run server
```
**Output:** Server running on port 3001 ✅

### Terminal 3: Frontend
```bash
npm run dev:frontend
```
**Output:** Vite v8.2.2 ready in XXX ms  
**Local:** http://localhost:3000/ ✅

---

## 🌐 Open in Browser

```
http://localhost:3000
```

You should see:
- Header: "Job Applier"
- Tabs: Jobs | Applications | Stats | Resumes | Goals
- Empty state: "No jobs yet. Click 'Scrape LinkedIn'"

---

## ✅ Test Everything

### Frontend Works
```bash
curl http://localhost:3000
# Returns: HTML with "Job Applier" title
```

### Backend Works
```bash
curl http://localhost:3001/health
# Returns: {"status":"ok"}
```

### Database Works
```bash
docker exec job-applier-db psql -U postgres -d job_applier -c "\dt"
# Lists all tables
```

---

## 📋 What Each Tab Does

| Tab | Purpose | Action |
|-----|---------|--------|
| **Jobs** | View scraped jobs | Click "Scrape LinkedIn" |
| **Applications** | Track your applications | Auto-populated after scraping |
| **Stats** | Success metrics | Shows totals & percentages |
| **Resumes** | Manage resume versions | Upload new resume |
| **Goals** | Set job criteria | Define salary, tech, location |

---

## 🛑 Stop Everything

```bash
# In Terminal 3 (Frontend)
Ctrl + C

# In Terminal 2 (Backend)
Ctrl + C

# In Terminal 1 (Docker)
npm run db:down
```

---

## 🐛 Troubleshooting

### "Connection refused" on port 3000
```bash
# Vite not running?
npm run dev:frontend
```

### "Connection refused" on port 3001
```bash
# Backend not running?
npm run server
```

### "Connection refused" on port 5432
```bash
# Docker not running?
npm run db:up
# Wait 30 seconds for startup
```

### Blank page in browser
```bash
# Hard refresh
Cmd + Shift + R
# Check DevTools Console (Cmd + Option + J)
```

### Changes not showing up
```bash
# Vite hot reload might be stuck
# In Terminal 3: Ctrl + C
npm run dev:frontend
```

---

## 📊 Expected Output

### Terminal 1 (Docker):
```
time="..." level=info msg="starting colima"
time="..." level=info msg="done"
Container job-applier-db Starting
Container job-applier-db Started
```

### Terminal 2 (Server):
```
◇ injected env (0) from .env
Server running on port 3001
```

### Terminal 3 (Frontend):
```
VITE v8.2.2  ready in 102 ms

➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

---

## 🎯 Next Actions

### Create Job Goals
1. Open http://localhost:3000
2. Click "Goals" tab
3. Fill in:
   - Min Salary: 120000
   - Max Salary: 200000
   - Tech Stack: TypeScript, React, Node.js
   - Remote: remote
4. Click "Save Goals"

### Upload Resume
1. Click "Resumes" tab
2. Enter name: "MyResume v1"
3. Paste resume text
4. Click "Upload Resume"

### View Stats
1. Click "Stats" tab
2. See counters (all will be 0 initially)
3. Filled in as you make applications

---

## 📝 Commands Reference

| Command | What It Does |
|---------|--------------|
| `npm run db:up` | Start Docker (PostgreSQL + Temporal) |
| `npm run db:down` | Stop Docker |
| `npm run server` | Start Express API |
| `npm run dev:frontend` | Start Vite dev server |
| `npm run dev:backend` | Start API + Worker |
| `npm run build:frontend` | Build for production |
| `npm run build` | Compile TypeScript |

---

## 🔌 API Endpoints

All available at `http://localhost:3001`:

```bash
# Health
GET /health

# Goals
GET /api/goals
POST /api/goals

# Jobs
GET /api/jobs
POST /api/scrape

# Applications
GET /api/applications
GET /api/applications/stats

# Resumes
GET /api/resumes
POST /api/resumes
```

---

## 📱 Browser DevTools

```
Press: Cmd + Option + J (Mac) or Ctrl + Shift + J (Windows)

Check:
- Console: Any errors?
- Network: API calls working?
- Application: LocalStorage for any data?
- Elements: React components rendering?
```

---

## ✨ You're All Set!

The system is fully built and running.

- ✅ Frontend loads
- ✅ API responds
- ✅ Database connected
- ✅ React components work
- ✅ Hot reload enabled

**Now go build your job application workflow!**
