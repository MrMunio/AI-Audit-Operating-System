# =============================================================================
# Multi-stage Dockerfile for AI Audit Operating System (AI Audit OS)
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build Frontend and Backend Assets
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies needed for build
COPY package*.json ./
RUN npm ci

# Copy configuration and source files
COPY tsconfig.json vite.config.ts index.html ./
COPY src/ ./src/
COPY server.ts ./

# Build production client bundle and server bundle
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Minimal Production Runtime
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built distribution bundles from builder stage
COPY --from=builder /app/dist ./dist

# Copy system default configurations
COPY src/config/systemConfig.json ./src/config/systemConfig.json

# Expose application port
EXPOSE 3000

# Lightweight healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/config || exit 1

# Start the Node.js production server
CMD ["npm", "start"]
