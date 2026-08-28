/**
 * Acceptance conversation scenarios for unified chat (manual / integration).
 * Run against a live backend with: node tests/acceptance-conversations.test.js
 *
 * Requires TEST_AUTH_TOKEN and TEST_API_URL env vars.
 */
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

const API_URL = process.env.TEST_API_URL || 'http://localhost:3000/api';
const TOKEN = process.env.TEST_AUTH_TOKEN;

async function chat(message, sessionId) {
  if (!TOKEN) {
    return { skipped: true };
  }
  const res = await fetch(`${API_URL}/agents/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({ message, sessionId }),
  });
  return res.json();
}

describe('Acceptance conversations (integration)', () => {
  it('Conversation 1: create meeting then move it', async () => {
    if (!TOKEN) return;
    const sessionId = crypto.randomUUID();
    const r1 = await chat('Create a meeting tomorrow at 3pm called AI Demo', sessionId);
    assert.equal(r1.success, true);
    assert.ok(r1.agents?.includes('event') || r1.response?.toLowerCase().includes('event'));

    const r2 = await chat('Move it to Friday at 4pm', sessionId);
    assert.equal(r2.success, true);
    assert.ok(
      r2.response?.toLowerCase().includes('updat') ||
        r2.steps?.some((s) => s.summary?.includes('updated'))
    );
  });

  it('Conversation 3: multi-intent project + meeting + logo', async () => {
    if (!TOKEN) return;
    const sessionId = crypto.randomUUID();
    const r = await chat('Create a project. Create a meeting. Generate a logo.', sessionId);
    assert.equal(r.success, true);
    assert.ok((r.agents?.length || 0) >= 2 || r.steps?.length >= 2);
  });
});
