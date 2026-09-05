# ✅ Railway Deployment Ready!

Your Job Applier is now configured for Railway deployment. Here's what's been set up:

## Files Created/Updated

### Deployment Configuration
- ✅ `railway.json` - Railway platform config
- ✅ `.env.example` - Environment variables template
- ✅ `DEPLOY.md` - Quick 5-minute deployment guide
- ✅ `RAILWAY_DEPLOYMENT.md` - Detailed deployment guide

### Code Updates
- ✅ `package.json` - Added `start` script for production
- ✅ `vite.config.ts` - Configured build output
- ✅ `src/backend/server.ts` - Added static file serving for frontend

## Ready to Deploy

### 1. Push to GitHub
```bash
cd ~/projects/job-applier
git init
git add .
git commit -m "Setup for Railway deployment"
git remote add origin https://github.com/YOUR_USERNAME/job-applier.git
git push -u origin main
```

### 2. Deploy on Railway
Go to https://railway.app:
1. Sign in with GitHub
2. New Project → Deploy from GitHub
3. Select `job-applier` repo
4. ✨ Railway auto-deploys!

### 3. Add Database
1. Click "Add Service" → PostgreSQL
2. Copy the database URL

### 4. Set Environment Variables
Add to Railway dashboard:
- `CLAUDE_API_KEY` - from https://console.anthropic.com/
- `NODE_ENV=production`

### 5. Run Database Schema
```bash
# In Railway Shell
psql $DATABASE_URL < db/schema.sql
```

## What Happens During Deployment

1. **Build Phase**
   - `npm install` - Installs dependencies
   - `npm run build` - Builds TypeScript + React frontend
   - Creates `dist/` folder with compiled code

2. **Run Phase**
   - `npm run start` - Starts the Node.js server
   - Server serves API + frontend from same port
   - Connects to PostgreSQL database
   - Listens on Railway-assigned PORT

3. **Result**
   - Your app is live at `https://your-project.up.railway.app`
   - Auto-deploys on every GitHub push
   - Free tier: $5/month credit included
   - HTTPS automatic
   - PostgreSQL included

## Key Features

✅ **Full Stack**
- Node.js + Express backend
- React frontend
- PostgreSQL database
- All on one platform

✅ **Auto-Deploy**
- Push to GitHub → Railway deploys automatically
- No manual deployment needed
- Logs accessible in dashboard

✅ **Production Ready**
- Frontend served from `/dist/frontend`
- API on same domain (no CORS issues)
- Environment variables from Railway
- Database auto-connected

✅ **Scalable**
- Easy to add environment variables
- Database backups available
- Custom domains supported
- Monitoring & alerts

## Cost

- **Free Tier**: $5/month
- PostgreSQL: Included
- Node.js: Included
- Domains: Included
- That's all you need!

## Troubleshooting

**"Module not found"**
→ Check `npm install` runs in build logs

**"Database connection error"**
→ Verify DATABASE_URL in Railway
→ Ensure schema is migrated

**"Port already in use"**
→ Railway auto-assigns PORT, should work

**Check Logs**
→ Click service → "Logs" tab in Railway dashboard

## Next Steps

1. ✅ Push to GitHub
2. ✅ Connect to Railway
3. ✅ Deploy
4. ✅ Add PostgreSQL
5. ✅ Set environment variables
6. ✅ Run schema migration
7. ✅ Test your live app!

See `DEPLOY.md` for quick deployment steps!
