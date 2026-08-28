const fallbackManager = require('./fallbackManager');
const { logAgentCall } = require('./metricsLogger');
const { buildSystemPromptContext, prefixWithSourceCheck } = require('./context');
const tools = require('../tools');

const PROJECT_ACTIONS = new Set(['create', 'update', 'delete', 'list', 'chat']);

class ProjectAgent {
  constructor() {
    this.systemPrompt = `You are a project management agent. Extract project details and return JSON.

Actions: create, update, delete, list, chat.
If context provides projectId, use it for update/delete.

Return ONLY valid JSON:
{
  "action": "create" | "update" | "delete" | "list" | "chat",
  "project": { "name": "...", "description": null },
  "projectId": "UUID or null",
  "response": "text if chat"
}`;
  }

  parseResponse(content) {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      return { action: 'chat', response: content };
    }
  }

  async run(context) {
    const start = Date.now();
    try {
      const contextSummary = buildSystemPromptContext(context);
      const result = await fallbackManager.generateText(
        'general',
        [
          { role: 'system', content: this.systemPrompt },
          {
            role: 'user',
            content: `Message: "${context.message}"\nContext:\n${contextSummary}`,
          },
        ],
        { temperature: 0.3, maxTokens: 500, json: true }
      );

      if (!result.success) throw new Error(result.error);
      let parsed = this.parseResponse(result.content);
      if (context.action && PROJECT_ACTIONS.has(context.action)) parsed.action = context.action;
      if (context.parameters?.projectId) parsed.projectId = context.parameters.projectId;

      let toolResult = null;
      let responseText = parsed.response || '';

      switch (parsed.action) {
        case 'create':
          toolResult = await tools.createProject(
            context,
            parsed.project || { name: 'Untitled Project' }
          );
          responseText = toolResult.success
            ? `Project created: "${toolResult.project.name}" (id: ${toolResult.project.id}).`
            : toolResult.error;
          break;
        case 'update':
          if (!parsed.projectId) {
            responseText = 'Please specify which project to update.';
            break;
          }
          toolResult = await tools.updateProject(context, parsed.projectId, parsed.project || {});
          responseText = toolResult.success ? 'Project updated.' : toolResult.error;
          break;
        case 'delete':
          if (!parsed.projectId) {
            responseText = 'Please specify which project to delete.';
            break;
          }
          toolResult = await tools.deleteProject(context, parsed.projectId);
          responseText = toolResult.success ? 'Project deleted.' : toolResult.error;
          break;
        case 'list':
          toolResult = await tools.listProjects(context);
          responseText =
            toolResult.projects?.length > 0
              ? `Projects:\n${toolResult.projects.map((p) => `- ${p.name} [id=${p.id}]`).join('\n')}`
              : 'No projects found.';
          break;
        default:
          responseText = parsed.response || 'How can I help with projects?';
      }

      await logAgentCall({
        agentName: 'project',
        provider: result.provider,
        latency: Date.now() - start,
        success: true,
        context,
      });

      return {
        success: true,
        content: prefixWithSourceCheck(responseText, context, ['project agent']),
        action: parsed.action,
        toolResult,
      };
    } catch (err) {
      await logAgentCall({
        agentName: 'project',
        latency: Date.now() - start,
        success: false,
        error: err.message,
        context,
      });
      return { success: false, error: err.message, content: `Project agent error: ${err.message}` };
    }
  }
}

module.exports = new ProjectAgent();
