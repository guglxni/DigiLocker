# Multi-stage build: builder → runtime
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Install only production dependencies (clean)
RUN rm -rf node_modules && npm ci --omit=dev --ignore-scripts

# Production stage
FROM node:20-alpine AS runtime
WORKDIR /app

# Install curl for healthcheck
RUN apk add --no-cache curl

# Copy built application and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Set production environment
ENV NODE_ENV=production
ENV PORT=3007

# Expose the port
EXPOSE 3007

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD curl -f http://localhost:${PORT}/health || exit 1

# Start the application
CMD ["node", "dist/main.js"] 