# Ultra-simple, no-bullshit Dockerfile that just works
FROM node:20-alpine

# Install curl
RUN apk add --no-cache curl

WORKDIR /app

# Copy everything
COPY . .

# Install all dependencies (no pruning bullshit)
RUN npm install

# Build
RUN npm run build

# Environment
ENV NODE_ENV=production
ENV PORT=10000
ENV HOST=0.0.0.0

# Expose port
EXPOSE 10000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:10000/api/health || exit 1

# Start
CMD ["npm", "start"]