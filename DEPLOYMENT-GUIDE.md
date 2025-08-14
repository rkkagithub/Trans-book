# TransBook - Free Cloud Deployment Guide

Deploy your TransBook application to free cloud platforms. Here are the best options with step-by-step instructions.

## 🚀 Quick Deployment Options

### 1. Railway (Recommended - Easiest)

**Features:** Free tier includes 512MB RAM, $5 monthly credit, PostgreSQL database

**Steps:**
1. Push your code to GitHub
2. Go to [Railway.app](https://railway.app)
3. Click "Start a New Project" → "Deploy from GitHub repo"
4. Select your TransBook repository
5. Railway will automatically detect the Dockerfile and deploy
6. Add a PostgreSQL database: "New" → "Database" → "PostgreSQL"
7. Set environment variables in the Variables tab:
   ```
   DATABASE_URL: (automatically set by Railway)
   SESSION_SECRET: (generate a random string)
   REPLIT_DOMAINS: your-app.railway.app
   REPL_ID: railway-deployment
   ISSUER_URL: https://replit.com/oidc
   ```

### 2. Render

**Features:** Free tier includes 512MB RAM, automatic SSL, PostgreSQL database

**Steps:**
1. Push your code to GitHub
2. Go to [Render.com](https://render.com)
3. Click "New" → "Web Service"
4. Connect your GitHub repository
5. Use these settings:
   - **Build Command:** `docker build -t transbook .`
   - **Start Command:** `docker run -p 10000:$PORT transbook`
   - **Environment:** Docker
6. Add a PostgreSQL database: "New" → "PostgreSQL"
7. Set environment variables:
   ```
   DATABASE_URL: (copy from PostgreSQL service)
   SESSION_SECRET: (generate a random string)
   REPLIT_DOMAINS: your-app.onrender.com
   REPL_ID: render-deployment
   ISSUER_URL: https://replit.com/oidc
   ```

### 3. Fly.io

**Features:** Free tier includes 256MB RAM, 3GB storage, global deployment

**Steps:**
1. Install Fly CLI: `curl -L https://fly.io/install.sh | sh`
2. Sign up: `flyctl auth signup`
3. In your project directory: `flyctl launch`
4. Fly will detect the `fly.toml` file and configure automatically
5. Add PostgreSQL: `flyctl postgres create`
6. Set environment variables:
   ```bash
   flyctl secrets set SESSION_SECRET=your-secret-here
   flyctl secrets set DATABASE_URL=your-postgres-url
   flyctl secrets set REPLIT_DOMAINS=your-app.fly.dev
   ```
7. Deploy: `flyctl deploy`

### 4. Cyclic

**Features:** Serverless deployment, automatic scaling, MongoDB integration

**Steps:**
1. Push code to GitHub
2. Go to [Cyclic.sh](https://cyclic.sh)
3. Connect GitHub and select your repository
4. Cyclic will deploy automatically using the Dockerfile
5. Add environment variables in the dashboard

## 🔧 Environment Variables Guide

All platforms need these environment variables:

```bash
# Required
DATABASE_URL=postgresql://username:password@host:port/database
SESSION_SECRET=your-very-secure-random-string-here

# Platform-specific
REPLIT_DOMAINS=your-domain.platform.com
REPL_ID=cloud-deployment
ISSUER_URL=https://replit.com/oidc

# Optional
NODE_ENV=production
PORT=5000  # Usually set automatically by platform
```

## 📊 Platform Comparison

| Platform | RAM | Storage | Database | SSL | Custom Domain |
|----------|-----|---------|----------|-----|---------------|
| Railway  | 512MB | 1GB | PostgreSQL | ✅ | ✅ |
| Render   | 512MB | 1GB | PostgreSQL | ✅ | ✅ |
| Fly.io   | 256MB | 3GB | PostgreSQL | ✅ | ✅ |
| Cyclic   | Serverless | 1GB | MongoDB | ✅ | ✅ |

## 🗄️ Database Setup

### For Railway/Render (PostgreSQL):
1. Create the database through the platform
2. Copy the DATABASE_URL
3. The application will auto-create tables on first run

### For Fly.io:
```bash
flyctl postgres create --name transbook-db
flyctl postgres attach transbook-db
```

## 🔍 Troubleshooting

### Build Issues:
- Ensure your GitHub repository has all files including `Dockerfile`
- Check build logs for missing dependencies
- Verify Node.js version compatibility

### Database Connection:
- Confirm DATABASE_URL is correctly set
- Check database service is running
- Verify network connectivity between services

### Authentication Issues:
- Update REPLIT_DOMAINS to match your deployed domain
- Ensure SESSION_SECRET is set and secure
- Check REPL_ID matches your configuration

### Health Check Failures:
- Verify `/api/health` endpoint is accessible
- Check application is binding to `0.0.0.0` not `localhost`
- Ensure PORT environment variable is used correctly

## 🎯 Recommended: Railway Deployment

Railway offers the easiest setup with these advantages:
- Automatic Docker detection
- One-click PostgreSQL database
- Simple environment variable management
- Free tier perfect for small applications
- Excellent documentation and support

## 🔗 Post-Deployment

After successful deployment:
1. Test the application at your new URL
2. Set up monitoring and alerts
3. Configure backups for your database
4. Update DNS if using custom domain
5. Set up CI/CD for automatic deployments

Your TransBook application will be fully functional with all features:
- Customer management
- Vehicle tracking
- Driver management
- Trip planning
- Invoice generation
- Expense tracking
- Business analytics dashboard