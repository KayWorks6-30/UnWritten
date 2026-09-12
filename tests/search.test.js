import test from 'node:test';
import assert from 'node:assert/strict';
import { searchEntities, uniqueTags } from '../js/domain/search.js';

const entities = [
  { id:'1', type:'event', name:'Fall of Orra', summary:'Ancient collapse', status:'Canon', tags:['ancient','major-reveal'], fields:{authorTruth:'The archive was destroyed intentionally.'}, notes:'', updatedAt:'2026-01-02' },
  { id:'2', type:'character', name:'Mara', summary:'Explorer', status:'Provisional', tags:['book-one'], fields:{falseBeliefs:'Believes Orra sank naturally.'}, notes:'Navigator', updatedAt:'2026-01-03' }
];

test('search includes nested knowledge/type fields', () => {
  assert.equal(searchEntities(entities, 'destroyed intentionally').length, 1);
  assert.equal(searchEntities(entities, 'sank naturally').length, 1);
});

test('search supports type/status/tag filtering', () => {
  assert.equal(searchEntities(entities, '', {type:'character'}).length, 1);
  assert.equal(searchEntities(entities, '', {status:'Canon'}).length, 1);
  assert.equal(searchEntities(entities, '', {tag:'ancient'}).length, 1);
});

test('uniqueTags is stable and deduplicated', () => {
  assert.deepEqual(uniqueTags(entities), ['ancient','book-one','major-reveal']);
});
