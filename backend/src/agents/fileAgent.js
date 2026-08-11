const path = require('path');
const fallbackManager = require('./fallbackManager');
const { logAgentCall } = require('./metricsLogger');
const { prefixWithSourceCheck } = require('./context');
const tools = require('../tools');

const ADMIN_ACTIONS = ['getIndexedFolders', 'getIndexedFolderCount', 'getIndexedFiles', 'getIndexedDocumentCount', 'getRecentIndexedFiles', 'getFolderStatistics'];

class FileAgent {
  constructor() {
    this.systemPrompt = `You are a File Agent. You manage and retrieve information regarding local files, monitored/indexed folders, document counts, and indexing statistics.

Based on the user's request, identify if it requires querying indexed file/folder metadata database records.
For administrative file questions, select one of the following actions:
- getIndexedFolders: list all active folders being watched/monitored.
- getIndexedFolderCount: count monitored folders.
- getIndexedFiles: list all unique indexed document files.
- getIndexedDocumentCount: count total document text chunks indexed.
- getRecentIndexedFiles: list most recently indexed files.
- getFolderStatistics: view folder indexing statistics (total folders, files, text chunks/segments, type breakdown).
- search: search actual file catalogs or semantic file content.
- chat: fallback for basic conversations or explaining tool outputs.

Return ONLY valid JSON:
{
  "action": "getIndexedFolders" | "getIndexedFolderCount" | "getIndexedFiles" | "getIndexedDocumentCount" | "getRecentIndexedFiles" | "getFolderStatistics" | "search" | "chat",
  "query": "search query if action is search",
  "response": "conversational response if action is chat"
}

Examples:
- "What folders are indexed?" or "Show indexed folders" → { "action": "getIndexedFolders" }
- "How many folders are indexed?" or "monitored folder count" → { "action": "getIndexedFolderCount" }
- "What files are indexed?" or "List indexed files" → { "action": "getIndexedFiles" }
- "How many documents are indexed?" or "show document count" → { "action": "getIndexedDocumentCount" }
- "Show recent indexed documents" or "recent files" → { "action": "getRecentIndexedFiles" }
- "Show folder statistics" or "indexed statistics" → { "action": "getFolderStatistics" }
- "Find files about billing" → { "action": "search", "query": "billing" }
`;
  }

  classifyByPattern(message) {
    const lower = message.toLowerCase();
    if (/indexed folder|monitored folder|folders are indexed|show indexed folders/.test(lower)) {
      if (/count|how many/.test(lower)) return 'getIndexedFolderCount';
      return 'getIndexedFolders';
    }
    if (/files are indexed|indexed file|document count|how many document|indexed document/.test(lower)) {
      if (/count|how many/.test(lower)) return 'getIndexedDocumentCount';
      if (/recent/.test(lower)) return 'getRecentIndexedFiles';
      if (/statistics/.test(lower)) return 'getFolderStatistics';
      return 'getIndexedFiles';
    }
    if (/folder statistics|statistics/.test(lower)) return 'getFolderStatistics';
    if (/recent document|recent file/.test(lower)) return 'getRecentIndexedFiles';
    if (/search|find|about|mention|what.*say|content|document.*contain/.test(lower)) return 'search';
    return 'chat';
  }

  formatResponse(action, result, searchQuery) {
    if (action === 'search') {
      if (!result || (!result.files?.length && !result.deepDocs?.length)) {
        return `No results found${searchQuery ? ` for "${searchQuery}"` : ''}.`;
      }
      const lines = [];
      if (result.files?.length > 0) {
        lines.push(`[Workspace Files] (${result.files.length}):`);
        for (const f of result.files) {
          lines.push(`- ${f.name}  (${f.path})`);
        }
      }
      if (result.deepDocs?.length > 0) {
        lines.push('');
        lines.push(`[Document Matches] (${result.deepDocs.length}):`);
        for (const d of result.deepDocs) {
          const filename = path.basename(d.file_path);
          const snippet = (d.summary || d.content || '').slice(0, 250);
          lines.push(`- [${d.file_type || 'unknown'}] ${filename}`);
          lines.push(`  > "${snippet}"`);
        }
      }
      return lines.join('\n');
    }

    const items = result?.files || result?.folders || result?.statistics || result;
    const isEmpty = !items || (Array.isArray(items) && items.length === 0);

    if (action === 'getIndexedFolders') {
      if (!Array.isArray(items) || items.length === 0) return 'No folders are currently indexed or monitored.';
      const lines = items.map((f) => {
        const display = f.folder_path.startsWith('web://') ? f.folder_path.replace('web://', '') : f.folder_path.split(/[\\/]/).pop() || f.folder_path;
        return `- ${display}  (${f.folder_path})`;
      });
      return `${items.length} indexed folder(s):\n${lines.join('\n')}`;
    }

    if (action === 'getIndexedFiles') {
      if (!Array.isArray(items) || items.length === 0) return 'No files are indexed yet.';
      const lines = items.map((f) => `- ${f.file_path}  (${f.file_type || 'unknown'})  [last indexed at ${new Date(f.indexed_at || Date.now()).toLocaleString()}]`);
      return `${items.length} indexed file(s):\n${lines.join('\n')}`;
    }

    if (action === 'getIndexedDocumentCount') {
      const count = typeof items === 'number' ? items : (items?.count ?? 0);
      return `Total indexed document chunks: ${count}.`;
    }

    if (action === 'getRecentIndexedFiles') {
      if (!Array.isArray(items) || items.length === 0) return 'No recent files found.';
      const lines = items.slice(0, 10).map((f) => {
        const name = path.basename(f.file_path || f.name || '');
        return `- ${name}  (${f.file_type || 'unknown'})  [${new Date(f.indexed_at || f.created_at || Date.now()).toLocaleString()}]`;
      });
      return `Recent files (${Math.min(items.length, 10)} shown):\n${lines.join('\n')}`;
    }

    if (action === 'getFolderStatistics') {
      if (!items) return 'No statistics available.';
      const lines = [
        `- Folders: ${items.foldersCount}`,
        `- Files: ${items.filesCount}`,
        `- Chunks: ${items.chunksCount}`,
      ];
      if (Array.isArray(items.types) && items.types.length > 0) {
        lines.push('- Types:');
        for (const t of items.types) {
          lines.push(`  - ${t.file_type}: ${t.count}`);
        }
      }
      return lines.join('\n');
    }

    return isEmpty ? 'No results.' : JSON.stringify(items);
  }

  async run(context) {
    const start = Date.now();
    const queryMessage = context.message;
    console.log(`[FILE_AGENT]\nQuestion: ${queryMessage}`);

    try {
      let action = 'chat';
      let searchQuery = null;
      let providerUsed = null;

      // If orchestrator provided a known action, use it directly
      if (context.action && ADMIN_ACTIONS.includes(context.action)) {
        action = context.action;
      } else if (context.action === 'search') {
        action = 'search';
        searchQuery = context.parameters?.query || queryMessage;
      }

      let llmResult = null;
      // Step 1: Try LLM classification, fall back to pattern matching (unless action was forced)
      if (!ADMIN_ACTIONS.includes(action) && action !== 'search') {
        llmResult = await fallbackManager.generateText('file', [
          { role: 'system', content: this.systemPrompt },
          { role: 'user', content: `Message: "${queryMessage}"` }
        ], { temperature: 0.1, maxTokens: 400 });
      }

      if (llmResult?.success) {
        providerUsed = llmResult.provider;
        const parsed = this.parseResponse(llmResult.content);
        action = parsed.action || 'chat';
        searchQuery = parsed.query || null;
      } else if (!ADMIN_ACTIONS.includes(action) && action !== 'search') {
        console.log('[FILE_AGENT] LLM classification failed, using pattern fallback');
        action = this.classifyByPattern(queryMessage);
        if (action === 'search') {
          searchQuery = queryMessage.replace(/^(search|find|show|list|get|what)\s+/i, '').trim();
        }
      }

      // Step 2: Execute action
      if (ADMIN_ACTIONS.includes(action)) {
        const toolFn = tools[action];
        if (typeof toolFn !== 'function') {
          throw new Error(`Tool action "${action}" is not implemented on the tools layer.`);
        }
        console.log(`[FILE_TOOL_CALLED]\n${action}()`);
        const toolResult = await toolFn(context);
        await logAgentCall({ agentName: 'file', provider: providerUsed, latency: Date.now() - start, success: true, context });

        const content = prefixWithSourceCheck(this.formatResponse(action, toolResult), context, ['indexed file database']);

        return {
          success: true,
          content,
          metadata: { provider: providerUsed, model: null, fallback: !providerUsed }
        };
      }

      if (action === 'search') {
        const query = searchQuery || queryMessage;
        console.log(`[FILE_TOOL_CALLED]\nsearchFiles() & retrieveDocuments()`);
        const searchResult = await tools.searchFiles(context, query);
        const deepDocs = await tools.retrieveDocuments(context, query, { limit: 5, folderPath: context.activeFolder?.folderPath });

        await logAgentCall({ agentName: 'file', provider: providerUsed, latency: Date.now() - start, success: true, context });

        const content = prefixWithSourceCheck(this.formatResponse('search', { files: searchResult.files, deepDocs }, query), context, ['indexed file database', 'document search results']);

        return { success: true, content: content.trim(), metadata: { provider: providerUsed, model: null, fallback: !providerUsed } };
      }

      // Default chat action
      await logAgentCall({ agentName: 'file', provider: providerUsed, latency: Date.now() - start, success: true, context });
      return { success: true, content: prefixWithSourceCheck('I can help you manage files and folders. Try "list files", "show folders", or "find documents about [topic]".', context, ['file agent reasoning']), metadata: { provider: providerUsed } };

    } catch (error) {
      console.error('[FILE_AGENT] Error processing request:', error);
      await logAgentCall({ agentName: 'file', latency: Date.now() - start, success: false, error: error.message, context });
      return { success: false, error: error.message };
    }
  }

  parseResponse(content) {
    try {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
    } catch {}
    return { action: 'chat', response: content };
  }
}

module.exports = new FileAgent();
