const { describe, it, mock } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeTier,
  getFeatureLimit,
  canUseFeature,
  getAgentRateLimit,
  getMaxGmailAccounts,
  getPlanCatalog,
} = require('../src/plans/config');
const { buildUsageSummary } = require('../src/services/usageService');

describe('plans config', () => {
  it('normalizes unknown tiers to starter', () => {
    assert.equal(normalizeTier(undefined), 'starter');
    assert.equal(normalizeTier('invalid'), 'starter');
    assert.equal(normalizeTier('PRO'), 'pro');
  });

  it('returns tier-specific AI limits', () => {
    assert.equal(getFeatureLimit('starter', 'ai_chat'), 10);
    assert.equal(getFeatureLimit('pro', 'ai_chat'), 100);
    assert.equal(getFeatureLimit('platinum', 'ai_chat'), 500);
  });

  it('blocks voice and image on starter', () => {
    assert.equal(canUseFeature('starter', 'voice'), false);
    assert.equal(canUseFeature('starter', 'image'), false);
    assert.equal(canUseFeature('pro', 'voice'), true);
    assert.equal(canUseFeature('pro', 'image'), true);
  });

  it('increases agent rate limits by tier', () => {
    assert.equal(getAgentRateLimit('starter'), 5);
    assert.equal(getAgentRateLimit('pro'), 20);
    assert.equal(getAgentRateLimit('platinum'), 30);
  });

  it('sets gmail account caps by tier', () => {
    assert.equal(getMaxGmailAccounts('starter'), 1);
    assert.equal(getMaxGmailAccounts('pro'), 2);
    assert.equal(getMaxGmailAccounts('platinum'), 5);
  });

  it('exports plan catalog for paywall UI', () => {
    const catalog = getPlanCatalog();
    assert.equal(catalog.length, 3);
    assert.equal(catalog[0].tier, 'starter');
    assert.ok(catalog[1].limits.voice_daily > 0);
  });
});

describe('usage summary', () => {
  it('builds usage objects from counter row', () => {
    const { usage, limits } = buildUsageSummary('starter', {
      ai_chat_count: 3,
      voice_count: 0,
      image_count: 0,
    });

    assert.deepEqual(usage.ai_chat, { used: 3, limit: 10 });
    assert.equal(usage.voice.limit, 0);
    assert.equal(limits.ai_chat_daily, 10);
  });

  it('reflects pro tier limits in summary', () => {
    const { usage } = buildUsageSummary('pro', {
      ai_chat_count: 50,
      voice_count: 5,
      image_count: 2,
    });

    assert.deepEqual(usage.ai_chat, { used: 50, limit: 100 });
    assert.deepEqual(usage.voice, { used: 5, limit: 20 });
    assert.deepEqual(usage.image, { used: 2, limit: 10 });
  });
});

describe('checkQuota', () => {
  it('blocks starter voice with feature_not_available reason', async () => {
    const pool = require('../src/db');
    const originalQuery = pool.query;
    pool.query = mock.fn(async () => ({ rowCount: 0, rows: [] }));

    try {
      const { checkQuota } = require('../src/services/usageService');
      const result = await checkQuota('user-1', 'starter', 'voice');
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'feature_not_available');
      assert.equal(result.limit, 0);
    } finally {
      pool.query = originalQuery;
    }
  });

  it('blocks when daily ai_chat quota is exhausted', async () => {
    const pool = require('../src/db');
    const originalQuery = pool.query;
    pool.query = mock.fn(async () => ({
      rowCount: 1,
      rows: [{ ai_chat_count: 10, voice_count: 0, image_count: 0 }],
    }));

    try {
      const { checkQuota } = require('../src/services/usageService');
      const result = await checkQuota('user-1', 'starter', 'ai_chat');
      assert.equal(result.allowed, false);
      assert.equal(result.reason, 'quota_exceeded');
      assert.equal(result.used, 10);
      assert.equal(result.limit, 10);
    } finally {
      pool.query = originalQuery;
    }
  });

  it('allows requests under the daily limit', async () => {
    const pool = require('../src/db');
    const originalQuery = pool.query;
    pool.query = mock.fn(async () => ({
      rowCount: 1,
      rows: [{ ai_chat_count: 4, voice_count: 0, image_count: 0 }],
    }));

    try {
      const { checkQuota } = require('../src/services/usageService');
      const result = await checkQuota('user-1', 'starter', 'ai_chat');
      assert.equal(result.allowed, true);
      assert.equal(result.reason, null);
    } finally {
      pool.query = originalQuery;
    }
  });
});

describe('admin plan validation', () => {
  it('accepts valid plan tiers only', () => {
    const { PLAN_TIERS } = require('../src/plans/config');
    assert.deepEqual(PLAN_TIERS, ['starter', 'pro', 'platinum']);
    assert.equal(normalizeTier('platinum'), 'platinum');
  });
});
