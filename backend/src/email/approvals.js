const pool = require('../db');
const {
  archiveEmail,
  deleteEmail,
  markImportant,
  muteSender,
} = require('../integrations/gmail/actions');

const BATCH_APPROVAL_THRESHOLD = 1;

async function createApproval(userId, actionType, emailIds, summary) {
  const result = await pool.query(
    `INSERT INTO email_approvals (user_id, action_type, status, payload, summary)
     VALUES ($1, $2, 'pending', $3, $4)
     RETURNING *`,
    [userId, actionType, JSON.stringify({ emailIds }), summary]
  );
  return result.rows[0];
}

async function listPending(userId) {
  const result = await pool.query(
    `SELECT * FROM email_approvals WHERE user_id = $1 AND status = 'pending' ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

async function resolveApproval(userId, approvalId, approve) {
  const result = await pool.query(
    `SELECT * FROM email_approvals WHERE id = $1 AND user_id = $2 AND status = 'pending'`,
    [approvalId, userId]
  );
  if (result.rowCount === 0) throw new Error('Approval not found or already resolved');
  const approval = result.rows[0];
  const emailIds = approval.payload?.emailIds || [];

  if (!approve) {
    await pool.query(
      `UPDATE email_approvals SET status = 'rejected', resolved_at = NOW() WHERE id = $1`,
      [approvalId]
    );
    return { status: 'rejected', executed: 0 };
  }

  const executors = {
    archive: archiveEmail,
    delete: deleteEmail,
    mark_important: markImportant,
    mute_sender: muteSender,
  };
  const fn = executors[approval.action_type];
  if (!fn) throw new Error(`Unknown action type: ${approval.action_type}`);

  let executed = 0;
  for (const emailId of emailIds) {
    try {
      await fn(userId, emailId, 'ai');
      executed += 1;
    } catch (err) {
      console.error(`[Approvals] Failed ${approval.action_type} on ${emailId}:`, err.message);
    }
  }

  await pool.query(
    `UPDATE email_approvals SET status = 'approved', resolved_at = NOW() WHERE id = $1`,
    [approvalId]
  );
  return { status: 'approved', executed };
}

async function executeOrRequestApproval(userId, actionType, emailIds) {
  if (emailIds.length <= BATCH_APPROVAL_THRESHOLD) {
    const executors = {
      archive: archiveEmail,
      delete: deleteEmail,
      mark_important: markImportant,
      mute_sender: muteSender,
    };
    const fn = executors[actionType];
    if (!fn) throw new Error(`Unknown action type: ${actionType}`);
    const results = [];
    for (const id of emailIds) {
      results.push(await fn(userId, id, emailIds.length > 1 ? 'ai' : 'user'));
    }
    return { requiresApproval: false, results };
  }

  const summary = `AI wants to ${actionType.replace('_', ' ')} ${emailIds.length} email(s)`;
  const approval = await createApproval(userId, actionType, emailIds, summary);
  return { requiresApproval: true, approval };
}

module.exports = {
  createApproval,
  listPending,
  resolveApproval,
  executeOrRequestApproval,
  BATCH_APPROVAL_THRESHOLD,
};
