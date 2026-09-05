FROM node:20-alpine

WORKDIR /app

# Force fresh build (invalidate cache)
RUN echo "Build timestamp: $(date)"

# Copy package files
COPY package*.json ./

# Install dependencies with clean cache
RUN npm cache clean --force && npm ci --only=production && npm install tsx

# Copy source code
COPY src ./src
COPY db ./db
COPY public ./public

# Expose port
EXPOSE 3001

# Set environment
ENV NODE_ENV=production
ENV PORT=3001
ENV CACHE_BUST=1

# Clean up any old build artifacts
RUN rm -rf dist

# Start the server
CMD ["npx", "tsx", "src/backend/server.ts"]
