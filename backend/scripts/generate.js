#!/usr/bin/env node
/**
 * Scaffold a new tool, agent, or route with consistent wiring.
 *
 * Usage:
 *   node scripts/generate.js tool <name>
 *   node scripts/generate.js agent <name>
 *   node scripts/generate.js route <name>
 *
 * Examples:
 *   node scripts/generate.js tool summarizeDocument
 *   node scripts/generate.js agent travel
 *   node scripts/generate.js route files
 */
const fs = require('fs');
const path = require('path');

const kind = process.argv[2];
const name = process.argv[3];

if (!kind || !name) {
  console.error('Usage: node scripts/generate.js <tool|agent|route> <name>');
  process.exit(1);
}

const camel = name[0].toLowerCase() + name.slice(1);
const Pascal = name[0].toUpperCase() + name.slice(1);
const baseDir = path.join(__dirname, '..', 'src');
const targets = {
  tool: {
    dir: path.join(baseDir, 'tools'),
    file: `${camel}.js`,
    content: `const pool = require('../db');

async function ${camel}(context, data) {
  try {
    return { success: true, result: null };
  } catch (err) {
    console.error('[${camel}] error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = ${camel};
`,
  },
  agent: {
    dir: path.join(baseDir, 'agents'),
    file: `${camel}Agent.js`,
    content: `const fallbackManager = require('./fallbackManager');
const { logAgentCall } = require('./metricsLogger');
const { buildSystemPromptContext, prefixWithSourceCheck } = require('./context');
const tools = require('../tools');

class ${Pascal}Agent {
  constructor() {
    this.systemPrompt = \`You are a ${name} agent. Extract structured JSON from the user's message.

Return ONLY valid JSON:
{
  "action": "chat",
  "parameters": {},
  "response": "brief text"
}\`;
  }

  async run(context) {
    const start = Date.now();
    try {
      const contextSummary = buildSystemPromptContext(context);
      const userContent = \`Message: "\${context.message}"\\nUser Context:\n\${contextSummary}\`;
      const provider = await fallbackManager.routeToProvider('${camel}', '${name}', [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: userContent },
      ]);

      const parsed = await fallbackManager.parseProviderResponse(provider);
      if (!parsed.success) {
        return { success: false, error: parsed.error, message: 'Unable to understand that request.' };
      }

      await logAgentCall({ context, agentName: '${camel}', start, provider, parsed });

      if (prefixWithSourceCheck) {
        parsed.response = prefixWithSourceCheck(parsed.response, '${name}');
      }
      return { success: true, ...parsed };
    } catch (err) {
      console.error('❌ ${Pascal}Agent error:', err.message);
      return { success: false, error: err.message };
    }
  }
}

module.exports = new ${Pascal}Agent();
`,
  },
  route: {
    dir: path.join(baseDir, 'routes'),
    file: `${camel}.js`,
    content: `const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');

// GET /api/${camel}/ping — auth required
router.get('/ping', authMiddleware, (req, res) => {
  res.json({ success: true, data: 'pong' });
});

module.exports = router;
`,
  },
};

const target = targets[kind];
if (!target) {
  console.error(`Unknown kind "${kind}". Expected one of: tool, agent, route.`);
  process.exit(1);
}

const filePath = path.join(target.dir, target.file);
if (fs.existsSync(filePath)) {
  console.error(`Already exists: ${filePath}`);
  process.exit(1);
}

fs.writeFileSync(filePath, target.content, 'utf8');
console.log(`Created ${filePath}`);
console.log('Next steps (manual):');
if (kind === 'tool') console.log(`  - export it from src/tools/index.js`);
if (kind === 'agent') {
  console.log(`  - register it in src/agents/index.js (agents map)`);
  console.log(`  - add a routing hint in src/agents/orchestrator.js`);
}
if (kind === 'route') console.log(`  - mount it in src/app.js (app.use('/api/${camel}', router))`);
