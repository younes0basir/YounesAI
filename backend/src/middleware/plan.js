const { normalizeTier, getPlanLimits } = require('../plans/config');
const { checkQuota, incrementUsage } = require('../services/usageService');

function attachUsageHeaders(res, quota) {
  if (!quota) return;
  res.setHeader('X-RateLimit-Limit', String(quota.limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, quota.limit - quota.used)));
  res.setHeader('X-RateLimit-Reset', quota.resetsAt);
}

function quotaErrorPayload(quota) {
  if (quota.reason === 'feature_not_available') {
    return {
      error: 'feature_not_available',
      feature: quota.feature,
      plan: quota.plan,
      upgradeUrl: '/plans',
    };
  }

  return {
    error: 'quota_exceeded',
    feature: quota.feature,
    used: quota.used,
    limit: quota.limit,
    plan: quota.plan,
    resetsAt: quota.resetsAt,
    upgradeUrl: '/plans',
  };
}

function enforceQuota(feature) {
  return async (req, res, next) => {
    try {
      const tier = normalizeTier(req.user?.plan);
      const quota = await checkQuota(req.user.id, tier, feature);

      attachUsageHeaders(res, quota);

      if (!quota.allowed) {
        const status = quota.reason === 'feature_not_available' ? 403 : 429;
        return res.status(status).json(quotaErrorPayload(quota));
      }

      req.quota = quota;
      next();
    } catch (err) {
      next(err);
    }
  };
}

function requirePlan(allowedTiers) {
  const allowed = new Set(allowedTiers.map(normalizeTier));
  return (req, res, next) => {
    const tier = normalizeTier(req.user?.plan);
    if (!allowed.has(tier)) {
      return res.status(403).json({
        error: 'feature_not_available',
        plan: tier,
        requiredPlans: [...allowed],
        upgradeUrl: '/plans',
      });
    }
    next();
  };
}

function requirePremiumAgents(req, res, next) {
  const tier = normalizeTier(req.user?.plan);
  if (!getPlanLimits(tier).premium_agents) {
    return res.status(403).json({
      error: 'feature_not_available',
      feature: 'premium_agents',
      plan: tier,
      upgradeUrl: '/plans',
    });
  }
  next();
}

async function incrementUsageAfterSuccess(req, feature) {
  if (!req.user?.id) return;
  await incrementUsage(req.user.id, feature);
}

module.exports = {
  enforceQuota,
  requirePlan,
  requirePremiumAgents,
  attachUsageHeaders,
  incrementUsageAfterSuccess,
  quotaErrorPayload,
};
