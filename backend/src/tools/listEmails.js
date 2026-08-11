const pool = require('../db');

async function listEmails({ userId, category, accountId, limit = 20, offset = 0 }) {
  const where = ['e.user_id = $1'];
  const params = [userId];
  let idx = 2;

  if (category) {
    where.push(`ec.category = $${idx++}`);
    params.push(category);
  }
  if (accountId) {
    where.push(`e.account_id = $${idx++}`);
    params.push(accountId);
  }

  params.push(limit, offset);
  const result = await pool.query(
    `SELECT e.id, e.subject, e.from_address, e.from_name, e.snippet, e.received_at,
            ec.category, ec.confidence, ec.source AS classification_source
     FROM emails e
     LEFT JOIN email_classifications ec ON ec.email_id = e.id
     WHERE ${where.join(' AND ')}
     ORDER BY e.received_at DESC NULLS LAST
     LIMIT $${idx++} OFFSET $${idx}`,
    params
  );
  return { success: true, emails: result.rows, count: result.rowCount };
}

module.exports = listEmails;
