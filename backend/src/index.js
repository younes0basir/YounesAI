const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const { authLimiter, apiLimiter, agentLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Security ──────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8081'],
  credentials: true,
}));

// Body size limit — prevents DoS via huge payloads
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ── Rate Limiting ─────────────────────────────────────────────────────────────
app.use('/api/auth',   authLimiter);
app.use('/api/agents', agentLimiter);
app.use('/api',        apiLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
const healthRouter  = require("./routes/health");
const apiRouter     = require('./routes/api');
const authRouter    = require('./routes/auth');
const agentsRouter  = require('./routes/agents');
const evaluationRouter = require('./routes/evaluation');
const monitoringRouter = require('./routes/monitoring');
const gmailRouter = require('./routes/integrations/gmail');
const emailRouter = require('./routes/email');
const swaggerRouter = require('./swagger');

app.use("/api/health", healthRouter);
app.use('/api/auth',   authRouter);
app.use('/api',        apiRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/evaluation', evaluationRouter);
app.use('/api/monitoring', monitoringRouter);
app.use('/api/integrations/gmail', gmailRouter);
app.use('/api/email', emailRouter);
app.use('/api/docs',   swaggerRouter);

// ── Scheduler ─────────────────────────────────────────────────────────────────
const { startScheduler } = require('./scheduler');
startScheduler();

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

async function shutdown(signal) {
  console.log(`\n[${signal}] Graceful shutdown initiated...`);
  server.close(async () => {
    try {
      const pool = require('./db');
      await pool.end();
      console.log('[Shutdown] DB pool closed. Goodbye.');
    } catch (err) {
      console.error('[Shutdown] Error closing DB pool:', err.message);
    }
    process.exit(0);
  });
  // Force exit after 10s if graceful close hangs
  setTimeout(() => {
    console.error('[Shutdown] Forced exit after timeout.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
