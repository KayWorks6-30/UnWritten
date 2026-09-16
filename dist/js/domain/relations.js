import { RELATION_TYPES, RELATION_STATUSES } from './schema.js';

const HUMAN = value => String(value || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase());

export const RELATION_SEMANTICS = Object.freeze({
  related_to:{out:'Related to',in:'Related to',category:'other',symmetric:true},
  parent_of:{out:'Child',in:'Parent',edge:'Parent of',category:'family',directed:true},
  child_of:{out:'Parent',in:'Child',edge:'Child of',category:'family',directed:true},
  sibling_of:{out:'Sibling',in:'Sibling',category:'family',symmetric:true},
  friend_of:{out:'Friend',in:'Friend',category:'personal',symmetric:true},
  rival_of:{out:'Rival',in:'Rival',category:'personal',symmetric:true},
  enemy_of:{out:'Enemy',in:'Enemy',category:'personal',symmetric:true},
  romantic_with:{out:'Romantic relationship',in:'Romantic relationship',category:'personal',symmetric:true},
  mentor_of:{out:'Student',in:'Mentor',edge:'Mentor of',category:'personal',directed:true},
  student_of:{out:'Mentor',in:'Student',edge:'Student of',category:'personal',directed:true},
  ally_of:{out:'Ally',in:'Ally',category:'political',symmetric:true},
  political_enemy_of:{out:'Political enemy',in:'Political enemy',category:'political',symmetric:true},
  member_of:{out:'Member of',in:'Member',category:'affiliation',directed:true},
  located_in:{out:'Located in',in:'Contains / location of',category:'other',directed:true},
  belongs_to:{out:'Belongs to',in:'Includes',category:'affiliation',directed:true},
  created_by:{out:'Created by',in:'Creation',category:'creation',directed:true},
  owned_by:{out:'Owned by',in:'Owns',category:'affiliation',directed:true},
  participated_in:{out:'Participated in',in:'Participant',category:'historical',directed:true},
  influenced:{out:'Influenced',in:'Influenced by',category:'creation',directed:true},
  appears_in:{out:'Appears in',in:'Features',category:'story',directed:true},
  introduced_in:{out:'Introduced in',in:'Introduces',category:'story',directed:true},
  clue_in:{out:'Clue in',in:'Has clue',category:'story',directed:true},
  revealed_in:{out:'Revealed in',in:'Reveals',category:'story',directed:true},
  foreshadows:{out:'Foreshadows',in:'Foreshadowed by',category:'story',directed:true},
  contradicts:{out:'Contradicts',in:'Contradicted by',category:'story',symmetric:true},
  supports:{out:'Supports',in:'Supported by',category:'story',directed:true},
  converted_to:{out:'Converted to',in:'Converted from',category:'other',directed:true},
  spouse_of:{out:'Spouse',in:'Spouse',category:'family',symmetric:true},
  former_spouse_of:{out:'Former spouse',in:'Former spouse',category:'family',symmetric:true},
  guardian_of:{out:'Ward',in:'Guardian',edge:'Guardian of',category:'family',directed:true},
  adoptive_parent_of:{out:'Adopted child',in:'Adoptive parent',edge:'Adoptive parent of',category:'family',directed:true},
  allied_with:{out:'Allied with',in:'Allied with',category:'political',symmetric:true},
  hostile_to:{out:'Hostile to',in:'Hostile to',category:'political',symmetric:true},
  neutral_with:{out:'Neutral with',in:'Neutral with',category:'political',symmetric:true},
  vassal_of:{out:'Vassal of',in:'Has vassal',category:'political',directed:true},
  trade_partner_with:{out:'Trade partner',in:'Trade partner',category:'political',symmetric:true},
  occupied_by:{out:'Occupied by',in:'Occupies',category:'political',directed:true},
  at_war_with:{out:'At war with',in:'At war with',category:'political',symmetric:true},
  contains:{out:'Contains',in:'Part of',category:'other',directed:true},
  part_of:{out:'Part of',in:'Contains',category:'other',directed:true},
  precedes:{out:'Precedes',in:'Follows',category:'historical',directed:true},
  requires:{out:'Requires',in:'Required by',category:'other',directed:true}
});

export const RELATION_CATEGORY_LABELS = Object.freeze({
  family:'Family', personal:'Personal', affiliation:'Affiliations', political:'Political', historical:'Historical', creation:'Creation / Influence', story:'Story Connections', other:'Other'
});

export function relationSemantics(type){
  return RELATION_SEMANTICS[type] || {out:HUMAN(type),in:HUMAN(type),edge:HUMAN(type),category:'other',directed:true};
}
export function isSymmetricRelation(type){ return Boolean(relationSemantics(type).symmetric); }
export function isDirectionalRelation(type){ return !isSymmetricRelation(type); }
export function relationCategory(type){ return relationSemantics(type).category || 'other'; }
export function relationEdgeLabel(type){ return relationSemantics(type).edge || HUMAN(type); }

export function relationsFor(entityId, relations) {
  return relations.filter(r => r.fromId === entityId || r.toId === entityId);
}
export function otherEntityId(relation, entityId) { return relation.fromId === entityId ? relation.toId : relation.fromId; }
export function relationDirection(relation, entityId) { return relation.fromId === entityId ? 'outgoing' : 'incoming'; }
export function relationDisplayLabel(relation, entityId){
  const semantic=relationSemantics(relation?.type);
  return relation?.fromId===entityId ? semantic.out : semantic.in;
}
export function relationDisplay(relation, entityId){
  return {...relationSemantics(relation?.type), direction:relationDirection(relation,entityId), label:relationDisplayLabel(relation,entityId), otherId:otherEntityId(relation,entityId)};
}
export function relationGroupEntries(entityId, relations){
  const groups={};
  for(const relation of relationsFor(entityId,relations)){
    const display=relationDisplay(relation,entityId);
    (groups[display.category] ||= []).push({relation,display});
  }
  return groups;
}

function samePeriod(a,b){ return (a.eraId||'')===(b.eraId||'') && (a.activeFrom||'')===(b.activeFrom||'') && (a.activeTo||'')===(b.activeTo||''); }
function sameEndpoints(a,b){
  if(isSymmetricRelation(a.type) && a.type===b.type) return (a.fromId===b.fromId&&a.toId===b.toId)||(a.fromId===b.toId&&a.toId===b.fromId);
  return a.fromId===b.fromId&&a.toId===b.toId;
}
export function relationshipWarnings(candidate, existing=[]){
  const warnings=[];
  for(const relation of existing){
    if(relation.id===candidate.id) continue;
    if(relation.type===candidate.type && sameEndpoints(candidate,relation) && samePeriod(candidate,relation)){
      warnings.push({kind:'duplicate',message:'An exact matching relationship already exists for these entities and this time period.'});
      break;
    }
  }
  const inverseEquivalent=new Set(['parent_of|child_of','child_of|parent_of','mentor_of|student_of','student_of|mentor_of']);
  for(const relation of existing){
    if(relation.id===candidate.id || !samePeriod(candidate,relation)) continue;
    if(candidate.fromId===relation.toId&&candidate.toId===relation.fromId&&inverseEquivalent.has(`${candidate.type}|${relation.type}`)){
      warnings.push({kind:'duplicate',message:'An equivalent inverse relationship already exists for these entities and this time period.'});
    }
  }
  const contradictoryPairs=new Set(['parent_of|child_of','child_of|parent_of']);
  for(const relation of existing){
    if(relation.id===candidate.id || !samePeriod(candidate,relation)) continue;
    const samePair=(candidate.fromId===relation.fromId&&candidate.toId===relation.toId);
    const reversed=(candidate.fromId===relation.toId&&candidate.toId===relation.fromId);
    if(samePair && contradictoryPairs.has(`${candidate.type}|${relation.type}`)) warnings.push({kind:'contradiction',message:'This may conflict with an existing parent/child relationship for the same period.'});
    if(reversed && candidate.type==='parent_of' && relation.type==='parent_of') warnings.push({kind:'contradiction',message:'Both entities would be recorded as the parent of the other for the same period.'});
    if(reversed && candidate.type==='child_of' && relation.type==='child_of') warnings.push({kind:'contradiction',message:'Both entities would be recorded as the child of the other for the same period.'});
  }
  return [...new Map(warnings.map(w=>[w.message,w])).values()];
}
export const DEFAULT_PROJECTABLE_RELATION_STATUSES = ['Canon','Provisional','Unknown'];

export function relationStatus(relation){ return relation?.status || 'Canon'; }
export function relationEndpointsProjectable(relation,entities=[]){
  if(!entities?.length) return true;
  const byId=entities instanceof Map?entities:new Map(entities.map(entity=>[entity.id,entity]));
  const blocked=new Set(['Contradicted','Shelved']);
  return !blocked.has(byId.get(relation.fromId)?.status) && !blocked.has(byId.get(relation.toId)?.status);
}
export function relationIsProjectable(relation,entities=[]){
  return DEFAULT_PROJECTABLE_RELATION_STATUSES.includes(relationStatus(relation)) && relationEndpointsProjectable(relation,entities);
}

export function validateRelation(relation) {
  const errors = [];
  if (!relation?.id) errors.push('Relation requires an id.');
  if (!relation?.fromId || !relation?.toId) errors.push('Relation requires both endpoints.');
  if (relation?.fromId === relation?.toId) errors.push('An entry cannot relate to itself.');
  if (!relation?.type) errors.push('Relation type is required.');
  else if (!RELATION_TYPES.includes(relation.type)) errors.push('Relation type is invalid.');
  if (relation?.status && !RELATION_STATUSES.includes(relation.status)) errors.push('Relation status is invalid.');
  return errors;
}

export function relationMatchesFilters(relation,{types=null,statuses=DEFAULT_PROJECTABLE_RELATION_STATUSES,eraId='',activeQuery=''}={}){
  if(Array.isArray(types) && !types.includes(relation.type)) return false;
  if(Array.isArray(statuses) && !statuses.includes(relationStatus(relation))) return false;
  if(eraId && relation.eraId!==eraId) return false;
  if(activeQuery){ const q=String(activeQuery).trim().toLowerCase(); if(q && !`${relation.activeFrom||''} ${relation.activeTo||''}`.toLowerCase().includes(q)) return false; }
  return true;
}
