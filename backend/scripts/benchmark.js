#!/usr/bin/env node
/**
 * Provider performance benchmark.
 *
 * Tests each configured provider + model with identical prompts and reports
 * per-call latency, tokens/sec, and success rate. Run from backend/:
 *
 *   node scripts/benchmark.js            # chat mode, 3 rounds
 *   node scripts/benchmark.js 5          # 5 rounds per target
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const config = require('../src/agents/config');
const { GroqClient, NvidiaClient, OpenRouterClient } = require('../src/agents/modelClient');

const rounds = parseInt(process.argv[2], 10) || 3;

const CHAT_PROMPT = [
  { role: 'system', content: 'You are a terse assistant. Reply in one sentence.' },
  {
    role: 'user',
    content: 'Summarize the benefits of using an AI personal assistant in 15 words or fewer.',
  },
];

function fmt(ms) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms.toFixed(0)}ms`;
}

async function measure(label, fn) {
  const times = [];
  let failures = 0;
  let totalTokens = 0;
  for (let i = 0; i < rounds; i++) {
    const start = Date.now();
    try {
      const result = await fn();
      const elapsed = Date.now() - start;
      times.push(elapsed);
      if (result.success) {
        const u = result.usage || {};
        totalTokens += u.total_tokens || 0 || (u.prompt_tokens || 0) + (u.completion_tokens || 0);
      } else {
        failures++;
      }
    } catch (e) {
      failures++;
      console.log(`    round ${i + 1}: FAIL ${String(e.message).slice(0, 80)}`);
    }
  }
  const ok = times.length - failures;
  const avg = ok ? times.reduce((a, b) => a + b, 0) / ok : NaN;
  const min = ok ? Math.min(...times) : NaN;
  const max = ok ? Math.max(...times) : NaN;
  const tps = ok && avg && totalTokens ? (totalTokens / ok / (avg / 1000)).toFixed(0) : 'n/a';
  return { label, avg, min, max, ok, failures, tps };
}

function bar(ms) {
  void ms;
  return '';
}

async function run() {
  const clients = {
    groq: new GroqClient(),
    nvidia: new NvidiaClient(),
    openrouter: new OpenRouterClient(),
  };

  const targets = [
    {
      label: 'groq',
      model: config.groq.models.orchestrator,
      fn: (cfg) =>
        clients.groq.generate(
          config.groq.models.orchestrator,
          CHAT_PROMPT,
          { temperature: 0.3, maxTokens: 150 },
          cfg
        ),
      cfg: { apiKey: config.groq.apiKey, baseUrl: config.groq.baseUrl },
    },
    {
      label: 'nvidia (70B)',
      model: config.nvidia.orchestrator.model,
      fn: (cfg) =>
        clients.nvidia.generate(
          config.nvidia.orchestrator.model,
          CHAT_PROMPT,
          { temperature: 0.3, maxTokens: 150 },
          cfg
        ),
      cfg: config.nvidia.orchestrator,
    },
    {
      label: 'nvidia (8B)',
      model: config.nvidia.general.model,
      fn: (cfg) =>
        clients.nvidia.generate(
          config.nvidia.general.model,
          CHAT_PROMPT,
          { temperature: 0.3, maxTokens: 150 },
          cfg
        ),
      cfg: config.nvidia.general,
    },
    {
      label: 'openrouter',
      model: config.openrouter.models.orchestrator,
      fn: (cfg) =>
        clients.openrouter.generate(
          config.openrouter.models.orchestrator,
          CHAT_PROMPT,
          { temperature: 0.3, maxTokens: 150 },
          cfg
        ),
      cfg: {
        apiKey: config.openrouter.apiKey,
        baseUrl: config.openrouter.baseUrl,
        extraHeaders: {
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Multi-Agent System',
        },
      },
    },
  ];

  console.log(`\nChat benchmark — ${rounds} round${rounds > 1 ? 's' : ''} per target\n`);

  const results = [];
  for (const t of targets) {
    const r = await measure(t.label, () => t.fn(t.cfg));
    results.push(r);
    console.log(
      `${t.label.padEnd(16)} ${String(t.model).padEnd(30)} avg ${fmt(r.avg).padStart(8)}  ` +
        `min ${fmt(r.min).padStart(8)}  max ${fmt(r.max).padStart(8)}  ok ${r.ok}/${rounds}  tok/s ${r.tps}`
    );
    void bar;
  }

  console.log('\n── Sorted by average latency ──');
  results.sort((a, b) => a.avg - b.avg);
  results.forEach((r, i) => {
    console.log(
      `  ${i + 1}. ${r.label.padEnd(16)} ${fmt(r.avg).padStart(8)}  (ok ${r.ok}/${r.ok + r.failures})`
    );
  });
  console.log('');
}

run().catch((e) => {
  console.error('Benchmark error:', e);
  process.exit(1);
});
