import test from 'node:test';
import assert from 'node:assert/strict';
import { relationsFor, otherEntityId, relationDirection, validateRelation } from '../js/domain/relations.js';

const relation = { id:'r1', fromId:'a', toId:'b', type:'parent_of' };

test('relation helpers preserve endpoints and direction', () => {
  assert.equal(otherEntityId(relation, 'a'), 'b');
  assert.equal(otherEntityId(relation, 'b'), 'a');
  assert.equal(relationDirection(relation, 'a'), 'outgoing');
  assert.equal(relationDirection(relation, 'b'), 'incoming');
  assert.deepEqual(relationsFor('a', [relation]), [relation]);
});

test('self relationships are rejected', () => {
  assert.ok(validateRelation({id:'x', fromId:'a', toId:'a', type:'related_to'}).length > 0);
});
