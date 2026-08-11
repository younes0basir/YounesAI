const fallbackManager = require('./fallbackManager');
const { logAgentCall } = require('./metricsLogger');
const { buildSystemPromptContext, prefixWithSourceCheck } = require('./context');

class GeneralAgent {
  async run(context) {
    const start = Date.now();
    try {
      const contextSummary = buildSystemPromptContext(context);
      const identity = `email: ${context.email || 'not available'}${context.name ? `, name: ${context.name}` : ''}`;

      const systemContent = `You are the general-purpose assistant for this AI system. You handle everything that doesn't fit task/event/place/file/memory agents.

Before every answer, perform a context check and name the exact source categories you relied on. If no source context is available, say so explicitly rather than guessing.

IDENTITY — You KNOW the user's identity: ${identity}. Answer these naturally:
- "who am I", "who is logged in" → state email${context.name ? ' and name' : ''}
- "what is my email" → state email
- "what is my name" → state name${context.name ? '' : ' (say not set)'}
- "what is my user ID" → state user ID
- "tell me about myself" → summarize (email${context.name ? ', name' : ''})

CURRENT CONTEXT:
${contextSummary}

GENERAL — Answer conversational questions helpfully:
- "what can you do", "what are your capabilities" → explain: multi-agent AI with task/event/place/file/memory agents, chat, voice
- Greetings → greet back naturally
- Casual chat → respond playfully
- General knowledge → answer concisely (without making up facts)
- "what's the weather" → say you don't have live weather access

Be concise, natural, and helpful.`;

      const result = await fallbackManager.generateText('general', [
        { role: 'system', content: systemContent },
        { role: 'user', content: context.message },
      ], { temperature: 0.5, maxTokens: 500 });

      const tokensUsed = result.usage?.total_tokens || 0;
      await logAgentCall({ agentName: 'general', provider: result.provider, model: result.model, latency: Date.now() - start, success: result.success, tokensUsed, context });

      if (result.success) {
        return {
          success: true,
          content: prefixWithSourceCheck(result.content, context, ['general chat context']),
          metadata: { agent: 'general', provider: result.provider, model: result.model }
        };
      }
    } catch (e) {
      console.error('[GeneralAgent] Error:', e.message);
      await logAgentCall({ agentName: 'general', latency: Date.now() - start, success: false, error: e.message, context });
    }
    // Last-resort fallback: echo the message
    return {
      success: true,
      content: prefixWithSourceCheck('I\'m here to help. Could you rephrase your question?', context, ['general fallback']),
      metadata: { agent: 'general' }
    };
  }
}

module.exports = new GeneralAgent();
