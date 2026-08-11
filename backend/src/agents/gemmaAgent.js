const fallbackManager = require('./fallbackManager');
const { logAgentCall } = require('./metricsLogger');
const { prefixWithSourceCheck } = require('./context');
const fileManagementTools = require('../tools/fileManagementTools');

class GemmaAgent {
  constructor() {
    this.systemPrompt = `You are a strategic planner for complex file operations. When a user asks for complex multi-step file operations (e.g., "find all invoices and move them", "organize my documents by type"), break it down into clear, executable steps.

Your role is to:
1. Analyze the user's request
2. Break it down into logical steps
3. Identify which tools/operations are needed for each step
4. Return a structured plan

Available tools:
- list_folder_contents: List files and folders in a directory (names and types only)
- plan_operation: Create a structured plan for complex operations

Return ONLY valid JSON:
{
  "action": "plan" | "list" | "chat",
  "folderPath": "absolute path to folder (if needed)",
  "steps": [
    {
      "step": 1,
      "action": "list_folder_contents" | "filter" | "execute",
      "description": "What this step does",
      "parameters": {}
    }
  ],
  "response": "conversational response if action is chat"
}

Examples:
- "Find all invoices in C:\\Documents and organize them" → { "action": "plan", "folderPath": "C:\\\\Documents", "steps": [{"step": 1, "action": "list_folder_contents", "description": "List all files in Documents folder"}, {"step": 2, "action": "filter", "description": "Filter files for invoice documents"}, {"step": 3, "action": "execute", "description": "Move or organize invoice files"}] }
- "What's in my Downloads folder" → { "action": "list", "folderPath": "C:\\\\Users\\\\User\\\\Downloads" }
- "Hello" → { "action": "chat", "response": "Hello! I can help you plan complex file operations." }`;
  }

  async run(context) {
    const start = Date.now();
    try {
      const result = await fallbackManager.generateText('gemma', [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: `Message: "${context.message}"\nContext: ${JSON.stringify({ userId: context.userId })}` }
      ], { temperature: 0.3, maxTokens: 800 });

      if (!result.success) throw new Error(result.error);
      const parsed = this.parseResponse(result.content);

      if (parsed.action === 'list') {
        const listResult = await fileManagementTools.listFolderContents(parsed.folderPath);
        await logAgentCall({ agentName: 'gemma', provider: result.provider, latency: Date.now() - start, success: true, context });
        
        if (!listResult.success) {
          return { success: false, error: listResult.error, metadata: { provider: result.provider, model: result.model } };
        }

        const summary = `Contents of "${parsed.folderPath}":\n\n${listResult.contents.map(item => {
          const type = item.isDirectory ? '[DIR]' : '[FILE]';
          const ext = item.extension ? ` (${item.extension})` : '';
          return `${type} ${item.name}${ext}`;
        }).join('\n')}`;

        return { success: true, content: prefixWithSourceCheck(summary, context, ['folder listing result']), metadata: { provider: result.provider, model: result.model } };
      }

      if (parsed.action === 'plan') {
        // List the folder contents first as part of the planning
        let folderContents = [];
        if (parsed.folderPath) {
          const listResult = await fileManagementTools.listFolderContents(parsed.folderPath);
          if (listResult.success) {
            folderContents = listResult.contents;
          }
        }

        const planSummary = `Plan for "${context.message}":\n\n${parsed.steps.map(step => 
          `Step ${step.step}: ${step.action}\n  ${step.description}`
        ).join('\n\n')}`;

        if (folderContents.length > 0) {
          const folderInfo = `\n\nFolder contents (${folderContents.length} items):\n${folderContents.map(item => {
            const type = item.isDirectory ? '[DIR]' : '[FILE]';
            return `${type} ${item.name}`;
          }).join('\n')}`;
          
          await logAgentCall({ agentName: 'gemma', provider: result.provider, latency: Date.now() - start, success: true, context });
          return { success: true, content: prefixWithSourceCheck(planSummary + folderInfo, context, ['file planning result']), metadata: { provider: result.provider, model: result.model } };
        }

        await logAgentCall({ agentName: 'gemma', provider: result.provider, latency: Date.now() - start, success: true, context });
        return { success: true, content: prefixWithSourceCheck(planSummary, context, ['file planning result']), metadata: { provider: result.provider, model: result.model } };
      }

      await logAgentCall({ agentName: 'gemma', provider: result.provider, latency: Date.now() - start, success: true, context });
      return { success: true, content: prefixWithSourceCheck(parsed.response || result.content, context, ['gemma agent reasoning']), metadata: { provider: result.provider, model: result.model } };
    } catch (error) {
      await logAgentCall({ agentName: 'gemma', latency: Date.now() - start, success: false, error: error.message, context });
      return { success: false, error: error.message };
    }
  }

  parseResponse(content) {
    try { const m = content.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch {}
    return { action: 'chat', response: content };
  }
}

module.exports = new GemmaAgent();
