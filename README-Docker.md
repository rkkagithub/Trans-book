# TransBook - Docker Setup

This guide explains how to run TransBook locally using Docker.

## Prerequisites

- Docker installed on your machine
- Docker Compose installed

## Quick Start

1. **Clone or copy the project files to your local machine**

2. **Build and run with Docker Compose:**
   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - Open your browser and go to: `http://localhost:5000`

## Configuration

### Environment Variables

Before running, you may want to customize these environment variables in `docker-compose.yml`:

- `SESSION_SECRET`: Change this to a secure random string
- `DATABASE_URL`: PostgreSQL connection string (auto-configured)
- `REPLIT_DOMAINS`: Set to your domain for production

### Database

The setup includes:
- PostgreSQL 15 database
- Automatic database initialization
- Persistent data storage

## Available Commands

```bash
# Start the application
docker-compose up

# Start in background
docker-compose up -d

# Rebuild and start
docker-compose up --build

# Stop the application
docker-compose down

# View logs
docker-compose logs

# Stop and remove all data
docker-compose down -v
```

## Troubleshooting

### Port Already in Use
If port 5000 or 5432 is already in use, modify the ports in `docker-compose.yml`:

```yaml
ports:
  - "3000:5000"  # Change 5000 to another port
```

### Database Connection Issues
Ensure PostgreSQL container is running:
```bash
docker-compose ps
docker-compose logs postgres
```

### Authentication Issues
For local development, the Replit Auth system may not work as expected. The application will show a landing page for unauthenticated users.

## Production Deployment

For production:

1. Update environment variables in `docker-compose.yml`
2. Use a secure `SESSION_SECRET`
3. Configure proper domain settings
4. Set up SSL/TLS certificates
5. Use a production-ready PostgreSQL setup

## Application Features

Once running, TransBook includes:

- **Customer Management**: Add and manage customer information
- **Vehicle Fleet**: Track vehicles and their details
- **Driver Management**: Manage driver information and licenses
- **Trip Planning**: Schedule and track trips
- **Invoice Generation**: Create invoices with GST calculations
- **Expense Tracking**: Record business expenses
- **Dashboard**: View business metrics and analytics

## Development

The Dockerfile uses multi-stage builds for optimized production images. The application runs on Node.js with Express backend and React frontend.