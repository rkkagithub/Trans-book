# TransBook - One-Click Render Deployment

## Option 1: Direct GitHub Deploy (Recommended)

1. **Fork this repository** or **create new repo** with these files
2. **Go to [Render.com](https://render.com)** 
3. **Click "New" → "Blueprint"**
4. **Connect your GitHub repo**
5. **Render will auto-deploy** using `render-deploy.yaml`
6. **Access your app** at the provided URL

## Option 2: Manual Service Creation

### Step 1: Create Web Service
1. Go to [Render.com](https://render.com)
2. Click "New" → "Web Service" 
3. Connect your GitHub repository
4. Settings:
   - **Name**: `transbook`
   - **Environment**: `Docker`
   - **Dockerfile Path**: `Dockerfile.render`
   - **Instance Type**: `Free`

### Step 2: Create Database
1. Click "New" → "PostgreSQL"
2. Settings:
   - **Name**: `transbook-postgres`
   - **Database**: `transbook`
   - **User**: `transbook`
   - **Instance Type**: `Free`

### Step 3: Environment Variables
Add these to your web service:

```
DATABASE_URL: (copy from PostgreSQL service - Internal Database URL)
SESSION_SECRET: (generate random string)
REPLIT_DOMAINS: your-app-name.onrender.com
REPL_ID: render-production
ISSUER_URL: https://replit.com/oidc
NODE_ENV: production
PORT: 10000
```

## Option 3: Deploy Button (Easiest)

You can create a one-click deploy button. Just add this to your GitHub README:

```markdown
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/yourusername/transbook)
```

## What You Get

- **Free hosting** for your TransBook app
- **Free PostgreSQL database** with backups
- **Automatic SSL** certificates
- **Custom domain** support
- **Auto-deploy** on GitHub pushes
- **Health monitoring** and auto-restart

## App Features Available

Once deployed, your TransBook app includes:
- Customer management system
- Vehicle fleet tracking
- Driver management
- Trip planning and tracking
- Invoice generation with GST
- Expense tracking
- Business analytics dashboard
- Mobile-responsive design

## Troubleshooting

**Build fails?**
- Check if all files are in your GitHub repo
- Ensure `package.json` has correct scripts

**Database connection error?**
- Verify DATABASE_URL is set correctly
- Check PostgreSQL service is running

**App won't start?**
- Check build logs in Render dashboard
- Verify environment variables are set

Your app will be live at: `https://your-app-name.onrender.com`