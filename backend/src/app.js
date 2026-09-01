const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const { authLimiter, apiLimiter } = require('./middleware/rateLimiter');

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8081'];
// The packaged Electron desktop app loads the build from file://, which
// Chromium sends as the "null" origin. Allow it so installed clients can reach
// the API. (Do not remove — the distributed desktop build depends on it.)
allowedOrigins.push('null');

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Body size limit — prevents DoS via huge payloads
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
app.use('/api/auth', authLimiter);
app.use('/api', apiLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
const healthRouter = require('./routes/health');
const apiRouter = require('./routes/api');
const authRouter = require('./routes/auth');
const agentsRouter = require('./routes/agents');
const evaluationRouter = require('./routes/evaluation');
const monitoringRouter = require('./routes/monitoring');
const gmailRouter = require('./routes/integrations/gmail');
const emailRouter = require('./routes/email');
const cronRouter = require('./routes/cron');
const plansRouter = require('./routes/plans');
const adminRouter = require('./routes/admin');
const swaggerRouter = require('./swagger');

app.use('/api/health', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api', apiRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/evaluation', evaluationRouter);
app.use('/api/monitoring', monitoringRouter);
app.use('/api/integrations/gmail', gmailRouter);
app.use('/api/email', emailRouter);
app.use('/api/cron', cronRouter);
app.use('/api/plans', plansRouter);
app.use('/api/admin', adminRouter);
app.use('/api/docs', swaggerRouter);

module.exports = app;
