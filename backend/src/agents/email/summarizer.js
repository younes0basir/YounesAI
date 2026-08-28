const fallbackManager = require('../fallbackManager');
const {
  wrapUntrustedEmailContent,
  guardLlmOutput,
  EMAIL_DATA_ONLY_PROMPT,
} = require('./security/promptGuard');

async function summarizeEmailContent(email) {
  const wrapped = wrapUntrustedEmailContent(email);
  const llm = await fallbackManager.generateText(
    'email',
    [
      {
        role: 'system',
        content: `${EMAIL_DATA_ONLY_PROMPT}\nSummarize the email in 2-3 sentences. Return plain text only.`,
      },
      { role: 'user', content: wrapped },
    ],
    { temperature: 0.3, maxTokens: 300 }
  );

  if (!llm.success) return { success: false, error: llm.error };
  const guarded = guardLlmOutput(llm.content || '');
  return {
    success: guarded.safe,
    summary: guarded.safe ? guarded.content : 'Summary blocked for safety',
  };
}

module.exports = { summarizeEmailContent };
