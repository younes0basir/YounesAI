const { parseTemporal } = require('../utils/temporalUtility');

function getStepOutput(executionResults, stepNum) {
  return executionResults[stepNum] || null;
}

function resolvePath(obj, path) {
  if (!obj || !path) return undefined;
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function resolveInputBindings(inputs, executionResults) {
  if (!inputs || typeof inputs !== 'object') return {};
  const resolved = {};

  for (const [key, value] of Object.entries(inputs)) {
    if (typeof value === 'string' && value.startsWith('$step:')) {
      const match = value.match(/^\$step:(\d+)\.(.+)$/);
      if (match) {
        const stepNum = Number(match[1]);
        const path = match[2];
        const stepResult = getStepOutput(executionResults, stepNum);
        const toolResult = stepResult?.toolResult || stepResult;
        resolved[key] = resolvePath(toolResult, path) ?? resolvePath(stepResult, path);
      }
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}

function groupPlanSteps(plan) {
  if (!plan?.length) return [];
  const hasDeps = plan.some((s) => s.dependsOn?.length > 0);
  if (!hasDeps) return [plan];

  const sorted = [];
  const done = new Set();
  const remaining = [...plan];

  while (remaining.length > 0) {
    const next = remaining.filter((s) => !(s.dependsOn || []).some((d) => !done.has(d)));
    if (next.length === 0) {
      sorted.push(remaining.shift());
      continue;
    }
    for (const step of next) {
      sorted.push(step);
      done.add(step.step);
      const idx = remaining.indexOf(step);
      if (idx >= 0) remaining.splice(idx, 1);
    }
  }
  return sorted.map((s) => [s]);
}

async function runSingleRoute(route, globalContext, agents, parseTemporalFn) {
  const agent = agents[route.agent];
  if (!agent) {
    return { agent: route.agent, success: false, error: `Unknown agent: ${route.agent}` };
  }

  const agentContext = {
    ...globalContext,
    action: route.action || null,
    parameters: { ...(route.parameters || {}), ...(globalContext.resolvedParameters || {}) },
  };

  if (route.needs_parsing) {
    const rawMsg = route.raw_message || globalContext.message;
    const refDate = globalContext.timestamp ? new Date(globalContext.timestamp) : new Date();
    const temporalResult = parseTemporalFn(rawMsg, refDate);
    if (temporalResult.success) {
      route.parameters = route.parameters || {};
      route.parameters.parsedDate = temporalResult.parsedDate;
      route.parameters.dueAt = temporalResult.parsedDate;
      route.parameters.startsAt = temporalResult.parsedDate;
      agentContext.message = temporalResult.cleanedMessage;
      agentContext.originalMessage = rawMsg;
      agentContext.parsedParameters = { ...agentContext.parsedParameters, ...route.parameters };
      agentContext.parameters = { ...agentContext.parameters, ...route.parameters };
    }
  }

  try {
    const result = await agent.run(agentContext);
    return { agent: route.agent, action: route.action, ...result };
  } catch (err) {
    return { agent: route.agent, success: false, error: err.message };
  }
}

async function executePlan(planOrRoutes, globalContext, agents) {
  const isPlan = Array.isArray(planOrRoutes) && planOrRoutes[0]?.step != null;
  const executionResults = {};
  const allResults = [];

  if (!isPlan) {
    const routes = planOrRoutes || [];
    const parallelResults = await Promise.all(
      routes.map((route) => runSingleRoute(route, globalContext, agents, parseTemporal))
    );
    return parallelResults;
  }

  const batches = groupPlanSteps(planOrRoutes);

  for (const batch of batches) {
    const batchPromises = batch.map(async (step) => {
      const boundInputs = resolveInputBindings(step.inputs, executionResults);
      const route = {
        agent: step.agent,
        action: step.action || 'process',
        needs_parsing: step.needs_parsing || false,
        raw_message: step.raw_message || globalContext.message,
        parameters: { ...(step.parameters || {}), ...boundInputs },
      };

      const result = await runSingleRoute(route, globalContext, agents, parseTemporal);
      if (step.step != null) executionResults[step.step] = result;
      return result;
    });

    const batchResults = await Promise.all(batchPromises);
    allResults.push(...batchResults);
    globalContext.executionResults = { ...executionResults };
  }

  return allResults;
}

module.exports = {
  executePlan,
  resolveInputBindings,
  groupPlanSteps,
};
