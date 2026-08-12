const orchestrator = require('./orchestrator');
const taskAgent    = require('./taskAgent');
const eventAgent   = require('./eventAgent');
const placeAgent   = require('./placeAgent');
const fileAgent    = require('./fileAgent');
const memoryAgent  = require('./memoryAgent');
const generalAgent = require('./generalAgent');
const desktopAgent = require('./desktopAgent');
const gemmaAgent   = require('./gemmaAgent');
const imageAgent   = require('./imageAgent');
const { emailAgent } = require('./email');

class AgentCoordinator {
  constructor() {
    this.agents = {
      task:    taskAgent,
      event:   eventAgent,
      place:   placeAgent,
      file:    fileAgent,
      memory:  memoryAgent,
      general: generalAgent,
      desktop: desktopAgent,
      gemma:   gemmaAgent,
      image:   imageAgent,
      email:   emailAgent,
    };
  }

  async processRequest(userMessage, context = {}) {
    try {
      const globalContext = {
        userId: context.userId,
        email: context.email || null,
        name: context.name || null,
        conversationId: context.conversationId || null,
        requestId: context.requestId || null,
        message: userMessage,
        timestamp: new Date().toISOString(),
        recentMessages: context.recentMessages || [],
        activeFolder: context.activeFolder || null,
        // Rich context fields fetched by buildContext — must be passed through
        // so agents can see existing tasks, events, memories, and documents.
        activeTasks: context.activeTasks || [],
        upcomingEvents: context.upcomingEvents || [],
        memories: context.memories || [],
        recentConversations: context.recentConversations || [],
        relevantDocuments: context.relevantDocuments || [],
      };

      console.log('🎯 Processing request:', userMessage, '| userId:', globalContext.userId);

      const orchestratorResult = await orchestrator.processRequest(globalContext);

      let agentRoutes;
      if (!orchestratorResult.success) {
        console.log('⚠️ Orchestrator failed, using fallback routing');
        agentRoutes = orchestratorResult.fallbackRouting;
      } else {
        agentRoutes = orchestratorResult.agents;
      }

      console.log(`📋 Routing to ${agentRoutes.length} agent(s):`, agentRoutes.map((r) => r.agent).join(', '));

      // Import temporal parsing utility
      const { parseTemporal } = require('../utils/temporalUtility');

      const results = await Promise.all(
        agentRoutes.map(async (route) => {
          const agent = this.agents[route.agent];
          if (!agent) return { agent: route.agent, success: false, error: `Unknown agent: ${route.agent}` };
          try {
            // Build a scoped context for this specific agent
            const agentContext = {
              ...globalContext,
              action: route.action || null,
              parameters: route.parameters || {},
            };

            if (route.needs_parsing) {
              const rawMsg = route.raw_message || globalContext.message;
              const refDate = globalContext.timestamp ? new Date(globalContext.timestamp) : new Date();
              const temporalResult = parseTemporal(rawMsg, refDate);
              if (temporalResult.success) {
                console.log(`⏰ [Temporal Parser] Extracted date: ${temporalResult.parsedDate} (Ref: ${refDate.toISOString()}) | Cleaned message: "${temporalResult.cleanedMessage}"`);
                
                // Inject the parsed date into the appropriate agent parameters
                route.parameters = route.parameters || {};
                route.parameters.parsedDate = temporalResult.parsedDate;
                route.parameters.dueAt = temporalResult.parsedDate;      // fallback for task agents
                route.parameters.startsAt = temporalResult.parsedDate;   // fallback for event agents
                
                // Clean the message passed to downstream agents to remove time strings (e.g., 'in 10 minutes')
                agentContext.message = temporalResult.cleanedMessage;
                agentContext.originalMessage = rawMsg;
                agentContext.parsedParameters = route.parameters;
              }
            }

            const result = await agent.run(agentContext);
            return { agent: route.agent, ...result };
          } catch (err) {
            return { agent: route.agent, success: false, error: err.message };
          }
        })
      );

      return await orchestrator.formatFinalResponse(globalContext.message, results, orchestratorResult.metadata, globalContext);
    } catch (error) {
      console.error('❌ Agent coordinator error:', error);
      return { success: false, error: error.message, message: 'An error occurred while processing your request.' };
    }
  }

  async handleFallbackRouting(context, routing) {
    const results = await Promise.all(
      routing.map(async (route) => {
        const agent = this.agents[route.agent];
        if (!agent) return { agent: route.agent, success: false, error: `Unknown agent: ${route.agent}` };
        try {
          const agentContext = {
            ...context,
            action: route.action || null,
            parameters: route.parameters || {},
          };
          const result = await agent.run(agentContext);
          return { agent: route.agent, ...result };
        } catch (err) {
          return { agent: route.agent, success: false, error: err.message };
        }
      })
    );
    return await orchestrator.formatFinalResponse(context.message, results, { fallbackUsed: true });
  }

  async callAgent(agentName, method, ...args) {
    const agent = this.agents[agentName];
    if (!agent) throw new Error(`Unknown agent: ${agentName}`);
    if (typeof agent[method] !== 'function') throw new Error(`Agent ${agentName} does not have method ${method}`);
    return await agent[method](...args);
  }

  getStatus() {
    return {
      agents: Object.keys(this.agents),
      orchestrator: 'active',
      memory: {}
    };
  }
}

module.exports = new AgentCoordinator();
