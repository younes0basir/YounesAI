const PLAN_TIERS = ['starter', 'pro', 'platinum'];

const PLANS = {
  starter: {
    label: 'Starter',
    ai_chat_daily: parseInt(process.env.PLAN_STARTER_AI_DAILY || '10', 10),
    voice_daily: 0,
    image_daily: 0,
    gmail_accounts: 1,
    premium_agents: false,
    agent_rate_limit_per_min: 5,
  },
  pro: {
    label: 'Pro',
    ai_chat_daily: parseInt(process.env.PLAN_PRO_AI_DAILY || '100', 10),
    voice_daily: parseInt(process.env.PLAN_PRO_VOICE_DAILY || '20', 10),
    image_daily: parseInt(process.env.PLAN_PRO_IMAGE_DAILY || '10', 10),
    gmail_accounts: 2,
    premium_agents: true,
    agent_rate_limit_per_min: 20,
  },
  platinum: {
    label: 'Platinum',
    ai_chat_daily: parseInt(process.env.PLAN_PLATINUM_AI_DAILY || '500', 10),
    voice_daily: parseInt(process.env.PLAN_PLATINUM_VOICE_DAILY || '100', 10),
    image_daily: parseInt(process.env.PLAN_PLATINUM_IMAGE_DAILY || '50', 10),
    gmail_accounts: 5,
    premium_agents: true,
    agent_rate_limit_per_min: 30,
  },
};

const FEATURE_COLUMN = {
  ai_chat: 'ai_chat_count',
  voice: 'voice_count',
  image: 'image_count',
};

const FEATURE_LIMIT_KEY = {
  ai_chat: 'ai_chat_daily',
  voice: 'voice_daily',
  image: 'image_daily',
};

function normalizeTier(tier) {
  const normalized = String(tier || 'starter').toLowerCase();
  if (PLANS[normalized]) return normalized;
  return 'starter';
}

function getPlanLimits(tier) {
  return { ...PLANS[normalizeTier(tier)] };
}

function getFeatureLimit(tier, feature) {
  const limits = getPlanLimits(tier);
  const key = FEATURE_LIMIT_KEY[feature];
  if (!key) return 0;
  return limits[key] ?? 0;
}

function canUseFeature(tier, feature) {
  const limit = getFeatureLimit(tier, feature);
  return limit > 0;
}

function getAgentRateLimit(tier) {
  return getPlanLimits(tier).agent_rate_limit_per_min;
}

function getMaxGmailAccounts(tier) {
  return getPlanLimits(tier).gmail_accounts;
}

function getPlanCatalog() {
  return PLAN_TIERS.map((tier) => ({
    tier,
    label: PLANS[tier].label,
    limits: {
      ai_chat_daily: PLANS[tier].ai_chat_daily,
      voice_daily: PLANS[tier].voice_daily,
      image_daily: PLANS[tier].image_daily,
      gmail_accounts: PLANS[tier].gmail_accounts,
      premium_agents: PLANS[tier].premium_agents,
      agent_rate_limit_per_min: PLANS[tier].agent_rate_limit_per_min,
    },
  }));
}

function getUsageColumn(feature) {
  return FEATURE_COLUMN[feature];
}

module.exports = {
  PLAN_TIERS,
  PLANS,
  normalizeTier,
  getPlanLimits,
  getFeatureLimit,
  canUseFeature,
  getAgentRateLimit,
  getMaxGmailAccounts,
  getPlanCatalog,
  getUsageColumn,
  FEATURE_LIMIT_KEY,
};
