const emailAgent = require('./agent');
const { classifyEmail, saveClassification, loadRules } = require('./pipeline');
const { classifyWithLlm, classificationSchema } = require('./classifier');
const { summarizeEmailContent } = require('./summarizer');
const { EMAIL_CATEGORIES, AI_INBOX_CATEGORIES } = require('./constants');
const {
  wrapUntrustedEmailContent,
  guardLlmOutput,
  EMAIL_DATA_ONLY_PROMPT,
} = require('./security/promptGuard');

module.exports = {
  emailAgent,
  classifyEmail,
  saveClassification,
  loadRules,
  classifyWithLlm,
  classificationSchema,
  summarizeEmailContent,
  EMAIL_CATEGORIES,
  AI_INBOX_CATEGORIES,
  wrapUntrustedEmailContent,
  guardLlmOutput,
  EMAIL_DATA_ONLY_PROMPT,
};
