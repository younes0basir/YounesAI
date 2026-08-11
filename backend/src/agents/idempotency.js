const pool = require('../db');
const crypto = require('crypto');

// 10 minutes — handles retries on slow/flaky mobile connections
const IDEMPOTENCY_WINDOW = '10 minutes';

/**
 * Check if this request_id was already processed within the window.
 * Returns the existing record row or null.
 */
async function checkIdempotency(context, table) {
  if (!context.requestId) return null;

  try {
    const result = await pool.query(
      `SELECT * FROM ${table}
       WHERE request_id = $1
         AND user_id = $2
         AND created_at > NOW() - INTERVAL '${IDEMPOTENCY_WINDOW}'
       LIMIT 1`,
      [context.requestId, context.userId]
    );
    return result.rowCount > 0 ? result.rows[0] : null;
  } catch (err) {
    // Column doesn't exist yet on this table — silently skip
    if (
      err.message.includes('request_id') ||
      err.message.includes('column') ||
      err.message.includes('does not exist')
    ) {
      console.warn(`[Idempotency] Check skipped for table "${table}": ${err.message}`);
      return null;
    }
    throw err;
  }
}

/**
 * Generate a deterministic request_id from user + action + message content.
 * Used when the client doesn't provide one, preventing AI-triggered duplicates
 * when the same message is retried.
 *
 * @param {string} userId
 * @param {string} message  - raw user message
 * @param {string} agentAction - e.g. 'create_task', 'create_event'
 * @returns {string} UUID-length hex string
 */
function generateMessageHash(userId, message, agentAction) {
  return crypto
    .createHash('sha256')
    .update(`${userId}:${agentAction}:${message.trim().toLowerCase()}`)
    .digest('hex')
    .substring(0, 36);
}

module.exports = { checkIdempotency, generateMessageHash };
