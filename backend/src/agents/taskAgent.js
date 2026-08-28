const fallbackManager = require('./fallbackManager');
const { logAgentCall } = require('./metricsLogger');
const { generateMessageHash } = require('./idempotency');
const { buildSystemPromptContext, prefixWithSourceCheck } = require('./context');
const { parseTemporal } = require('../utils/temporalUtility');
const { applyExtractedTitle } = require('../utils/titleUtility');
const tools = require('../tools');

// Orchestrator uses "process" as a routing hint — not a CRUD action.
const TASK_ACTIONS = new Set(['create', 'update', 'delete', 'list', 'chat']);

class TaskAgent {
  constructor() {
    this.systemPrompt = `You are a task management agent. Extract task details from the user's message and return JSON.

Rules:
- If the user expresses ANY intent to create a task ("create task", "new task", "make a task", "add task", or gives task details like "task named X"), ALWAYS set action to "create" with whatever info is available. NEVER respond with "I need more details" or action "chat" when creation is intended.
- Reminders ("remind me", "set a reminder", "add a reminder") are treated as tasks with a due date. Extract the reminder text as the title and the time as due_at. ALWAYS set action to "create".
- Default title to "Untitled Task" if none provided.
- If pre-parsed temporal parameters are provided in the context (e.g. parsedDate / dueAt), prioritize utilizing them directly for the task's due date rather than parsing relative dates yourself.
- Default priority: 3, default status: "pending"
- For UPDATE or DELETE: the user context below lists active tasks with their IDs like [id=UUID]. You MUST copy the exact UUID from the context into "taskId". If the user refers to a task by title or description, match it against the active tasks list.
- If no matching task is found in the context for update/delete, set action to "chat" and explain that the task was not found.

Return ONLY valid JSON:
{
  "action": "create" | "update" | "delete" | "list" | "chat",
  "task": {
    "title": "extracted title or 'Untitled Task'",
    "description": null,
    "priority": 3,
    "due_at": "ISO date or null",
    "status": "pending"
  },
  "taskId": "exact UUID from the active tasks list if updating/deleting, otherwise null",
  "filters": {},
  "response": "brief text if chat action"
}

Examples:
- "create task" → { "action": "create", "task": { "title": "Untitled Task", "priority": 3, "due_at": null } }
- "task named test3 for 2026-07-25T00:00:00.000Z" → { "action": "create", "task": { "title": "test3", "due_at": "2026-07-25T00:00:00.000Z" } }
- "remind me to call Younes tomorrow at 4pm" → { "action": "create", "task": { "title": "Call Younes", "due_at": "<ISO date from context>" } }
- "set a reminder to pay rent on the 1st" → { "action": "create", "task": { "title": "Pay rent", "due_at": "<ISO date from context>" } }
- "mark the groceries task as done" → { "action": "update", "taskId": "<uuid from context>", "task": { "status": "done" } }
- "delete the review task" → { "action": "delete", "taskId": "<uuid from context>" }
- "show my tasks" or "list tasks" → { "action": "list" }
- "show overdue tasks" → { "action": "list", "filters": { "filter": "overdue" } }
- "show today's tasks" → { "action": "list", "filters": { "filter": "today" } }

Only use action "chat" if the message is purely conversational with zero task intent.`;
  }

  async run(context) {
    const start = Date.now();
    try {
      // Inject rich context into the user message for better LLM reasoning
      const contextSummary = buildSystemPromptContext(context);
      const sourceMessage = context.originalMessage || context.message;
      const userContent = `Message: "${context.message}"\nOriginal message: "${sourceMessage}"\nUser Context:\n${contextSummary}\n\nRecent conversation:\n${
        context.recentMessages?.length > 0
          ? context.recentMessages.map((m) => `${m.role}: "${m.content}"`).join('\n')
          : '(no prior messages)'
      }`;

      const result = await fallbackManager.generateText(
        'task',
        [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: userContent },
        ],
        { temperature: 0.3, maxTokens: 600, json: true }
      );

      if (!result.success) {
        console.error('[TaskAgent] LLM call failed:', result.error);
        throw new Error(result.error);
      }

      console.log('[TaskAgent] LLM raw response:', result.content?.substring(0, 200));

      let parsed = this.parseResponse(result.content, sourceMessage);
      if (context.action && TASK_ACTIONS.has(context.action)) {
        parsed.action = context.action;
      }
      applyExtractedTitle(parsed.task, ['Untitled Task'], context.message, sourceMessage);
      if (context.parameters?.dueAt && parsed.task) {
        parsed.task.due_at = context.parameters.dueAt;
      }
      console.log(
        '[TaskAgent] Parsed action:',
        parsed.action,
        '| title:',
        parsed.task?.title,
        '| due_at:',
        parsed.task?.due_at
      );
      const tokensUsed = result.usage?.total_tokens || 0;
      let actionResult;

      switch (parsed.action) {
        case 'create':
          // Generate deterministic requestId if client didn't provide one
          if (!context.requestId) {
            context.requestId = generateMessageHash(context.userId, context.message, 'create_task');
          }
          actionResult = await tools.createTask(context, parsed.task);
          await logAgentCall({
            agentName: 'task',
            provider: result.provider,
            model: result.model,
            latency: Date.now() - start,
            success: true,
            tokensUsed,
            context,
          });
          if (actionResult.idempotent) {
            return {
              success: true,
              content: prefixWithSourceCheck(
                `Task already created (duplicate request prevented): "${actionResult.task.title}".`,
                context,
                ['task tool output']
              ),
              metadata: { provider: result.provider, model: result.model },
            };
          }
          const dueInfo = actionResult.task.due_at
            ? `, due: ${new Date(actionResult.task.due_at).toLocaleDateString()}`
            : '';
          return {
            success: true,
            content: prefixWithSourceCheck(
              `Task created successfully: "${actionResult.task.title}" (id: ${actionResult.task.id}, priority: ${actionResult.task.priority}${dueInfo}).`,
              context,
              ['task tool output']
            ),
            action: 'create',
            toolResult: actionResult,
            metadata: { provider: result.provider, model: result.model },
          };

        case 'update':
          if (!parsed.taskId) {
            await logAgentCall({
              agentName: 'task',
              provider: result.provider,
              model: result.model,
              latency: Date.now() - start,
              success: false,
              error: 'No taskId provided',
              context,
            });
            return {
              success: true,
              content: prefixWithSourceCheck(
                'I could not identify which task to update. Please specify the task name or show your tasks first.',
                context,
                ['task agent reasoning']
              ),
              metadata: { provider: result.provider, model: result.model },
            };
          }
          actionResult = await tools.updateTask(context, parsed.taskId, parsed.task);
          await logAgentCall({
            agentName: 'task',
            provider: result.provider,
            model: result.model,
            latency: Date.now() - start,
            success: actionResult.success,
            tokensUsed,
            context,
          });
          return {
            success: true,
            content: prefixWithSourceCheck(
              actionResult.success
                ? `Task updated successfully: "${actionResult.task.title}" (status: ${actionResult.task.status}).`
                : `Task not found or update failed.`,
              context,
              ['task tool output']
            ),
            metadata: { provider: result.provider, model: result.model },
          };

        case 'delete':
          if (!parsed.taskId) {
            await logAgentCall({
              agentName: 'task',
              provider: result.provider,
              model: result.model,
              latency: Date.now() - start,
              success: false,
              error: 'No taskId provided',
              context,
            });
            return {
              success: true,
              content: prefixWithSourceCheck(
                'I could not identify which task to delete. Please specify the task name or show your tasks first.',
                context,
                ['task agent reasoning']
              ),
              metadata: { provider: result.provider, model: result.model },
            };
          }
          actionResult = await tools.deleteTask(context, parsed.taskId);
          await logAgentCall({
            agentName: 'task',
            provider: result.provider,
            model: result.model,
            latency: Date.now() - start,
            success: actionResult.success,
            tokensUsed,
            context,
          });
          return {
            success: true,
            content: prefixWithSourceCheck(
              actionResult.success ? `Task deleted.` : `Task not found.`,
              context,
              ['task tool output']
            ),
            metadata: { provider: result.provider, model: result.model },
          };

        case 'list':
          actionResult = await tools.listTasks(context, parsed.filters || {});
          await logAgentCall({
            agentName: 'task',
            provider: result.provider,
            model: result.model,
            latency: Date.now() - start,
            success: true,
            tokensUsed,
            context,
          });
          const count = actionResult.tasks.length;
          const summary =
            count === 0
              ? 'No tasks found.'
              : `Found ${count} task(s):\n${actionResult.tasks.map((t) => `- ${t.title} (${t.status})`).join('\n')}`;
          return {
            success: true,
            content: prefixWithSourceCheck(summary, context, ['task tool output']),
            metadata: { provider: result.provider, model: result.model },
          };

        default:
          await logAgentCall({
            agentName: 'task',
            provider: result.provider,
            model: result.model,
            latency: Date.now() - start,
            success: true,
            tokensUsed,
            context,
          });
          return {
            success: true,
            content: prefixWithSourceCheck(parsed.response || result.content, context, [
              'task agent reasoning',
            ]),
            metadata: { provider: result.provider, model: result.model },
          };
      }
    } catch (error) {
      await logAgentCall({
        agentName: 'task',
        latency: Date.now() - start,
        success: false,
        error: error.message,
        context,
      });
      return { success: false, error: error.message };
    }
  }

  parseResponse(content, originalMessage = '') {
    // 1. Try to extract and parse valid JSON from the LLM response
    try {
      // Strip markdown code fences if present
      let cleaned = content
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Validate that we got a sensible structure
        if (parsed.action || parsed.task || parsed.response !== undefined) {
          // CRITICAL: If the LLM returned action='chat' but the user's message
          // clearly has task creation intent, override with the fallback parser.
          // The LLM sometimes acknowledges the request without actually acting on it.
          if (parsed.action === 'chat') {
            const fallback = this.fallbackParse(originalMessage || content);
            if (fallback && fallback.action !== 'chat') {
              console.log(
                '[TaskAgent] LLM returned action=chat but creation intent detected — overriding:',
                JSON.stringify(fallback)
              );
              return fallback;
            }
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[TaskAgent] JSON parse failed, trying fallback parser:', e.message);
    }

    // 2. Fallback: detect task intent from natural language and extract details
    const fallback = this.fallbackParse(originalMessage || content);
    if (fallback) {
      console.log('[TaskAgent] Using fallback parser result:', JSON.stringify(fallback));
      return fallback;
    }

    // 3. Last resort: treat as chat
    return { action: 'chat', response: content };
  }

  /**
   * Fallback parser that extracts task details from natural language when the LLM
   * fails to return valid JSON. Detects create/update/delete/list intent and
   * extracts title, due date, priority, and status using regex + chrono-node.
   */
  fallbackParse(message) {
    const lower = message.toLowerCase();

    // Check for list intent first
    if (/\b(?:show|list|display|get|see)\s+(?:my\s+)?(?:tasks|todos)\b/i.test(lower)) {
      let filters = {};
      if (/overdue/.test(lower)) filters.filter = 'overdue';
      else if (/today/.test(lower)) filters.filter = 'today';
      return { action: 'list', filters };
    }

    // Check for delete intent
    if (/\b(?:delete|remove|cancel)\s+(?:the\s+)?(?:task|todo)\b/i.test(lower)) {
      return {
        action: 'delete',
        taskId: null,
        response: 'I need to know which task to delete. Please show your tasks first.',
      };
    }

    // Check for creation intent
    const hasCreateIntent =
      /(?:create|make|add|new)\s+(?:a\s+)?(?:task|todo)/i.test(lower) ||
      /task\s+(?:named|called|titled)/i.test(lower) ||
      /(?:remind\s+me|set\s+a\s+reminder|add\s+a\s+reminder)/i.test(lower) ||
      /(?:create|make|add|new)\s+.+\s+(?:task|todo)/i.test(lower);

    if (!hasCreateIntent) return null;

    // Extract title — try multiple strategies in order of reliability
    let title = 'Untitled Task';

    // Strategy 1: Look for "named/called/titled [X]" anywhere in the message
    // This handles both "create task named X for Y" and "create task for Y named X"
    const namedMatch = message.match(
      /(?:named|called|titled)\s+["']?(.+?)["']?(?:\s+(?:for|due|by|on|at|with|priority|$)|$)/i
    );
    if (namedMatch && namedMatch[1]) {
      title = namedMatch[1]
        .trim()
        .replace(/["'.]$/, '')
        .replace(/^["'.,]/, '');
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }

    // Strategy 2: If no "named" keyword, try standard create patterns
    if (title === 'Untitled Task') {
      const createPatterns = [
        /(?:create|make|add)\s+(?:a\s+)?(?:task|todo)\s+(?:named|called|titled)?\s*["']?(.+?)["']?(?:\s+(?:for|due|by|on)\s+(.+))?$/i,
        /(?:task|todo)\s+(?:named|called|titled)\s+["']?(.+?)["']?(?:\s+(?:for|due|by|on)\s+(.+))?$/i,
        /(?:create|make|add|new)\s+(?:a\s+)?(.+?)\s+(?:task|todo)(?:\s+(?:for|due|by|on)\s+(.+))?$/i,
        /(?:remind\s+me\s+(?:to\s+)?)?(.+?)\s+(?:tomorrow|today|on|at|by|next)\s+(.+)$/i,
        /(?:set\s+(?:a\s+)?reminder\s+(?:to\s+)?)?(.+?)\s+(?:on|at|by|for)\s+(.+)$/i,
      ];
      for (const pattern of createPatterns) {
        const match = message.match(pattern);
        if (match && match[1]) {
          title = match[1]
            .trim()
            .replace(/["'.]$/, '')
            .replace(/^["'.,]/, '');
          title = title.charAt(0).toUpperCase() + title.slice(1);
          break;
        }
      }
    }

    // Extract due date using temporal utility
    let dueAt = null;
    try {
      const temporal = parseTemporal(message, new Date());
      if (temporal.success && temporal.parsedDate) {
        dueAt = temporal.parsedDate;
      }
    } catch {}

    // Extract priority
    let priority = 3;
    const prioMatch = lower.match(/priority\s*(\d)/i);
    if (prioMatch) priority = Math.min(5, Math.max(1, parseInt(prioMatch[1], 10)));

    return {
      action: 'create',
      task: {
        title,
        description: null,
        priority,
        due_at: dueAt,
        status: 'pending',
      },
      taskId: null,
      filters: {},
      response: null,
    };
  }
}

module.exports = new TaskAgent();
