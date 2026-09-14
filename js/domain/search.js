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

export function searchEntities(entities, query, { type = null, status = null, tag = null, tags = null, tagMode = 'all' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const selectedTags = [...new Set([...(Array.isArray(tags) ? tags : []), ...(tag ? [tag] : [])].filter(Boolean))];
  return entities
    .filter(e => !type || e.type === type)
    .filter(e => !status || e.status === status)
    .filter(e => {
      if (!selectedTags.length) return true;
      const entityTags = new Set(e.tags || []);
      return tagMode === 'any' ? selectedTags.some(t => entityTags.has(t)) : selectedTags.every(t => entityTags.has(t));
    })
    .filter(e => !q || entitySearchText(e).includes(q))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export function sortEntities(entities, mode = 'updated-desc') {
  const rows = [...entities];
  const byName = (a,b) => String(a.name||'').localeCompare(String(b.name||''), undefined, { sensitivity:'base', numeric:true });
  const updated = e => new Date(e.updatedAt || 0).getTime() || 0;
  const created = e => new Date(e.createdAt || 0).getTime() || 0;
  if (mode === 'name-asc') return rows.sort(byName);
  if (mode === 'name-desc') return rows.sort((a,b)=>byName(b,a));
  if (mode === 'updated-asc') return rows.sort((a,b)=>updated(a)-updated(b) || byName(a,b));
  if (mode === 'created-desc') return rows.sort((a,b)=>created(b)-created(a) || byName(a,b));
  if (mode === 'favorites') return rows.sort((a,b)=>Number(Boolean(b.favorite))-Number(Boolean(a.favorite)) || byName(a,b));
  return rows.sort((a,b)=>updated(b)-updated(a) || byName(a,b));
}

export function uniqueTags(entities) {
  return [...new Set(entities.flatMap(e => e.tags || []))].sort((a, b) => a.localeCompare(b));
}
