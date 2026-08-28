# Multi-stage build for production
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S sagittarius -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --production && \
    npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./

# Change ownership to non-root user
RUN chown -R sagittarius:nodejs /app

# Switch to non-root user
USER sagittarius

# Expose port
EXPOSE 8081

# Environment
ENV NODE_ENV=production
ENV PORT=8081

# Health check (issue #7): probe /health and require status ok + HTTP 200.
# /health returns 503 + status "degraded" when the JMAP backend is down,
# so the container turns unhealthy exactly when mail is broken.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:8081/health', (r) => { let d=''; r.on('data', (c) => d += c); r.on('end', () => { if (r.statusCode === 200) process.exit(0); console.error('health:', r.statusCode, d); process.exit(1); }); }).on('error', () => process.exit(1))"

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Start the server
CMD ["node", "server.js"]
