const pool = require('../../db');
const { extractDomain } = require('../rules/engine');

const ACTION_CATEGORY_MAP = {
  mark_important: 'IMPORTANT',
  archive: 'NEWSLETTER',
  mute: 'SPAM',
  delete: 'SPAM',
};

async function getSenderProfile(userId, fromAddress) {
  if (!fromAddress) return null;
  const result = await pool.query(
    `SELECT * FROM sender_profiles WHERE user_id = $1 AND sender_address = $2`,
    [userId, fromAddress.toLowerCase()]
  );
  return result.rows[0] || null;
}

async function learnFromAction(userId, email, actionType) {
  const fromAddress = (email.from_address || '').toLowerCase();
  const domain = extractDomain(fromAddress);
  if (!fromAddress) return;

  const preferredCategory = ACTION_CATEGORY_MAP[actionType] || email.category || 'UNKNOWN';

  await pool.query(
    `INSERT INTO sender_profiles
       (user_id, sender_address, sender_domain, preferred_category, action_counts, total_actions, confidence, last_seen_at)
     VALUES ($1, $2, $3, $4, jsonb_build_object($5::text, 1), 1, 0.3, NOW())
     ON CONFLICT (user_id, sender_address) DO UPDATE SET
       sender_domain = EXCLUDED.sender_domain,
       preferred_category = CASE
         WHEN sender_profiles.total_actions >= 3 THEN sender_profiles.preferred_category
         ELSE EXCLUDED.preferred_category
       END,
       action_counts = sender_profiles.action_counts || jsonb_build_object(
         $5, COALESCE((sender_profiles.action_counts->>$5)::int, 0) + 1
       ),
       total_actions = sender_profiles.total_actions + 1,
       confidence = LEAST(0.95, sender_profiles.confidence + 0.05),
       last_seen_at = NOW(),
       updated_at = NOW()`,
    [userId, fromAddress, domain, preferredCategory, actionType]
  );
}

async function predictFromLearning(userId, fromAddress) {
  const profile = await getSenderProfile(userId, fromAddress);
  if (!profile || profile.confidence < 0.3) return null;
  return {
    category: profile.preferred_category || 'UNKNOWN',
    confidence: profile.confidence,
    evidence: {
      senderAddress: profile.sender_address,
      senderDomain: profile.sender_domain,
      totalActions: profile.total_actions,
      actionCounts: profile.action_counts,
    },
  };
}

module.exports = { learnFromAction, predictFromLearning, getSenderProfile };
