const pool = require('../db');
const { applyRules } = require('./rules/engine');
const { predictFromLearning } = require('./learning/senderProfiles');
const { classifyWithLlm } = require('./classifier');

async function loadRules(userId) {
  const result = await pool.query(
    `SELECT * FROM email_rules WHERE user_id = $1 AND is_active = TRUE ORDER BY priority DESC`,
    [userId]
  );
  return result.rows;
}

async function saveClassification(emailId, userId, result) {
  await pool.query(
    `INSERT INTO email_classifications (email_id, user_id, category, confidence, source, evidence)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (email_id) DO UPDATE SET
       category = EXCLUDED.category,
       confidence = EXCLUDED.confidence,
       source = EXCLUDED.source,
       evidence = EXCLUDED.evidence,
       updated_at = NOW()`,
    [emailId, userId, result.category, result.confidence, result.source, JSON.stringify(result.evidence || {})]
  );
}

async function classifyEmail(userId, email) {
  const rules = await loadRules(userId);

  const ruleResult = applyRules(rules, email);
  if (ruleResult.matched && ruleResult.category) {
    const result = {
      category: ruleResult.category,
      confidence: 0.95,
      source: 'rule',
      evidence: ruleResult.evidence,
    };
    await saveClassification(email.id, userId, result);
    return result;
  }

  const learning = await predictFromLearning(userId, email.from_address);
  if (learning && learning.confidence >= 0.5) {
    const result = {
      category: learning.category,
      confidence: learning.confidence,
      source: 'learning',
      evidence: learning.evidence,
    };
    await saveClassification(email.id, userId, result);
    return result;
  }

  const llmResult = await classifyWithLlm(email);
  await saveClassification(email.id, userId, llmResult);
  return llmResult;
}

module.exports = { classifyEmail, saveClassification, loadRules };
