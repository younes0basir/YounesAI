# ── Railway deployment ─────────────────────────────────────────────────────────
# Deploy this backend as a long-running Node service on Railway (root dir:
# backend/). The container listens on $PORT and keeps the in-process scheduler
# (node-cron) alive, which the serverless deploys could not do.

FROM node:20-slim

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# Install production dependencies first for better layer caching.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the rest of the app.
COPY . .

EXPOSE 3000

# Railway polls the exposed port; the health endpoint also verifies DB access.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))" || exit 1

CMD ["node", "src/index.js"]