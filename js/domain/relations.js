import { RELATION_TYPES } from './schema.js';
export function relationsFor(entityId, relations) {
  return relations.filter(r => r.fromId === entityId || r.toId === entityId);
}

export function otherEntityId(relation, entityId) {
  return relation.fromId === entityId ? relation.toId : relation.fromId;
}

export function relationDirection(relation, entityId) {
  return relation.fromId === entityId ? 'outgoing' : 'incoming';
}

export function validateRelation(relation) {
  const errors = [];
  if (!relation?.id) errors.push('Relation requires an id.');
  if (!relation?.fromId || !relation?.toId) errors.push('Relation requires both endpoints.');
  if (relation?.fromId === relation?.toId) errors.push('An entry cannot relate to itself.');
  if (!relation?.type) errors.push('Relation type is required.');
  else if (!RELATION_TYPES.includes(relation.type)) errors.push('Relation type is invalid.');
  return errors;
}
