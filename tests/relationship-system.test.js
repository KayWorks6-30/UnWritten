import test from 'node:test';
import assert from 'node:assert/strict';
import { relationDisplayLabel, relationSemantics, isDirectionalRelation, relationshipWarnings, relationMatchesFilters } from '../js/domain/relations.js';
import { familyNetwork, neighborhood } from '../js/domain/graphs.js';

test('directional relationships render inverse labels without changing canonical type',()=>{
  const rel={id:'r',fromId:'parent',toId:'child',type:'parent_of'};
  assert.equal(relationDisplayLabel(rel,'parent'),'Child');
  assert.equal(relationDisplayLabel(rel,'child'),'Parent');
  assert.equal(rel.type,'parent_of');
  assert.equal(isDirectionalRelation('parent_of'),true);
});

test('symmetric personal and family relationships read naturally from either side',()=>{
  for(const type of ['friend_of','sibling_of','spouse_of']){
    const rel={id:type,fromId:'a',toId:'b',type};
    assert.equal(relationDisplayLabel(rel,'a'),relationDisplayLabel(rel,'b'));
    assert.equal(relationSemantics(type).symmetric,true);
  }
});

test('relationship warnings catch exact duplicates including reversed symmetric storage',()=>{
  const existing=[{id:'1',fromId:'a',toId:'b',type:'friend_of',eraId:'e',activeFrom:'1',activeTo:'2'}];
  const warnings=relationshipWarnings({id:'2',fromId:'b',toId:'a',type:'friend_of',eraId:'e',activeFrom:'1',activeTo:'2'},existing);
  assert.equal(warnings.some(w=>w.kind==='duplicate'),true);
});

test('relationship warnings flag circular parent claims but do not block unusual fiction',()=>{
  const existing=[{id:'1',fromId:'a',toId:'b',type:'parent_of',eraId:null,activeFrom:'',activeTo:''}];
  const warnings=relationshipWarnings({id:'2',fromId:'b',toId:'a',type:'parent_of',eraId:null,activeFrom:'',activeTo:''},existing);
  assert.equal(warnings.some(w=>w.kind==='contradiction'),true);
});

test('relationship filter respects type, era, and free-form active-period query',()=>{
  const rel={type:'ally_of',eraId:'age2',activeFrom:'Year 120',activeTo:'Year 138'};
  assert.equal(relationMatchesFilters(rel,{types:['ally_of'],eraId:'age2',activeQuery:'138'}),true);
  assert.equal(relationMatchesFilters(rel,{types:[],eraId:'',activeQuery:''}),false);
  assert.equal(relationMatchesFilters(rel,{types:['enemy_of']}),false);
});

test('family network derives generations and keeps adoptive/guardian edges canonical',()=>{
  const rels=[
    {id:'p',fromId:'p',toId:'root',type:'parent_of'},
    {id:'half',fromId:'p',toId:'sib',type:'parent_of'},
    {id:'a',fromId:'adoptive',toId:'root',type:'adoptive_parent_of'},
    {id:'g',fromId:'guardian',toId:'root',type:'guardian_of'},
    {id:'s',fromId:'root',toId:'spouse',type:'former_spouse_of'},
    {id:'c',fromId:'root',toId:'child',type:'parent_of'}
  ];
  const net=familyNetwork('root',rels,3);
  assert.equal(net.levels.get('p'),-1);
  assert.equal(net.levels.get('sib'),0);
  assert.equal(net.levels.get('child'),1);
  assert.equal(net.edges.some(r=>r.type==='adoptive_parent_of'),true);
  assert.equal(net.edges.some(r=>r.type==='guardian_of'),true);
  assert.equal(net.edges.some(r=>r.type==='former_spouse_of'),true);
});

test('bounded neighborhood still limits traversal depth for large relationship sets',()=>{
  const rels=[{id:'1',fromId:'a',toId:'b',type:'friend_of'},{id:'2',fromId:'b',toId:'c',type:'friend_of'},{id:'3',fromId:'c',toId:'d',type:'friend_of'}];
  assert.deepEqual(new Set(neighborhood('a',rels,1).ids),new Set(['a','b']));
  assert.deepEqual(new Set(neighborhood('a',rels,2).ids),new Set(['a','b','c']));
  assert.equal(neighborhood('a',rels,9).ids.includes('d'),true); // depth clamps to 3
});
