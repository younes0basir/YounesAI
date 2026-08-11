const fallbackManager = require('./fallbackManager');
const { logAgentCall } = require('./metricsLogger');
const { prefixWithSourceCheck } = require('./context');

class OrchestratorAgent {
  constructor() {
    this.systemPrompt = `You are a central orchestrator for a multi-agent AI system.

Before returning a routing decision, check the user request against the available context and be explicit about which source categories influenced the routing. Never invent missing context.

Your role:
1. Analyze the user's natural language request.
2. Determine which specialized agents should handle it (can call MULTIPLE agents in parallel).
3. If a request involves time or dates (e.g., "in 10 minutes", "tomorrow at 3pm", "next Monday", "three days later", "in 3 days", "next week", "later today"), identify the agent AND set "needs_parsing": true, along with the original "raw_message". Do NOT attempt to calculate or parse the datetime yourself.
4. Extract parameters.

Available agents:
- task: Task management, creation, updates, status, priorities, deadlines, reminders ("remind me", "set a reminder", "add a reminder")
- event: Calendar events, scheduling, time-based operations
- place: Locations, addresses, coordinates, map queries
- file: File operations, document analysis, content extraction
- memory: Information storage, retrieval, semantic search
- general: General conversation, greetings, everyday Q&A, identity questions, and non-specialized chat
- desktop: Local desktop file operations, recursive folder scanning, local document search, opening files natively, reading/indexing local PDF, DOCX, TXT, CSV documents
- image: Image generation from text prompts using NVIDIA FLUX.2 Klein
- email: Email inbox management, classification, archiving, summarization, Gmail integration
- gemma: Advanced reasoning, deeper synthesis, and fallback reasoning when a specialist route is not sufficient or a task is best handled with broader inference

Respond in JSON format with this structure:
{
  "agents": [
    {
      "agent": "agent_name",
      "action": "specific_action",
      "needs_parsing": true/false,
      "raw_message": "original query or part of query related to this agent",
      "parameters": {},
      "reasoning": "why this agent is needed"
    }
  ],
  "reasoning": "overall analysis"
}

Examples:
- "Create a task to buy groceries tomorrow" →
  { "agents": [{ "agent": "task", "action": "process", "needs_parsing": true, "raw_message": "Create a task to buy groceries tomorrow", "parameters": {}, "reasoning": "Create a task with temporal reference" }] }
- "Remind me tomorrow at 4 to call Younes" →
  { "agents": [{ "agent": "task", "action": "process", "needs_parsing": true, "raw_message": "Remind me tomorrow at 4 to call Younes", "parameters": {}, "reasoning": "Reminder is a time-bound task" }] }
- "Add a reminder to pay rent on the 1st" →
  { "agents": [{ "agent": "task", "action": "process", "needs_parsing": true, "raw_message": "Add a reminder to pay rent on the 1st", "parameters": {}, "reasoning": "Reminder is a time-bound task" }] }
- "Schedule a meeting for tomorrow at 3pm" →
  { "agents": [{ "agent": "event", "action": "process", "needs_parsing": true, "raw_message": "Schedule a meeting for tomorrow at 3pm", "parameters": {}, "reasoning": "Schedule calendar event with temporal reference" }] }
- "What files do I have about the project?" →
  { "agents": [{ "agent": "file", "action": "process", "needs_parsing": false, "raw_message": "What files do I have about the project?", "parameters": {}, "reasoning": "Search project files" }] }
- "What folders are indexed?" or "Show indexed folders" →
  { "agents": [{ "agent": "file", "action": "getIndexedFolders", "needs_parsing": false, "raw_message": "What folders are indexed?", "parameters": {}, "reasoning": "Retrieve list of indexed folders" }] }
- "How many folders are indexed?" →
  { "agents": [{ "agent": "file", "action": "getIndexedFolderCount", "needs_parsing": false, "raw_message": "How many folders are indexed?", "parameters": {}, "reasoning": "Count indexed folders" }] }
- "What files are indexed?" or "Which files are indexed?" →
  { "agents": [{ "agent": "file", "action": "getIndexedFiles", "needs_parsing": false, "raw_message": "What files are indexed?", "parameters": {}, "reasoning": "Retrieve list of indexed files" }] }
- "How many documents are indexed?" or "document count" →
  { "agents": [{ "agent": "file", "action": "getIndexedDocumentCount", "needs_parsing": false, "raw_message": "How many documents are indexed?", "parameters": {}, "reasoning": "Count total chunks of indexed documents" }] }
- "Show folder statistics" or "file statistics" →
  { "agents": [{ "agent": "file", "action": "getFolderStatistics", "needs_parsing": false, "raw_message": "Show folder statistics", "parameters": {}, "reasoning": "Retrieve database folder statistics" }] }
- "Find all PDF invoices" →
  { "agents": [{ "agent": "desktop", "action": "process", "needs_parsing": false, "raw_message": "Find all PDF invoices", "parameters": {}, "reasoning": "Search local invoices" }] }
- "Scan C:\\Users\\Documents" or "Index folder C:\\Projects" →
  { "agents": [{ "agent": "desktop", "action": "process", "needs_parsing": false, "raw_message": "Scan C:\\Users\\Documents", "parameters": {}, "reasoning": "Scan and index local folder" }] }
- "What's in C:\\Downloads" or "List files in C:\\Documents" →
  { "agents": [{ "agent": "desktop", "action": "process", "needs_parsing": false, "raw_message": "What's in C:\\Downloads", "parameters": {}, "reasoning": "List folder contents" }] }
- "Generate an image of a wolf in evernight" or "Draw a futuristic city" →
  { "agents": [{ "agent": "image", "action": "process", "needs_parsing": false, "raw_message": "Generate an image of a wolf in evernight", "parameters": {}, "reasoning": "Image generation from text prompt" }] }

Identity/profile questions ("who am I", "what is my email/name/id", "tell me about myself", "what do you know about me") → route to "general" agent, NOT task/event/place/file/memory.

Content search queries about document text ("find documents about budget", "what does the contract say about payment", "search files for pricing info", "find invoices about payment terms", "what documents mention API") → route to "file" agent.
- "Find documents about the budget" → { "agents": [{ "agent": "file", "action": "process", "needs_parsing": false, "raw_message": "Find documents about the budget", "parameters": {}, "reasoning": "Search document contents for budget" }] }
- "What does my document about pricing say?" → { "agents": [{ "agent": "file", "action": "process", "needs_parsing": false, "raw_message": "What does my document about pricing say?", "parameters": {}, "reasoning": "Search document contents for pricing" }] }

General conversational questions ("what can you do", "how does this work", "tell me a joke", "what's the weather", general knowledge, greetings like "hello" or "hi") → route to "general" agent.

Reasoning-heavy or synthesis-heavy prompts ("compare these options", "give me a structured plan", "summarize tradeoffs", "reason through this design", "what should I prioritize") may use "gemma" when broader analysis is needed beyond a specialist route.

If the request doesn't need any specific agent, respond with a single "general" agent.`;
  }

  async processRequest(context) {
    const start = Date.now();
    try {
      const messages = [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: `User request: "${context.message}"\n\nUser context: ${JSON.stringify({ userId: context.userId, email: context.email })}\n\nRecent conversation history:\n${context.recentMessages?.length > 0 ? context.recentMessages.map((m) => `${m.role}: "${m.content}"`).join('\n') : '(no prior messages)'}` }
      ];

      const result = await fallbackManager.generateText('orchestrator', messages, {
        temperature: 0.3, maxTokens: 800
      });

      if (!result.success) throw new Error(`Orchestrator failed: ${result.error}`);

      const parsed = this.parseRoutingResponse(result.content);
      await logAgentCall({ agentName: 'orchestrator', provider: result.provider, latency: Date.now() - start, success: true, context });

      return {
        success: true,
        agents: parsed.agents || [parsed],
        metadata: { provider: result.provider, model: result.model, usage: result.usage }
      };
    } catch (error) {
      await logAgentCall({ agentName: 'orchestrator', latency: Date.now() - start, success: false, error: error.message, context });
      return {
        success: false,
        error: error.message,
        fallbackRouting: this.getFallbackRouting(context.message)
      };
    }
  }

  parseRoutingResponse(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const normalize = (name) => ({ task_agent: 'task', event_agent: 'event', place_agent: 'place', file_agent: 'file', memory_agent: 'memory', desktop_agent: 'desktop' })[name] || name;
        if (parsed.agents) parsed.agents.forEach((r) => { r.agent = normalize(r.agent); });
        else if (parsed.agent) parsed.agent = normalize(parsed.agent);
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse routing response:', e);
    }
    return { agents: [{ agent: 'general', action: 'chat', parameters: {}, reasoning: 'Fallback parsing' }] };
  }

  getFallbackRouting(message) {
    const lower = message.toLowerCase();
    const agents = [];

    // Detect temporal expressions so the coordinator can pre-parse dates
    // even when the orchestrator LLM fails and we fall back to keyword routing.
    const hasTemporal = /\b(?:tomorrow|today|tonight|yesterday|next (?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|in \d+ (?:minutes?|hours?|days?|weeks?|months?)|\d+ (?:days?|weeks?|months?) (?:later|from now)|this (?:week|month|weekend)|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|at \d|\d\s*(?:am|pm|o'clock))\b/i.test(message);

    // Prioritize administrative files questions routing
    if (/indexed folder|monitored folder|folders are indexed|show indexed folders/.test(lower)) {
      if (/count|how many/.test(lower)) {
        agents.push({ agent: 'file', action: 'getIndexedFolderCount', parameters: { message }, reasoning: 'Fallback: count folders' });
      } else {
        agents.push({ agent: 'file', action: 'getIndexedFolders', parameters: { message }, reasoning: 'Fallback: show folders' });
      }
    } else if (/indexed file|files are indexed|document count|how many document|statistics|recent document|indexed document|folder statistics/.test(lower)) {
      if (/count|how many/.test(lower)) {
        agents.push({ agent: 'file', action: 'getIndexedDocumentCount', parameters: { message }, reasoning: 'Fallback: count docs' });
      } else if (/recent/.test(lower)) {
        agents.push({ agent: 'file', action: 'getRecentIndexedFiles', parameters: { message }, reasoning: 'Fallback: recent docs' });
      } else if (/statistics/.test(lower)) {
        agents.push({ agent: 'file', action: 'getFolderStatistics', parameters: { message }, reasoning: 'Fallback: statistics' });
      } else {
        agents.push({ agent: 'file', action: 'getIndexedFiles', parameters: { message }, reasoning: 'Fallback: show files' });
      }
    } else if (/task|todo|priority|deadline|remind|reminder/.test(lower)) {
      agents.push({ agent: 'task', action: 'process', needs_parsing: hasTemporal, raw_message: message, parameters: {}, reasoning: 'Keyword: task/reminder' + (hasTemporal ? ' (temporal detected)' : '') });
    } else if (/event|calendar|schedule|meeting/.test(lower)) {
      agents.push({ agent: 'event', action: 'process', needs_parsing: hasTemporal, raw_message: message, parameters: {}, reasoning: 'Keyword: event' + (hasTemporal ? ' (temporal detected)' : '') });
    } else if (/place|location|address|map/.test(lower)) {
      agents.push({ agent: 'place', action: 'process', parameters: { message }, reasoning: 'Keyword: place' });
    } else if (/desktop|scan|folder|local file|document_embeddings|open file|index folder|contract|pdf|docx|csv|txt|invoice|add folder|scan folder|list folder|what's in|list files in/.test(lower)) {
      agents.push({ agent: 'desktop', action: 'process', parameters: { message }, reasoning: 'Keyword: desktop' });
    } else if (/inbox|gmail|email|archive email|my emails|newsletter/.test(lower)) {
      agents.push({ agent: 'email', action: 'process', parameters: { message }, reasoning: 'Keyword: email/inbox' });
    } else if (/generate an image|draw an image|create an image|make an image|image of|draw .+|image generation/.test(lower)) {
      agents.push({ agent: 'image', action: 'process', parameters: { message }, reasoning: 'Keyword: image generation' });
    } else if (/file|document|upload|save/.test(lower)) {
      agents.push({ agent: 'file', action: 'process', parameters: { message }, reasoning: 'Keyword: file' });
    } else if (/remember|recall|memory|memorize|what do you know|what did I say|search my memory|store that|save that/.test(lower)) {
      agents.push({ agent: 'memory', action: 'process', parameters: { message }, reasoning: 'Keyword: memory' });
    }
    
    if (agents.length === 0) agents.push({ agent: 'general', action: 'chat', parameters: { message }, reasoning: 'No specific agent identified' });
    return agents;
  }

  async formatFinalResponse(userMessage, agentResults, originalMetadata, userContext = {}) {
    const parts = agentResults
      .filter((r) => r.success)
      .map((r) => `[${r.agent.toUpperCase()}]: ${r.content}`)
      .join('\n\n');

    const failed = agentResults.filter((r) => !r.success);
    const errorNote = failed.length
      ? `\n\nFailed agents:\n${failed.map((r) => `- ${r.agent}: ${r.error || 'unknown error'}`).join('\n')}`
      : '';
    const identityNote = `User identity: email=${userContext.email || 'unknown'}${userContext.name ? `, name=${userContext.name}` : ''}`;

    // Pass through image data from agent results
    const imageResult = agentResults.find((r) => r.success && r.image);
    const imagePayload = imageResult ? { image: imageResult.image } : {};

    try {
      const result = await fallbackManager.generateText('orchestrator', [
        { role: 'system', content: `Combine agent outputs into a single concise, natural response. CRITICAL: only report what the agent outputs actually say — never claim an action succeeded if the agent reported a failure or error. Include the actual results (or error details if something failed). ${identityNote}` },
        { role: 'user', content: `Original: "${userMessage}"\n\nAgent outputs:\n${parts}${errorNote}\n\nSynthesize a response. If something failed, tell the user what went wrong.` }
      ], { temperature: 0.5, maxTokens: 1000 });

      return {
        success: true,
        response: prefixWithSourceCheck(result.success ? result.content : parts, userContext, ['combined agent outputs']),
        agents: agentResults.map((r) => r.agent),
        metadata: { ...originalMetadata, providers: agentResults.map((r) => r.metadata?.provider) },
        ...imagePayload,
      };
    } catch {
      return {
        success: true,
        response: prefixWithSourceCheck(parts, userContext, ['combined agent outputs']),
        agents: agentResults.map((r) => r.agent),
        metadata: originalMetadata,
        ...imagePayload,
      };
    }
  }
}

module.exports = new OrchestratorAgent();
