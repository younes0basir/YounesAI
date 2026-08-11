const rateLimit = require('express-rate-limit');

/**
 * Auth endpoints — strict: 20 attempts per 15 minutes per IP
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many authentication attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
});

/**
 * General API — 120 req/min, keyed per authenticated user (fallback: IP)
 */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  message: { error: 'Rate limit exceeded. Please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => req.user?.id || req.ip || req.connection.remoteAddress,
});

/**
 * AI Agent endpoints — 30 req/min per user (AI calls are expensive)
 */
const agentLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'AI rate limit exceeded. Please wait before sending more messages.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  keyGenerator: (req) => req.user?.id || req.ip || req.connection.remoteAddress,
});

module.exports = { authLimiter, apiLimiter, agentLimiter };
