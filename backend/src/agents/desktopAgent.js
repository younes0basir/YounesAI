const { exec } = require('child_process');
const path = require('path');
const fallbackManager = require('./fallbackManager');
const { logAgentCall } = require('./metricsLogger');
const { prefixWithSourceCheck } = require('./context');
const tools = require('../tools');
const fileScanner = require('../desktop/fileScanner');
const documentProcessor = require('../desktop/documentProcessor');
const fileManagementTools = require('../tools/fileManagementTools');

class DesktopAgent {
  constructor() {
    this.systemPrompt = `You are a Desktop Agent. Your job is to handle natural language requests for local files and folders on the user's computer.

CRITICAL: Always extract exact paths from user messages. If a path is provided, use it exactly as given.

Capabilities:
- search: Search indexed document content using a query string. Extract a concise "query".
- scan: Scan a specific folder recursively and index all documents. Extract "folderPath".
- analyze: Extract entities and summary from a specific file. Extract "filePath".
- open: Open a file using the operating system's default handler. Extract "filePath".
- read: Read and analyze content from a file. Extract "filePath".
- list_folder: List contents of a specific folder (files and subdirectories). Extract "folderPath".
- folders: List all folders currently being watched/monitored for indexing.
- list_files: List all currently indexed files with their metadata.
- chat: Pure conversation about desktop files/folders.

Based on the user's message, select the correct action and extract parameters.
Return ONLY valid JSON:
{
  "action": "search" | "scan" | "analyze" | "open" | "read" | "list_folder" | "folders" | "list_files" | "chat",
  "query": "search term",
  "folderPath": "absolute path to folder",
  "filePath": "absolute path to file",
  "response": "conversational response if action is chat"
}

Examples:
- "Find all PDF invoices" → { "action": "search", "query": "invoice pdf" }
- "Search contracts containing the word payment" → { "action": "search", "query": "contracts payment" }
- "Scan C:\\Users\\User\\Documents" → { "action": "scan", "folderPath": "C:\\\\Users\\\\User\\\\Documents" }
- "Index folder C:\\Projects" → { "action": "scan", "folderPath": "C:\\\\Projects" }
- "Add folder C:\\Documents to indexed" → { "action": "scan", "folderPath": "C:\\\\Documents" }
- "What entities are in C:\\Docs\\report.pdf" → { "action": "analyze", "filePath": "C:\\\\Docs\\\\report.pdf" }
- "Open C:\\Users\\User\\Desktop\\report.txt" → { "action": "open", "filePath": "C:\\\\Users\\\\User\\\\Desktop\\\\report.txt" }
- "Read and summarize C:\\Docs\\invoice.csv" → { "action": "read", "filePath": "C:\\\\Docs\\\\invoice.csv" }
- "What's in C:\\Users\\User\\Downloads" → { "action": "list_folder", "folderPath": "C:\\\\Users\\\\User\\\\Downloads" }
- "List files in C:\\Documents" → { "action": "list_folder", "folderPath": "C:\\\\Documents" }
- "Show me what's in my Documents folder" → { "action": "list_folder", "folderPath": "C:\\\\Users\\\\User\\\\Documents" }
- "What folders are being watched" → { "action": "folders" }
- "Show monitored folders" → { "action": "folders" }
- "List all indexed files" → { "action": "list_files" }
- "Show me my documents" → { "action": "list_files" }

IMPORTANT: If the user provides a specific folder path like "C:\\Users\\Basir\\Documents", extract it exactly and use it for scan or list_folder actions.`;
  }

  async run(context) {
    const start = Date.now();
    try {
      const result = await fallbackManager.generateText('desktop', [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: `Message: "${context.message}"\nContext: ${JSON.stringify({ userId: context.userId })}` }
      ], { temperature: 0.3, maxTokens: 500 });

      if (!result.success) throw new Error(result.error);
      let parsed = this.parseResponse(result.content);
      if (context.action) parsed.action = context.action;
      if (context.parameters?.query && parsed.action === 'search') parsed.query = context.parameters.query;
      if (context.parameters?.folderPath && ['scan', 'list_folder'].includes(parsed.action)) parsed.folderPath = context.parameters.folderPath;
      if (context.parameters?.filePath && ['analyze', 'open', 'read'].includes(parsed.action)) parsed.filePath = context.parameters.filePath;

      if (parsed.action === 'search') {
        const docs = await tools.retrieveDocuments(context, parsed.query, { limit: 5 });
        await logAgentCall({ agentName: 'desktop', provider: result.provider, latency: Date.now() - start, success: true, context });
        if (docs.length === 0) {
          return { success: true, content: prefixWithSourceCheck(`No matching documents found for "${parsed.query}".`, context, ['desktop document search results']), metadata: { provider: result.provider, model: result.model } };
        }
        const summary = `Found ${docs.length} relevant passage(s):\n\n${docs.map((d, i) =>
          `[${i + 1}] From: ${d.file_path}\n${d.summary ? `Summary: ${d.summary}\n` : ''}Content: ${d.content.slice(0, 400)}${d.content.length > 400 ? '...' : ''}`
        ).join('\n\n')}`;
        return { success: true, content: prefixWithSourceCheck(summary, context, ['desktop document search results']), metadata: { provider: result.provider, model: result.model } };
      }

      if (parsed.action === 'scan') {
        const indexed = await fileScanner.scanAndIndex({ userId: context.userId, folderPath: parsed.folderPath });
        await logAgentCall({ agentName: 'desktop', provider: result.provider, latency: Date.now() - start, success: true, context });
        return {
          success: true,
          content: prefixWithSourceCheck(`Scanned "${parsed.folderPath}". Indexed ${indexed} new document(s) with entity extraction and embeddings.`, context, ['filesystem scan result']),
          metadata: { provider: result.provider, model: result.model }
        };
      }

      if (parsed.action === 'analyze') {
        const procResult = await documentProcessor.processDocument({ userId: context.userId, filePath: parsed.filePath });
        if (!procResult.success) {
          return { success: false, error: procResult.reason || 'Could not process document' };
        }
        const { entities } = procResult;
        const entitySummary = [
          entities.summary ? `Summary: ${entities.summary}` : '',
          entities.people?.length ? `People: ${entities.people.join(', ')}` : '',
          entities.organizations?.length ? `Organizations: ${entities.organizations.join(', ')}` : '',
          entities.dates?.length ? `Dates: ${entities.dates.join(', ')}` : '',
          entities.locations?.length ? `Locations: ${entities.locations.join(', ')}` : '',
          entities.actionItems?.length ? `Action Items:\n${entities.actionItems.map(a => `  - ${a}`).join('\n')}` : '',
        ].filter(Boolean).join('\n');
        await logAgentCall({ agentName: 'desktop', provider: result.provider, latency: Date.now() - start, success: true, context });
        return {
          success: true,
          content: prefixWithSourceCheck(`Document Analysis for "${path.basename(parsed.filePath)}":\n\n${entitySummary || 'No entities extracted.'}`, context, ['document analysis result']),
          metadata: { provider: result.provider, model: result.model }
        };
      }

      if (parsed.action === 'open') {
        const safePath = parsed.filePath.replace(/"/g, '\\"');
        exec(`start "" "${safePath}"`);
        await logAgentCall({ agentName: 'desktop', provider: result.provider, latency: Date.now() - start, success: true, context });
        return { success: true, content: prefixWithSourceCheck(`Opening file natively: "${parsed.filePath}"`, context, ['desktop open-file command']), metadata: { provider: result.provider, model: result.model } };
      }

      if (parsed.action === 'read') {
        const readResult = await fileScanner.readFile(parsed.filePath);
        if (!readResult.success) {
          return { success: false, error: readResult.error };
        }
        await logAgentCall({ agentName: 'desktop', provider: result.provider, latency: Date.now() - start, success: true, context });
        return {
          success: true,
          content: prefixWithSourceCheck(`Content of file "${path.basename(parsed.filePath)}":\n\n${readResult.content.slice(0, 1000)}${readResult.content.length > 1000 ? '\n... (truncated)' : ''}`, context, ['desktop file read result']),
          metadata: { provider: result.provider, model: result.model }
        };
      }

      if (parsed.action === 'folders') {
        const foldersResult = await tools.getIndexedFolders(context);
        await logAgentCall({ agentName: 'desktop', provider: result.provider, latency: Date.now() - start, success: true, context });
        if (!foldersResult.folders || foldersResult.folders.length === 0) {
          return { success: true, content: prefixWithSourceCheck('No folders are currently being watched or monitored.', context, ['indexed folder list']), metadata: { provider: result.provider, model: result.model } };
        }
        const folderList = foldersResult.folders.map(f => {
          const status = f.is_active ? 'Active' : 'Inactive';
          const lastScan = f.last_scan ? ` (last scan: ${new Date(f.last_scan).toLocaleDateString()})` : '';
          return `- ${f.folder_path} [${status}]${lastScan}`;
        }).join('\n');
        return { success: true, content: prefixWithSourceCheck(`Watched folders (${foldersResult.folders.length}):\n${folderList}`, context, ['indexed folder list']), metadata: { provider: result.provider, model: result.model } };
      }

      if (parsed.action === 'list_folder') {
        const listResult = await fileManagementTools.listFolderContents(parsed.folderPath);
        await logAgentCall({ agentName: 'desktop', provider: result.provider, latency: Date.now() - start, success: true, context });
        
        if (!listResult.success) {
          return { success: false, error: listResult.error, metadata: { provider: result.provider, model: result.model } };
        }

        const summary = `Contents of "${parsed.folderPath}" (${listResult.contents.length} items):\n\n${listResult.contents.map(item => {
          const type = item.isDirectory ? '[DIR]' : '[FILE]';
          const ext = item.extension ? ` (${item.extension})` : '';
          return `${type} ${item.name}${ext}`;
        }).join('\n')}`;

        return { success: true, content: prefixWithSourceCheck(summary, context, ['folder listing result']), metadata: { provider: result.provider, model: result.model } };
      }

      if (parsed.action === 'list_files') {
        const fileResult = await tools.listIndexedFiles(context, 50);
        await logAgentCall({ agentName: 'desktop', provider: result.provider, latency: Date.now() - start, success: true, context });
        if (!fileResult.files || fileResult.files.length === 0) {
          return { success: true, content: prefixWithSourceCheck('No indexed files found.', context, ['indexed file list']), metadata: { provider: result.provider, model: result.model } };
        }
        const fileList = fileResult.files.map(f =>
          `- ${f.name} (${(f.size_bytes / 1024).toFixed(1)}KB, ${f.extension}) — ${new Date(f.indexed_at).toLocaleDateString()}`
        ).join('\n');
        return { success: true, content: prefixWithSourceCheck(`Indexed files (${fileResult.files.length}):\n${fileList}`, context, ['indexed file list']), metadata: { provider: result.provider, model: result.model } };
      }

      await logAgentCall({ agentName: 'desktop', provider: result.provider, latency: Date.now() - start, success: true, context });
      return { success: true, content: prefixWithSourceCheck(parsed.response || result.content, context, ['desktop agent reasoning']), metadata: { provider: result.provider, model: result.model } };
    } catch (error) {
      await logAgentCall({ agentName: 'desktop', latency: Date.now() - start, success: false, error: error.message, context });
      return { success: false, error: error.message };
    }
  }

  parseResponse(content) {
    try { const m = content.match(/\{[\s\S]*\}/); if (m) return JSON.parse(m[0]); } catch {}
    return { action: 'chat', response: content };
  }
}

module.exports = new DesktopAgent();
