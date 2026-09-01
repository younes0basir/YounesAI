const pool = require('../db');
const {
  normalizeTier,
  getFeatureLimit,
  getPlanLimits,
  getUsageColumn,
  FEATURE_LIMIT_KEY,
} = require('../plans/config');

function getUtcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function getNextResetAt(date = new Date()) {
  const next = new Date(date);
  next.setUTCHours(24, 0, 0, 0);
  return next.toISOString();
}

async function getUsageRow(userId, periodDate = getUtcDateString()) {
  const result = await pool.query(
    `SELECT ai_chat_count, voice_count, image_count
     FROM usage_counters
     WHERE user_id = $1 AND period_date = $2`,
    [userId, periodDate]
  );
  if (!result.rowCount) {
    return { ai_chat_count: 0, voice_count: 0, image_count: 0 };
  }
  return result.rows[0];
}

function buildUsageSummary(tier, row) {
  const limits = getPlanLimits(tier);
  const usage = {};

  for (const [feature, limitKey] of Object.entries(FEATURE_LIMIT_KEY)) {
    const column = getUsageColumn(feature);
    const used = row[column] ?? 0;
    const limit = limits[limitKey] ?? 0;
    usage[feature] = { used, limit };
  }

  return { usage, limits };
}

async function getUsage(userId, tier) {
  const row = await getUsageRow(userId);
  return buildUsageSummary(normalizeTier(tier), row);
}

async function checkQuota(userId, tier, feature) {
  const normalizedTier = normalizeTier(tier);
  const limit = getFeatureLimit(normalizedTier, feature);

  if (limit <= 0) {
    return {
      allowed: false,
      used: 0,
      limit: 0,
      plan: normalizedTier,
      feature,
      resetsAt: getNextResetAt(),
      reason: 'feature_not_available',
    };
  }

  const row = await getUsageRow(userId);
  const column = getUsageColumn(feature);
  const used = row[column] ?? 0;

  return {
    allowed: used < limit,
    used,
    limit,
    plan: normalizedTier,
    feature,
    resetsAt: getNextResetAt(),
    reason: used >= limit ? 'quota_exceeded' : null,
  };
}

async function incrementUsage(userId, feature) {
  const column = getUsageColumn(feature);
  if (!column) {
    throw new Error(`Unknown usage feature: ${feature}`);
  }

  const periodDate = getUtcDateString();
  const result = await pool.query(
    `INSERT INTO usage_counters (user_id, period_date, ${column})
     VALUES ($1, $2, 1)
     ON CONFLICT (user_id, period_date)
     DO UPDATE SET ${column} = usage_counters.${column} + 1
     RETURNING ai_chat_count, voice_count, image_count`,
    [userId, periodDate]
  );
  return result.rows[0];
}

module.exports = {
  getUtcDateString,
  getNextResetAt,
  getUsage,
  checkQuota,
  incrementUsage,
  buildUsageSummary,
};
