const fallbackManager = require('./fallbackManager');
const { logAgentCall } = require('./metricsLogger');
const { prefixWithSourceCheck } = require('./context');
const tools = require('../tools');

class MemoryAgent {
  constructor() {
    this.systemPrompt = `You are a memory agent. Extract memory intent from the user message.

Rules:
- If the user wants to REMEMBER something ("remember that", "store that", "save this", "I like", "my favorite"), ALWAYS set action to "store" with the text to remember.
- If the user asks about what you know ("what do you know", "what do you remember", "do you remember", "what did I say", "search memories", "recall"), ALWAYS set action to "search" with a query.
- NEVER respond with "I need more details" or action "chat" when memory store/search is intended.

Return ONLY valid JSON:
{
  "action": "store" | "search" | "chat",
  "text": "text to store or search query",
  "response": "text response if chat"
}

Examples:
- "remember that I like sushi" → { "action": "store", "text": "I like sushi" }
- "save my birthday is 25 july" → { "action": "store", "text": "birthday is 25 July" }
- "what do you know about me" → { "action": "search", "text": "about me" }
- "do you remember my favorite color" → { "action": "search", "text": "favorite color" }
- "hello" → { "action": "chat", "response": "Hi! I can remember things for you." }

Only use action "chat" if the message is purely conversational with zero memory intent.`;
  }

  async run(context) {
    const start = Date.now();
    try {
      const result = await fallbackManager.generateText('memory', [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: `Message: "${context.message}"\nContext: ${JSON.stringify({ userId: context.userId })}\n\nRecent conversation:\n${context.recentMessages?.length > 0 ? context.recentMessages.map((m) => `${m.role}: "${m.content}"`).join('\n') : '(no prior messages)'}` }
      ], { temperature: 0.3, maxTokens: 500, json: true });

      if (!result.success) throw new Error(result.error);
      let parsed = this.parseResponse(result.content, context.message);
      if (context.action) parsed.action = context.action;
      if (context.parameters?.text) parsed.text = context.parameters.text;

      if (parsed.action === 'store' && parsed.text) {
        await tools.storeMemory(context, parsed.text);
        await logAgentCall({ agentName: 'memory', provider: result.provider, latency: Date.now() - start, success: true, context });
        return { success: true, content: prefixWithSourceCheck(`Got it! I've remembered: "${parsed.text}"`, context, ['memory store result']), metadata: { provider: result.provider, model: result.model } };
      }

      if (parsed.action === 'search' && parsed.text) {
        const searchResult = await tools.retrieveMemory(context, parsed.text);
        await logAgentCall({ agentName: 'memory', provider: result.provider, latency: Date.now() - start, success: true, context });
        const count = searchResult.results.length;
        const summary = count === 0 ? 'No relevant memories found.' : `Found ${count} relevant memory/ies:\n${searchResult.results.map((r) => `- ${r.content}`).join('\n')}`;
        return { success: true, content: prefixWithSourceCheck(summary, context, ['memory search result']), metadata: { provider: result.provider, model: result.model } };
      }

      await logAgentCall({ agentName: 'memory', provider: result.provider, latency: Date.now() - start, success: true, context });
      return { success: true, content: prefixWithSourceCheck(parsed.response || result.content, context, ['memory agent reasoning']), metadata: { provider: result.provider, model: result.model } };
    } catch (error) {
      await logAgentCall({ agentName: 'memory', latency: Date.now() - start, success: false, error: error.message, context });
      return { success: false, error: error.message };
    }
  }

  parseResponse(content, originalMessage = '') {
    // 1. Try JSON extraction
    try {
      let cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.action || parsed.text !== undefined) {
          // CRITICAL: If the LLM returned action='chat' but the user's message
          // clearly has memory store/search intent, override with the fallback parser.
          if (parsed.action === 'chat') {
            const fallback = this.fallbackParse(originalMessage || content);
            if (fallback && fallback.action !== 'chat') {
              console.log('[MemoryAgent] LLM returned action=chat but memory intent detected — overriding:', JSON.stringify(fallback));
              return fallback;
            }
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[MemoryAgent] JSON parse failed, trying fallback:', e.message);
    }

    // 2. Fallback: detect memory intent from natural language
    const fallback = this.fallbackParse(originalMessage || content);
    if (fallback) return fallback;

    // 3. Last resort: treat as chat
    return { action: 'chat', response: content };
  }

  fallbackParse(message) {
    const lower = (message || '').toLowerCase();
    if (/(?:remember|store|save|memorize|note\s+that|keep\s+in\s+mind)/.test(lower)) {
      const match = message.match(/(?:remember|store|save|memorize|note\s+that|keep\s+in\s+mind)\s+(?:that\s+)?(.+)/i);
      const text = match ? match[1].trim() : message;
      return { action: 'store', text };
    }
    if (/(?:what do you know|what do you remember|do you remember|recall|search\s+memor|what did i say)/.test(lower)) {
      const match = message.match(/(?:what do you know|what do you remember|do you remember|recall|search\s+memor|what did i say)\s+(?:about\s+|that\s+)?(.+)/i);
      const text = match ? match[1].trim() : message;
      return { action: 'search', text };
    }
    return null;
  }
}

module.exports = new MemoryAgent();
