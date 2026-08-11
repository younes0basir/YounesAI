const fallbackManager = require('./fallbackManager');
const { logAgentCall } = require('./metricsLogger');
const { generateMessageHash } = require('./idempotency');
const { buildSystemPromptContext, prefixWithSourceCheck } = require('./context');
const { parseTemporal } = require('../utils/temporalUtility');
const { applyExtractedTitle, extractNamedTitle } = require('../utils/titleUtility');
const tools = require('../tools');

const EVENT_ACTIONS = new Set(['create', 'update', 'delete', 'list', 'chat']);

class EventAgent {
  constructor() {
    this.systemPrompt = `You are a calendar event agent. Extract event details from the user's message and return JSON.

Rules:
- If the user expresses ANY event intent ("create event", "new event", "schedule", "add event", "meeting on X"), ALWAYS set action to "create" with whatever info is available. NEVER respond with "I need more details" or action "chat" when creation is intended.
- Default title to "Untitled Event" if none provided.
- If pre-parsed temporal parameters are provided in the context (e.g., parsedDate / startsAt), prioritize using them directly for starts_at and calculate ends_at relative to that starts_at (default +1 hour).
- Default starts_at to now + 1 hour if missing, ends_at to starts_at + 1 hour if missing.
- For UPDATE or DELETE: the user context below lists upcoming events with their IDs like [id=UUID]. You MUST copy the exact UUID from the context into "eventId". If the user refers to an event by title, match it against the upcoming events list.
- If no matching event is found in the context for update/delete, set action to "chat" and explain that the event was not found.

Return ONLY valid JSON:
{
  "action": "create" | "update" | "delete" | "list" | "chat",
  "event": {
    "title": "extracted title or 'Untitled Event'",
    "description": null,
    "starts_at": "ISO datetime or null",
    "ends_at": "ISO datetime or null",
    "is_all_day": false,
    "color": "#3b82f6",
    "location_text": null
  },
  "eventId": "exact UUID from the upcoming events list if updating/deleting, otherwise null",
  "response": "text if chat action"
}

Examples:
- "create event" → { "action": "create", "event": { "title": "Untitled Event", "starts_at": null, "ends_at": null } }
- "schedule team meeting for 2026-06-26T15:00:00.000Z" → { "action": "create", "event": { "title": "Team meeting", "starts_at": "2026-06-26T15:00:00.000Z", "ends_at": "2026-06-26T16:00:00.000Z" } }
- "create event for 15 this month named allo" → { "action": "create", "event": { "title": "allo", "starts_at": "<ISO date from context>" } }
- "cancel the team meeting" → { "action": "delete", "eventId": "<uuid from context>" }
- "reschedule the meeting to 4pm" → { "action": "update", "eventId": "<uuid from context>", "event": { "starts_at": "...", "ends_at": "..." } }
- "show my events" or "list events" → { "action": "list" }

Only use action "chat" if the message is purely conversational with zero event intent.`;
  }

  async run(context) {
    const start = Date.now();
    try {
      const contextSummary = buildSystemPromptContext(context);
      const sourceMessage = context.originalMessage || context.message;
      const userContent = `Message: "${context.message}"\nOriginal message: "${sourceMessage}"\nUser Context:\n${contextSummary}\n\nRecent conversation:\n${
        context.recentMessages?.length > 0
          ? context.recentMessages.map((m) => `${m.role}: "${m.content}"`).join('\n')
          : '(no prior messages)'
      }`;

      const result = await fallbackManager.generateText('event', [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userContent },
      ], { temperature: 0.3, maxTokens: 600, json: true });

      if (!result.success) throw new Error(result.error);
      let parsed = this.parseResponse(result.content, sourceMessage);
      if (context.action && EVENT_ACTIONS.has(context.action)) {
        parsed.action = context.action;
      }
      applyExtractedTitle(parsed.event, ['Untitled Event'], context.message, sourceMessage);
      if (context.parameters?.startsAt && parsed.event) {
        parsed.event.starts_at = context.parameters.startsAt;
        if (!parsed.event.ends_at) {
          const startsAt = new Date(context.parameters.startsAt);
          parsed.event.ends_at = new Date(startsAt.getTime() + 60 * 60 * 1000).toISOString();
        }
      }
      const tokensUsed = result.usage?.total_tokens || 0;
      let actionResult;

      switch (parsed.action) {
        case 'create':
          if (!context.requestId) {
            context.requestId = generateMessageHash(context.userId, context.message, 'create_event');
          }
          actionResult = await tools.createEvent(context, parsed.event);
          await logAgentCall({ agentName: 'event', provider: result.provider, model: result.model, latency: Date.now() - start, success: true, tokensUsed, context });
          if (actionResult.idempotent) return { success: true, content: prefixWithSourceCheck(`Event already created (duplicate request prevented): "${actionResult.event.title}".`, context, ['event tool output']), metadata: { provider: result.provider, model: result.model } };
          const eventDateInfo = actionResult.event.starts_at ? ` at ${new Date(actionResult.event.starts_at).toLocaleString()}` : '';
          return { success: true, content: prefixWithSourceCheck(`Event created successfully: "${actionResult.event.title}"${eventDateInfo} (id: ${actionResult.event.id}).`, context, ['event tool output']), metadata: { provider: result.provider, model: result.model } };

        case 'list':
          actionResult = await tools.listEvents(context, parsed.filters || {});
          await logAgentCall({ agentName: 'event', provider: result.provider, model: result.model, latency: Date.now() - start, success: true, tokensUsed, context });
          const events = actionResult.events || [];
          const eventSummary = events.length === 0
            ? 'No upcoming events found.'
            : `Found ${events.length} event(s):\n${events.map((e) => `- ${e.title} at ${new Date(e.starts_at).toLocaleString()}`).join('\n')}`;
          return { success: true, content: prefixWithSourceCheck(eventSummary, context, ['event tool output']), metadata: { provider: result.provider, model: result.model } };

        case 'update':
          if (!parsed.eventId) {
            await logAgentCall({ agentName: 'event', provider: result.provider, model: result.model, latency: Date.now() - start, success: false, error: 'No eventId provided', context });
            return { success: true, content: prefixWithSourceCheck('I could not identify which event to update. Please specify the event name or show your events first.', context, ['event agent reasoning']), metadata: { provider: result.provider, model: result.model } };
          }
          actionResult = await tools.updateEvent(context, parsed.eventId, parsed.event);
          await logAgentCall({ agentName: 'event', provider: result.provider, model: result.model, latency: Date.now() - start, success: actionResult.success, tokensUsed, context });
          return { success: true, content: prefixWithSourceCheck(actionResult.success ? `Event updated.` : `Event not found.`, context, ['event tool output']), metadata: { provider: result.provider, model: result.model } };

        case 'delete':
          if (!parsed.eventId) {
            await logAgentCall({ agentName: 'event', provider: result.provider, model: result.model, latency: Date.now() - start, success: false, error: 'No eventId provided', context });
            return { success: true, content: prefixWithSourceCheck('I could not identify which event to delete. Please specify the event name or show your events first.', context, ['event agent reasoning']), metadata: { provider: result.provider, model: result.model } };
          }
          actionResult = await tools.deleteEvent(context, parsed.eventId);
          await logAgentCall({ agentName: 'event', provider: result.provider, model: result.model, latency: Date.now() - start, success: actionResult.success, tokensUsed, context });
          return { success: true, content: prefixWithSourceCheck(actionResult.success ? `Event deleted.` : `Event not found.`, context, ['event tool output']), metadata: { provider: result.provider, model: result.model } };

        default:
          await logAgentCall({ agentName: 'event', provider: result.provider, model: result.model, latency: Date.now() - start, success: true, tokensUsed, context });
          return { success: true, content: prefixWithSourceCheck(parsed.response || result.content, context, ['event agent reasoning']), metadata: { provider: result.provider, model: result.model } };
      }
    } catch (error) {
      await logAgentCall({ agentName: 'event', latency: Date.now() - start, success: false, error: error.message, context });
      return { success: false, error: error.message };
    }
  }

  parseResponse(content, originalMessage = '') {
    // 1. Try to extract and parse valid JSON from the LLM response
    try {
      let cleaned = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.action || parsed.event || parsed.response !== undefined) {
          // CRITICAL: If the LLM returned action='chat' but the user's message
          // clearly has event creation intent, override with the fallback parser.
          if (parsed.action === 'chat') {
            const fallback = this.fallbackParse(originalMessage || content);
            if (fallback && fallback.action !== 'chat') {
              console.log('[EventAgent] LLM returned action=chat but creation intent detected — overriding:', JSON.stringify(fallback));
              return fallback;
            }
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[EventAgent] JSON parse failed, trying fallback parser:', e.message);
    }

    // 2. Fallback: detect event intent from natural language
    const fallback = this.fallbackParse(originalMessage || content);
    if (fallback) {
      console.log('[EventAgent] Using fallback parser result:', JSON.stringify(fallback));
      return fallback;
    }

    // 3. Last resort: treat as chat
    return { action: 'chat', response: content };
  }

  fallbackParse(message) {
    const lower = message.toLowerCase();

    // Check for list intent
    if (/\b(?:show|list|display|get|see)\s+(?:my\s+)?(?:events?|meetings?)\b/i.test(lower)) {
      return { action: 'list', filters: {} };
    }

    // Check for creation intent
    const hasCreateIntent = /(?:create|schedule|add|new)\s+(?:an?\s+)?(?:event|meeting)/i.test(lower)
      || /(?:schedule|meet)\s+/i.test(lower)
      || /meeting\s+on/i.test(lower);

    if (!hasCreateIntent) return null;

    // Extract title
    let title = extractNamedTitle(message) || 'Untitled Event';

    // Extract start time using temporal utility
    let startsAt = null;
    let endsAt = null;
    try {
      const temporal = parseTemporal(message, new Date());
      if (temporal.success && temporal.parsedDate) {
        startsAt = temporal.parsedDate;
        endsAt = new Date(new Date(startsAt).getTime() + 60 * 60 * 1000).toISOString();
      }
    } catch {}

    // Default to now + 1 hour if no time found
    if (!startsAt) {
      startsAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    }

    return {
      action: 'create',
      event: {
        title,
        description: null,
        starts_at: startsAt,
        ends_at: endsAt,
        is_all_day: false,
        color: '#3b82f6',
        location_text: null,
      },
      eventId: null,
      response: null,
    };
  }
}

module.exports = new EventAgent();
