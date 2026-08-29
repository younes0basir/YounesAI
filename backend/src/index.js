require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const app = require('./app');
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// ── Scheduler (local/dev only — Vercel serverless uses its own Cron) ─────────
if (!process.env.VERCEL) {
  const { startScheduler } = require('./scheduler');
  startScheduler();
}

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
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
process.on('SIGINT', () => shutdown('SIGINT'));
