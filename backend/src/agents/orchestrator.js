const fallbackManager = require('./fallbackManager');
const { logAgentCall } = require('./metricsLogger');
const { prefixWithSourceCheck, buildSystemPromptContext } = require('./context');
const { formatCapabilitiesForPrompt } = require('./capabilities');

const SPECIALIST_AGENTS = new Set([
  'task',
  'event',
  'place',
  'file',
  'memory',
  'desktop',
  'image',
  'email',
  'project',
]);

class OrchestratorAgent {
  constructor() {
    // Full prompt — used by the complex (70B) tier for ambiguous / general / multi-agent routing.
    this.complexSystemPrompt = `You are a central orchestrator for a multi-agent AI system.

Before returning a routing decision, check the user request against the available context and be explicit about which source categories influenced the routing. Never invent missing context.

Your role:
1. Analyze the user's natural language request.
2. Determine which specialized agents should handle it (can call MULTIPLE agents in parallel).
3. If a request involves time or dates (e.g., "in 10 minutes", "tomorrow at 3pm", "next Monday"), identify the agent AND set "needs_parsing": true, along with the original "raw_message". Do NOT attempt to calculate or parse the datetime yourself.
4. Extract parameters.

Available agents:
- task: Task management, creation, updates, status, priorities, deadlines, reminders
- event: Calendar events, scheduling, time-based operations
- place: Locations, addresses, coordinates, map queries
- file: File operations, document analysis, indexed folder/file metadata, content search
- memory: Information storage, retrieval, semantic search
- general: General conversation, greetings, everyday Q&A, identity questions, general knowledge
- desktop: Local desktop file operations, folder scanning, local document search
- image: Image generation from text prompts
- email: Email inbox management, Gmail integration
- project: Project workspaces, create/update/list
- gemma: Advanced reasoning, deeper synthesis, structured plans, tradeoff analysis

Agent capabilities:
${formatCapabilitiesForPrompt()}

For MULTIPLE distinct requests in one message (e.g. "Create a project. Schedule a meeting. Generate a logo."), return an execution plan:
{
  "plan": [
    { "step": 1, "agent": "project", "action": "create", "raw_message": "...", "parameters": {} },
    { "step": 2, "agent": "event", "action": "create", "dependsOn": [], "raw_message": "...", "needs_parsing": true },
    { "step": 3, "agent": "image", "action": "generate", "dependsOn": [2], "inputs": { "eventId": "$step:2.event.id" }, "raw_message": "..." }
  ],
  "reasoning": "overall analysis"
}

For single-intent requests, return legacy format:
{
  "agents": [{ "agent": "agent_name", "action": "specific_action", "needs_parsing": false, "raw_message": "...", "parameters": {}, "reasoning": "..." }],
  "reasoning": "overall analysis"
}

Identity/profile questions → route to "general".
General knowledge, casual chat, jokes, weather → route to "general".
Reasoning-heavy prompts ("compare options", "structured plan", "tradeoffs", "prioritize") → "gemma" when broader analysis is needed.
Content search in indexed documents → "file". Local path operations → "desktop".
If no specialist is needed, use a single "general" agent.`;

    // Compact prompt — used by the fast (8B) tier when in-code patterns already signal a specialist intent.
    this.specialistSystemPrompt = `You route user requests to ONE specialist agent. The message already matches an app feature (task, event, file, etc.) — pick the best agent and action.

Agents: task, event, place, file, memory, desktop, image, email, project.
Set needs_parsing true when the message contains relative dates/times (tomorrow, in 3 days, at 3pm, etc.).

Return ONLY JSON:
{
  "agents": [{ "agent": "...", "action": "process|getIndexedFolders|getIndexedFiles|...", "needs_parsing": false, "raw_message": "...", "parameters": {}, "reasoning": "..." }],
  "confidence": "high" | "low",
  "reasoning": "brief"
}

Set confidence "low" if the message is ambiguous, multi-intent, general knowledge, or not clearly a specialist request.`;
  }

  async processRequest(context) {
    const start = Date.now();
    const message = context.message;

    const fastPath = this.getFastPathRouting(message);
    if (fastPath) {
      console.log(`⚡ Fast-path routing: ${fastPath.map((r) => r.agent).join(', ')}`);
      await this.logOrchestratorCall(start, true, context, {
        provider: 'fast-path',
        model: 'keyword',
        tier: 'fast-path',
      });
      return {
        success: true,
        agents: fastPath,
        metadata: { provider: 'fast-path', model: 'keyword', routingTier: 'fast-path' },
      };
    }

    const tier = this.getRoutingTier(message);
    console.log(`🧭 Routing tier: ${tier}`);

    try {
      if (tier === 'complex') {
        return await this.routeComplex(context, start);
      }

      const fastResult = await this.routeSpecialist(context, start);
      if (fastResult.escalated) {
        console.log('⬆️ Escalating specialist route to complex orchestrator');
        return await this.routeComplex(context, start, { escalatedFrom: 'specialist' });
      }
      return fastResult;
    } catch (error) {
      await this.logOrchestratorCall(start, false, context, { error: error.message, tier });
      return {
        success: false,
        error: error.message,
        fallbackRouting: this.getFallbackRouting(message),
      };
    }
  }

  /**
   * Tier selection:
   * - fast-path handled before this runs
   * - specialist: message matches in-code specialist keyword patterns
   * - complex: general knowledge, ambiguous, or no specialist signal (uses 70B)
   */
  getRoutingTier(message) {
    if (this.hasMultiIntent(message)) return 'complex';
    if (this.hasSpecialistIntent(message)) return 'specialist';
    return 'complex';
  }

  hasMultiIntent(message) {
    const clauses = message
      .split(/[.\n;]+/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (clauses.length < 2) return false;
    let intentCount = 0;
    for (const clause of clauses) {
      if (this.hasSpecialistIntent(clause)) intentCount++;
    }
    return intentCount >= 2;
  }

  hasSpecialistIntent(message) {
    const lower = message.toLowerCase();

    if (
      /indexed folder|monitored folder|folders are indexed|show indexed folders|indexed file|files are indexed|document count|how many document|statistics|recent document|indexed document|folder statistics/.test(
        lower
      )
    ) {
      return true;
    }
    if (/task|todo|priority|deadline|remind|reminder/.test(lower)) return true;
    if (/event|calendar|schedule|meeting/.test(lower)) return true;
    if (/place|location|address|map/.test(lower)) return true;
    if (
      /desktop|scan|folder|local file|open file|index folder|pdf|docx|csv|txt|invoice|add folder|scan folder|list folder|what's in|list files in/.test(
        lower
      )
    ) {
      return true;
    }
    if (/inbox|gmail|email|archive email|my emails|newsletter/.test(lower)) return true;
    if (
      /generate an image|draw an image|create an image|make an image|image of|draw .+|image generation/.test(
        lower
      )
    ) {
      return true;
    }
    if (/file|document|upload|save/.test(lower)) return true;
    if (/remember|recall|memory|memorize|search my memory|store that|save that/.test(lower)) {
      return true;
    }
    if (/project|workspace/.test(lower)) return true;
    return false;
  }

  buildUserMessage(context) {
    const contextSummary = buildSystemPromptContext(context);
    return `User request: "${context.message}"\nOriginal request: "${context.originalMessage || context.message}"\n\nUser context: ${JSON.stringify({ userId: context.userId, email: context.email })}\n\nSession context:\n${contextSummary}\n\nRecent conversation history:\n${
      context.recentMessages?.length > 0
        ? context.recentMessages.map((m) => `${m.role}: "${m.content}"`).join('\n')
        : '(no prior messages)'
    }`;
  }

  async routeSpecialist(context, start) {
    const messages = [
      { role: 'system', content: this.specialistSystemPrompt },
      { role: 'user', content: this.buildUserMessage(context) },
    ];

    const result = await fallbackManager.generateText('orchestratorFast', messages, {
      temperature: 0.2,
      maxTokens: 350,
      json: true,
    });

    if (!result.success) {
      throw new Error(`Specialist orchestrator failed: ${result.error}`);
    }

    const parsed = this.parseRoutingResponse(result.content);

    if (this.shouldEscalateSpecialist(parsed)) {
      await this.logOrchestratorCall(start, true, context, {
        provider: result.provider,
        model: result.model,
        tier: 'specialist-escalate',
        usage: result.usage,
      });
      return { escalated: true };
    }

    await this.logOrchestratorCall(start, true, context, {
      provider: result.provider,
      model: result.model,
      tier: 'specialist',
      usage: result.usage,
    });

    return {
      success: true,
      plan: parsed.plan || null,
      agents: parsed.agents || [parsed],
      metadata: {
        provider: result.provider,
        model: result.model,
        usage: result.usage,
        routingTier: 'specialist',
      },
    };
  }

  shouldEscalateSpecialist(parsed) {
    if (parsed.confidence === 'low') return true;

    const agents = parsed.agents || (parsed.agent ? [parsed] : []);
    if (agents.length === 0) return true;
    if (agents.length > 1) return true;

    const primary = agents[0];
    if (!primary?.agent || !SPECIALIST_AGENTS.has(primary.agent)) return true;

    return false;
  }

  async routeComplex(context, start, extra = {}) {
    const messages = [
      { role: 'system', content: this.complexSystemPrompt },
      { role: 'user', content: this.buildUserMessage(context) },
    ];

    const result = await fallbackManager.generateText('orchestrator', messages, {
      temperature: 0.3,
      maxTokens: 600,
      json: true,
    });

    if (!result.success) throw new Error(`Complex orchestrator failed: ${result.error}`);

    const parsed = this.parseRoutingResponse(result.content);
    const tier = extra.escalatedFrom ? 'complex-escalated' : 'complex';

    await this.logOrchestratorCall(start, true, context, {
      provider: result.provider,
      model: result.model,
      tier,
      usage: result.usage,
    });

    return {
      success: true,
      plan: parsed.plan || null,
      agents: parsed.agents || [parsed],
      metadata: {
        provider: result.provider,
        model: result.model,
        usage: result.usage,
        routingTier: tier,
        escalatedFrom: extra.escalatedFrom || null,
      },
    };
  }

  async logOrchestratorCall(start, success, context, meta = {}) {
    await logAgentCall({
      agentName: 'orchestrator',
      provider: meta.provider,
      model: meta.model ? `${meta.model}${meta.tier ? ` (${meta.tier})` : ''}` : meta.tier,
      latency: Date.now() - start,
      success,
      error: meta.error,
      context,
    });
  }

  parseRoutingResponse(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const normalize = (name) =>
          ({
            task_agent: 'task',
            event_agent: 'event',
            place_agent: 'place',
            file_agent: 'file',
            memory_agent: 'memory',
            desktop_agent: 'desktop',
          })[name] || name;
        if (parsed.agents)
          parsed.agents.forEach((r) => {
            r.agent = normalize(r.agent);
          });
        else if (parsed.agent) parsed.agent = normalize(parsed.agent);
        return parsed;
      }
    } catch (e) {
      console.error('Failed to parse routing response:', e);
    }
    return {
      agents: [{ agent: 'general', action: 'chat', parameters: {}, reasoning: 'Fallback parsing' }],
      confidence: 'low',
    };
  }

  getFastPathRouting(message) {
    const lower = message.toLowerCase();

    const hasTemporal =
      /\b(?:tomorrow|today|tonight|yesterday|next (?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|in \d+ (?:minutes?|hours?|days?|weeks?|months?)|\d+ (?:days?|weeks?|months?) (?:later|from now)|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|at \d|\d\s*(?:am|pm|o'clock))\b/i.test(
        message
      );

    const makeTip = () => ({
      needs_parsing: hasTemporal,
      raw_message: message,
      parameters: {},
    });

    if (
      /^(hi|hello|hey|good (morning|afternoon|evening))\b/.test(lower) ||
      /^(what can you do|who are you|how do you work|help)\b/.test(lower)
    ) {
      return [
        { agent: 'general', action: 'chat', ...makeTip(), reasoning: 'Fast-path: greeting/help' },
      ];
    }

    if (
      /^(?:(?:what|which|how many|how much)\s+)?(?:are|have|do)\s+.+(?:folders?|directories?)\s+(?:indexed|monitored|active)/.test(
        lower
      ) ||
      /^(show|list|see)\s+(?:my\s+)?indexed folders/.test(lower)
    ) {
      return [
        {
          agent: 'file',
          action: 'getIndexedFolders',
          ...makeTip(),
          reasoning: 'Fast-path: indexed folders',
        },
      ];
    }

    if (
      /^create a task|^add a task|^new task|^add reminder|^set a reminder|^remind me/.test(lower) &&
      !hasTemporal
    ) {
      return [
        {
          agent: 'task',
          action: 'process',
          ...makeTip(),
          reasoning: 'Fast-path: create task/reminder',
        },
      ];
    }

    return null;
  }

  getFallbackRouting(message) {
    const lower = message.toLowerCase();
    const agents = [];

    const hasTemporal =
      /\b(?:tomorrow|today|tonight|yesterday|next (?:week|month|year|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|in \d+ (?:minutes?|hours?|days?|weeks?|months?)|\d+ (?:days?|weeks?|months?) (?:later|from now)|this (?:week|month|weekend)|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?|at \d|\d\s*(?:am|pm|o'clock))\b/i.test(
        message
      );

    if (/indexed folder|monitored folder|folders are indexed|show indexed folders/.test(lower)) {
      if (/count|how many/.test(lower)) {
        agents.push({
          agent: 'file',
          action: 'getIndexedFolderCount',
          parameters: { message },
          reasoning: 'Fallback: count folders',
        });
      } else {
        agents.push({
          agent: 'file',
          action: 'getIndexedFolders',
          parameters: { message },
          reasoning: 'Fallback: show folders',
        });
      }
    } else if (
      /indexed file|files are indexed|document count|how many document|statistics|recent document|indexed document|folder statistics/.test(
        lower
      )
    ) {
      if (/count|how many/.test(lower)) {
        agents.push({
          agent: 'file',
          action: 'getIndexedDocumentCount',
          parameters: { message },
          reasoning: 'Fallback: count docs',
        });
      } else if (/recent/.test(lower)) {
        agents.push({
          agent: 'file',
          action: 'getRecentIndexedFiles',
          parameters: { message },
          reasoning: 'Fallback: recent docs',
        });
      } else if (/statistics/.test(lower)) {
        agents.push({
          agent: 'file',
          action: 'getFolderStatistics',
          parameters: { message },
          reasoning: 'Fallback: statistics',
        });
      } else {
        agents.push({
          agent: 'file',
          action: 'getIndexedFiles',
          parameters: { message },
          reasoning: 'Fallback: show files',
        });
      }
    } else if (/task|todo|priority|deadline|remind|reminder/.test(lower)) {
      agents.push({
        agent: 'task',
        action: 'process',
        needs_parsing: hasTemporal,
        raw_message: message,
        parameters: {},
        reasoning: 'Keyword: task/reminder' + (hasTemporal ? ' (temporal detected)' : ''),
      });
    } else if (/event|calendar|schedule|meeting/.test(lower)) {
      agents.push({
        agent: 'event',
        action: 'process',
        needs_parsing: hasTemporal,
        raw_message: message,
        parameters: {},
        reasoning: 'Keyword: event' + (hasTemporal ? ' (temporal detected)' : ''),
      });
    } else if (/place|location|address|map/.test(lower)) {
      agents.push({
        agent: 'place',
        action: 'process',
        parameters: { message },
        reasoning: 'Keyword: place',
      });
    } else if (
      /desktop|scan|folder|local file|document_embeddings|open file|index folder|contract|pdf|docx|csv|txt|invoice|add folder|scan folder|list folder|what's in|list files in/.test(
        lower
      )
    ) {
      agents.push({
        agent: 'desktop',
        action: 'process',
        parameters: { message },
        reasoning: 'Keyword: desktop',
      });
    } else if (/inbox|gmail|email|archive email|my emails|newsletter/.test(lower)) {
      agents.push({
        agent: 'email',
        action: 'process',
        parameters: { message },
        reasoning: 'Keyword: email/inbox',
      });
    } else if (
      /generate an image|draw an image|create an image|make an image|image of|draw .+|image generation/.test(
        lower
      )
    ) {
      agents.push({
        agent: 'image',
        action: 'process',
        parameters: { message },
        reasoning: 'Keyword: image generation',
      });
    } else if (/file|document|upload|save/.test(lower)) {
      agents.push({
        agent: 'file',
        action: 'process',
        parameters: { message },
        reasoning: 'Keyword: file',
      });
    } else if (/project|workspace/.test(lower)) {
      agents.push({
        agent: 'project',
        action: 'process',
        parameters: { message },
        reasoning: 'Keyword: project',
      });
    } else if (
      /remember|recall|memory|memorize|what do you know|what did I say|search my memory|store that|save that/.test(
        lower
      )
    ) {
      agents.push({
        agent: 'memory',
        action: 'process',
        parameters: { message },
        reasoning: 'Keyword: memory',
      });
    }

    if (agents.length === 0)
      agents.push({
        agent: 'general',
        action: 'chat',
        parameters: { message },
        reasoning: 'No specific agent identified',
      });
    return agents;
  }

  async formatFinalResponse(
    userMessage,
    agentResults,
    originalMetadata,
    userContext = {},
    aggregated = null
  ) {
    const successful = agentResults.filter((r) => r.success);
    const parts = successful.map((r) => `[${r.agent.toUpperCase()}]: ${r.content}`).join('\n\n');

    const failed = agentResults.filter((r) => !r.success);
    const errorNote = failed.length
      ? `\n\nFailed agents:\n${failed.map((r) => `- ${r.agent}: ${r.error || 'unknown error'}`).join('\n')}`
      : '';

    const imageResult = successful.find((r) => r.image);
    const imagePayload = imageResult ? { image: imageResult.image } : {};

    if (successful.length === 1 && !failed.length) {
      const single = successful[0];
      return {
        success: true,
        response: prefixWithSourceCheck(single.content, userContext, [
          `${single.agent} agent output`,
        ]),
        agents: agentResults.map((r) => r.agent),
        metadata: {
          ...originalMetadata,
          providers: agentResults.map((r) => r.metadata?.provider),
        },
        ...imagePayload,
      };
    }

    if (aggregated?.useChecklist && aggregated.response) {
      return {
        success: true,
        response: prefixWithSourceCheck(aggregated.response, userContext, [
          'multi-agent checklist',
        ]),
        agents: agentResults.map((r) => r.agent),
        metadata: {
          ...originalMetadata,
          providers: agentResults.map((r) => r.metadata?.provider),
        },
        ...imagePayload,
      };
    }

    const identityNote = `User identity: email=${userContext.email || 'unknown'}${userContext.name ? `, name=${userContext.name}` : ''}`;

    try {
      const result = await fallbackManager.generateText(
        'orchestrator',
        [
          {
            role: 'system',
            content: `Combine agent outputs into a single concise, natural response. CRITICAL: only report what the agent outputs actually say — never claim an action succeeded if the agent reported a failure or error. Include the actual results (or error details if something failed). ${identityNote}`,
          },
          {
            role: 'user',
            content: `Original: "${userMessage}"\n\nAgent outputs:\n${parts}${errorNote}\n\nSynthesize a response. If something failed, tell the user what went wrong.`,
          },
        ],
        { temperature: 0.5, maxTokens: 1000 }
      );

      return {
        success: true,
        response: prefixWithSourceCheck(result.success ? result.content : parts, userContext, [
          'combined agent outputs',
        ]),
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
