# Railway Deployment Guide

## Quick Start (5 minutes)

### 1. Prepare Your Code
```bash
# Make sure you're in the project directory
cd ~/projects/job-applier

# Commit your code to GitHub
git init
git add .
git commit -m "Initial commit for Railway deployment"
git remote add origin https://github.com/YOUR_USERNAME/job-applier.git
git push -u origin main
```

### 2. Create Railway Project
1. Go to https://railway.app
2. Sign up with GitHub
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your `job-applier` repository
5. Railway will auto-detect and deploy

### 3. Add Services

**PostgreSQL Database:**
- Click "Add Service" → "PostgreSQL"
- Railway will auto-create the database
- Copy the `DATABASE_URL` from the PostgreSQL service

**Node.js Backend:**
- The repo is already configured
- Set environment variables (see below)

### 4. Set Environment Variables

In your Railway project dashboard:

1. Go to **Variables** tab
2. Add these variables:

```
CLAUDE_API_KEY=sk-ant-api03-... (from https://console.anthropic.com/)
DB_HOST=your-postgres-host (Railway provides this)
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your-postgres-password
DB_NAME=railway
NODE_ENV=production
PORT=3001
```

**Alternative: Use DATABASE_URL directly**
- Railway provides `DATABASE_URL` automatically
- You can use this instead of individual DB_ variables

### 5. Database Setup

After deployment:
1. SSH into your Railway container
2. Run migrations:
```bash
psql $DATABASE_URL < db/schema.sql
```

Or use Railway's build/deploy hooks:
- Add to `railway.json` or use Railway's dashboard to run the schema

### 6. Access Your App

Once deployed:
- Backend API: `https://your-project-name.up.railway.app`
- Frontend: `https://your-project-name-frontend.up.railway.app` (if separate)

## Environment Variables Needed

| Variable | Value | Where to Get |
|----------|-------|--------------|
| `CLAUDE_API_KEY` | Your Anthropic API key | https://console.anthropic.com/api/keys |
| `DB_HOST` | Postgres host | Railway PostgreSQL service |
| `DB_PORT` | 5432 | Railway default |
| `DB_USER` | postgres | Railway default |
| `DB_PASSWORD` | Your DB password | Set in Railway |
| `DB_NAME` | railway | Default |
| `NODE_ENV` | production | Set this |
| `PORT` | 3001 | Keep as is |

## Monitoring

View logs in Railway dashboard:
- Click your service → "Logs" tab
- Real-time logs appear here
- Use to debug any issues

## Common Issues

**"Module not found"**
- Railway should auto-install dependencies with `npm install`
- If not, check `package.json` is in root

**Database connection errors**
- Verify DATABASE_URL is correct
- Check PostgreSQL service is running
- Ensure schema is migrated

**Port already in use**
- Railway assigns PORT automatically
- Use `process.env.PORT` instead of hardcoding

## Next Steps

1. **Auto-deploy on push**: Enable GitHub integration (automatic with Railway)
2. **Custom domain**: Go to "Settings" → "Domains" in Railway
3. **Monitoring**: Set up alerts in Railway dashboard
4. **CI/CD**: Railway handles this automatically

## Production Checklist

- ✅ Environment variables set
- ✅ Database migrated (schema.sql run)
- ✅ Claude API key configured
- ✅ Frontend built and served
- ✅ HTTPS enabled (automatic with Railway)
- ✅ Logs accessible for debugging
- ✅ Database backups enabled

## Support

- Railway docs: https://docs.railway.app
- GitHub issues: Open an issue if deployment fails
