const fallbackManager = require('./fallbackManager');
const { logAgentCall } = require('./metricsLogger');
const { prefixWithSourceCheck } = require('./context');
const tools = require('../tools');

class PlaceAgent {
  constructor() {
    this.systemPrompt = `You are a location agent. Extract place search intent from the user message.

Rules:
- If the user asks about ANY location/place/address ("find places", "search for X", "where is", "places near", "restaurants", "cafes", etc.), ALWAYS set action to "search" with a query. NEVER respond with "I need more details" or action "chat" when a location is requested.
- Extract a concise search query from the message.

Return ONLY valid JSON:
{
  "action": "search" | "chat",
  "query": "concise search query for places",
  "response": "text response if chat"
}

Examples:
- "find coffee shops" → { "action": "search", "query": "coffee shops" }
- "where is the nearest hospital" → { "action": "search", "query": "nearest hospital" }
- "places near me" → { "action": "search", "query": "places near me" }
- "hello" → { "action": "chat", "response": "Hello! How can I help you find places?" }

Only use action "chat" if the message is purely conversational with zero place/location intent.`;
  }

  async run(context) {
    const start = Date.now();
    try {
      const result = await fallbackManager.generateText('place', [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: `Message: "${context.message}"\nContext: ${JSON.stringify({ userId: context.userId })}\n\nRecent conversation:\n${context.recentMessages?.length > 0 ? context.recentMessages.map((m) => `${m.role}: "${m.content}"`).join('\n') : '(no prior messages)'}` }
      ], { temperature: 0.3, maxTokens: 500 });

      if (!result.success) throw new Error(result.error);
      let parsed = this.parseResponse(result.content);
      if (context.action) parsed.action = context.action;
      if (context.parameters?.query) parsed.query = context.parameters.query;

      if (parsed.action === 'search' && parsed.query) {
        const searchResult = await tools.searchPlaces(context, parsed.query);
        await logAgentCall({ agentName: 'place', provider: result.provider, latency: Date.now() - start, success: true, context });
        const count = searchResult.places.length;
        const summary = count === 0 ? 'No places found.' : `Found ${count} place(s):\n${searchResult.places.map((p) => `- ${p.name}${p.address ? ` (${p.address})` : ''}`).join('\n')}`;
        return { success: true, content: prefixWithSourceCheck(summary, context, ['place search results']), metadata: { provider: result.provider, model: result.model } };
      }

      await logAgentCall({ agentName: 'place', provider: result.provider, latency: Date.now() - start, success: true, context });
      return { success: true, content: prefixWithSourceCheck(parsed.response || result.content, context, ['place agent reasoning']), metadata: { provider: result.provider, model: result.model } };
    } catch (error) {
      await logAgentCall({ agentName: 'place', latency: Date.now() - start, success: false, error: error.message, context });
      return { success: false, error: error.message };
    }
  }

  parseResponse(content) {
    try { const m = content.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch {}
    return { action: 'chat', response: content };
  }
}

module.exports = new PlaceAgent();
