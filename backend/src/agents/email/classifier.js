const Joi = require('joi');
const fallbackManager = require('../fallbackManager');
const { EMAIL_CATEGORIES } = require('./constants');
const {
  wrapUntrustedEmailContent,
  guardLlmOutput,
  EMAIL_DATA_ONLY_PROMPT,
} = require('./security/promptGuard');

const classificationSchema = Joi.object({
  category: Joi.string()
    .valid(...EMAIL_CATEGORIES)
    .required(),
  confidence: Joi.number().min(0).max(1).default(0.5),
  reasoning: Joi.string().max(1000).default(''),
  signals: Joi.array().items(Joi.string().max(200)).default([]),
});

const SYSTEM_PROMPT = `${EMAIL_DATA_ONLY_PROMPT}

Classify the email into exactly one category:
IMPORTANT, ACTION_REQUIRED, PERSONAL, NEWSLETTER, PROMOTION, SPAM, UNKNOWN

Return ONLY valid JSON:
{
  "category": "IMPORTANT|ACTION_REQUIRED|PERSONAL|NEWSLETTER|PROMOTION|SPAM|UNKNOWN",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "signals": ["signal1", "signal2"]
}`;

async function classifyWithLlm(email) {
  const wrapped = wrapUntrustedEmailContent(email);
  const result = await fallbackManager.generateText(
    'email',
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: wrapped },
    ],
    { temperature: 0.2, maxTokens: 400, json: true }
  );

  if (!result.success) {
    return {
      category: 'UNKNOWN',
      confidence: 0.1,
      source: 'llm',
      evidence: { error: result.error, reasoning: 'LLM classification failed' },
    };
  }

  const guarded = guardLlmOutput(result.content);
  if (!guarded.safe) {
    return {
      category: 'UNKNOWN',
      confidence: 0.1,
      source: 'llm',
      evidence: { blocked: true, reasoning: guarded.content },
    };
  }

  let parsed;
  try {
    const jsonMatch = result.content.match(/\{[\s\S]*\}/);
    parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result.content);
  } catch {
    return {
      category: 'UNKNOWN',
      confidence: 0.2,
      source: 'llm',
      evidence: { reasoning: 'Failed to parse LLM JSON', raw: result.content?.slice(0, 200) },
    };
  }

  const { error, value } = classificationSchema.validate(parsed, { stripUnknown: true });
  if (error) {
    return {
      category: 'UNKNOWN',
      confidence: 0.2,
      source: 'llm',
      evidence: { validationError: error.message },
    };
  }

  return {
    category: value.category,
    confidence: value.confidence,
    source: 'llm',
    evidence: {
      reasoning: value.reasoning,
      signals: value.signals,
    },
  };
}

module.exports = { classifyWithLlm, classificationSchema };
