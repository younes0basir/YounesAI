const pool = require('../db');
const fallbackManager = require('../agents/fallbackManager');
const { wrapUntrustedEmailContent, guardLlmOutput, EMAIL_DATA_ONLY_PROMPT } = require('../email/security/promptGuard');

async function summarizeEmail({ userId, emailId }) {
  const result = await pool.query(
    'SELECT * FROM emails WHERE id = $1 AND user_id = $2',
    [emailId, userId]
  );
  if (result.rowCount === 0) {
    return { success: false, error: 'Email not found' };
  }

  const wrapped = wrapUntrustedEmailContent(result.rows[0]);
  const llm = await fallbackManager.generateText('email', [
    { role: 'system', content: `${EMAIL_DATA_ONLY_PROMPT}\nSummarize the email in 2-3 sentences. Return plain text only.` },
    { role: 'user', content: wrapped },
  ], { temperature: 0.3, maxTokens: 300 });

  if (!llm.success) return { success: false, error: llm.error };
  const guarded = guardLlmOutput(llm.content || '');
  return {
    success: guarded.safe,
    summary: guarded.safe ? guarded.content : 'Summary blocked for safety',
  };
}

module.exports = summarizeEmail;
