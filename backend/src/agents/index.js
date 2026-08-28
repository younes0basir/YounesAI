const orchestrator = require('./orchestrator');
const taskAgent = require('./taskAgent');
const eventAgent = require('./eventAgent');
const placeAgent = require('./placeAgent');
const fileAgent = require('./fileAgent');
const memoryAgent = require('./memoryAgent');
const generalAgent = require('./generalAgent');
const desktopAgent = require('./desktopAgent');
const gemmaAgent = require('./gemmaAgent');
const imageAgent = require('./imageAgent');
const projectAgent = require('./projectAgent');
const { emailAgent } = require('./email');
const entityResolver = require('../conversation/entityResolver');
const entityRegistry = require('../conversation/entityRegistry');
const ConversationContext = require('../conversation/ConversationContext');
const { executePlan } = require('../conversation/executionPlan');
const resultAggregator = require('../conversation/resultAggregator');

class AgentCoordinator {
  constructor() {
    this.agents = {
      task: taskAgent,
      event: eventAgent,
      place: placeAgent,
      file: fileAgent,
      memory: memoryAgent,
      general: generalAgent,
      desktop: desktopAgent,
      gemma: gemmaAgent,
      image: imageAgent,
      email: emailAgent,
      project: projectAgent,
    };
  }

  async processRequest(userMessage, context = {}) {
    try {
      const sessionState = context.conversationSession || null;

      const resolved = await entityResolver.resolve(userMessage, sessionState, context);

      const routingMessage =
        resolved.unresolved.length === 0 ? resolved.resolvedMessage : userMessage;

      const globalContext = {
        userId: context.userId,
        email: context.email || null,
        name: context.name || null,
        conversationId: context.conversationId || null,
        sessionId: context.sessionId || null,
        requestId: context.requestId || null,
        message: routingMessage,
        originalMessage: userMessage,
        timestamp: new Date().toISOString(),
        recentMessages: context.recentMessages || [],
        activeFolder: context.activeFolder || null,
        activeTasks: context.activeTasks || [],
        upcomingEvents: context.upcomingEvents || [],
        memories: context.memories || [],
        recentConversations: context.recentConversations || [],
        relevantDocuments: context.relevantDocuments || [],
        conversationSession: sessionState,
        resolvedEntities: resolved.bindings,
        resolvedParameters: resolved.resolvedParameters || {},
        executionResults: {},
      };

      console.log('🎯 Processing request:', userMessage, '| userId:', globalContext.userId);

      if (resolved.unresolved.length > 0 && resolved.bindings.length === 0) {
        const generalResult = await generalAgent.run({
          ...globalContext,
          message: `The user said: "${userMessage}". I could not resolve what they refer to. Ask a brief clarifying question.`,
        });
        return {
          success: true,
          response: generalResult.content,
          agents: ['general'],
          metadata: { unresolved: resolved.unresolved },
        };
      }

      const orchestratorResult = await orchestrator.processRequest(globalContext);

      let plan = orchestratorResult.plan || null;
      let agentRoutes;

      if (!orchestratorResult.success) {
        console.log('⚠️ Orchestrator failed, using fallback routing');
        agentRoutes = orchestratorResult.fallbackRouting;
      } else if (plan?.length) {
        agentRoutes = plan;
      } else {
        agentRoutes = orchestratorResult.agents;
      }

      console.log(
        `📋 Routing to ${agentRoutes.length} agent step(s):`,
        agentRoutes.map((r) => r.agent || r.step).join(', ')
      );

      const results = await executePlan(agentRoutes, globalContext, this.agents);

      let updatedSession = sessionState;
      if (updatedSession) {
        updatedSession = entityRegistry.applyResults(updatedSession, results);
      }

      const aggregated = resultAggregator.aggregate(results);
      const attachments = resultAggregator.collectAttachments(results);

      const finalResponse = await orchestrator.formatFinalResponse(
        userMessage,
        results,
        orchestratorResult.metadata,
        globalContext,
        aggregated
      );

      if (updatedSession) {
        ConversationContext.save(context.userId, updatedSession.sessionId, updatedSession);
      }

      return {
        ...finalResponse,
        steps: aggregated.steps,
        entities: updatedSession
          ? ConversationContext.toPersistedPayload(updatedSession, {
              attachments,
              steps: aggregated.steps,
            })
          : { attachments, steps: aggregated.steps },
        sessionId: context.sessionId || updatedSession?.sessionId,
      };
    } catch (error) {
      console.error('❌ Agent coordinator error:', error);
      return {
        success: false,
        error: error.message,
        message: 'An error occurred while processing your request.',
      };
    }
  }

  async handleFallbackRouting(context, routing) {
    const results = await executePlan(routing, context, this.agents);
    return await orchestrator.formatFinalResponse(context.message, results, { fallbackUsed: true });
  }

  async callAgent(agentName, method, ...args) {
    const agent = this.agents[agentName];
    if (!agent) throw new Error(`Unknown agent: ${agentName}`);
    if (typeof agent[method] !== 'function')
      throw new Error(`Agent ${agentName} does not have method ${method}`);
    return await agent[method](...args);
  }

  getStatus() {
    return {
      agents: Object.keys(this.agents),
      orchestrator: 'active',
      memory: {},
    };
  }
}

module.exports = new AgentCoordinator();
