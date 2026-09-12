import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTRY_TYPES, CANON_STATUSES, QUESTION_STATUSES, IDEA_STATUSES, createEmptyEntity, validateEntity, validStatusesFor } from '../js/domain/schema.js';

test('every entry type has unique field keys', () => {
  for (const [type, def] of Object.entries(ENTRY_TYPES)) {
    const keys = (def.fields || []).map(f => f.key);
    assert.equal(new Set(keys).size, keys.length, `${type} has duplicate field keys`);
  }
});

test('new lore entity starts as Concept and validates once named', () => {
  const e = createEmptyEntity('lore');
  assert.equal(e.status, 'Concept');
  e.name = 'Test Lore';
  assert.deepEqual(validateEntity(e), []);
});

test('question status system stays separate from canon statuses', () => {
  assert.deepEqual(validStatusesFor('question'), QUESTION_STATUSES);
  assert.deepEqual(validStatusesFor('character'), CANON_STATUSES);
  const q = createEmptyEntity('question');
  assert.equal(q.status, 'Open');
});

test('idea status system is separate from canon statuses', () => {
  assert.deepEqual(validStatusesFor('idea'), IDEA_STATUSES);
  assert.equal(createEmptyEntity('idea').status, 'Inbox');
});

test('unknown types fail validation', () => {
  const e = createEmptyEntity('lore');
  e.name = 'Bad type';
  e.type = 'not-real';
  assert.ok(validateEntity(e).some(x => x.includes('Unknown entity type')));
});
