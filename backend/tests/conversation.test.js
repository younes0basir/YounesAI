const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const entityResolver = require('../src/conversation/entityResolver');
const { resolveInputBindings } = require('../src/conversation/executionPlan');
const entityRegistry = require('../src/conversation/entityRegistry');
const ConversationContext = require('../src/conversation/ConversationContext');

describe('entityResolver', () => {
  it('passes through messages without references', async () => {
    const result = await entityResolver.resolve('Create a task buy milk', null, {});
    assert.equal(result.bindings.length, 0);
    assert.equal(result.resolvedMessage, 'Create a task buy milk');
  });

  it('resolves "it" from session currentEvent', async () => {
    const session = ConversationContext.emptyState('user-1', 'sess-1');
    ConversationContext.registerEntity(session, 'event', 'evt-42', 'AI Demo');

    const result = await entityResolver.resolve('Move it to 4pm', session, {});
    assert.equal(result.bindings.length, 1);
    assert.equal(result.bindings[0].id, 'evt-42');
    assert.equal(result.resolvedParameters.eventId, 'evt-42');
  });
});

describe('executionPlan.resolveInputBindings', () => {
  it('binds step outputs into parameters', () => {
    const executionResults = {
      2: { toolResult: { event: { id: 'evt-99', title: 'Demo' } } },
    };
    const resolved = resolveInputBindings({ eventId: '$step:2.event.id' }, executionResults);
    assert.equal(resolved.eventId, 'evt-99');
  });
});

describe('entityRegistry', () => {
  it('registers event from toolResult', () => {
    const session = ConversationContext.emptyState('user-1', 'sess-1');
    const updated = entityRegistry.applyResults(session, [
      {
        agent: 'event',
        success: true,
        action: 'create',
        toolResult: { event: { id: 'evt-1', title: 'Meet' } },
      },
    ]);
    assert.equal(updated.currentEvent.id, 'evt-1');
    assert.equal(updated.activeEntities.event.id, 'evt-1');
  });
});
