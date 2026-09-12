function flatten(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.map(flatten).join(' ');
  if (typeof value === 'object') return Object.values(value).map(flatten).join(' ');
  return '';
}

export function entitySearchText(entity) {
  return [entity.name, entity.summary, entity.status, ...(entity.tags || []), flatten(entity.fields), entity.notes]
    .filter(Boolean).join(' ').toLowerCase();
}

export function searchEntities(entities, query, { type = null, status = null, tag = null } = {}) {
  const q = String(query || '').trim().toLowerCase();
  return entities
    .filter(e => !type || e.type === type)
    .filter(e => !status || e.status === status)
    .filter(e => !tag || (e.tags || []).includes(tag))
    .filter(e => !q || entitySearchText(e).includes(q))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function uniqueTags(entities) {
  return [...new Set(entities.flatMap(e => e.tags || []))].sort((a, b) => a.localeCompare(b));
}
