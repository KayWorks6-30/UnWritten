import { APP_VERSION, ENTRY_TYPES, TYPE_GROUPS, RELATION_TYPES, createEmptyEntity, validateEntity, validStatusesFor } from './domain/schema.js';
import { searchEntities, uniqueTags } from './domain/search.js';
import { relationsFor, otherEntityId, relationDirection, validateRelation } from './domain/relations.js';
import { initializeDefaults, getAll, getOne, putOne, deleteOne, deleteEntityCascade } from './data/db.js';
import { buildBackup, downloadJson, restoreBackup } from './data/backup.js';

const state = {
  entities: [], relations: [], media: [], settings: {},
  editorEntity: null, selectedId: null, mediaObjectUrls: new Map()
};

const $ = (selector) => document.querySelector(selector);
const main = $('#main');
const entryDialog = $('#entry-dialog');
const relationDialog = $('#relation-dialog');
const mediaDialog = $('#media-dialog');

function esc(value = '') {
  return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function text(value = '') { return esc(value).replace(/\n/g, '<br>'); }
function id() { return crypto.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(16).slice(2)}`; }
function now() { return new Date().toISOString(); }
function fmtDate(value) {
  if (!value) return '';
  try { return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value)); }
  catch { return value; }
}
function typeLabel(type) { return ENTRY_TYPES[type]?.label || type; }
function statusClass(status='') { return status.toLowerCase().replace(/\s+/g, '-'); }
function route() {
  const raw = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [name, selected] = raw.split('/');
  return { name, selected };
}
function setRoute(name, selected = '') { location.hash = `#/${name}${selected ? `/${selected}` : ''}`; }
function projectSetting() { return state.settings.project || { name: 'Galatea', currentBookId: null }; }

async function refreshState() {
  const [entities, relations, media, settingRows] = await Promise.all([
    getAll('entities'), getAll('relations'), getAll('media'), getAll('settings')
  ]);
  state.entities = entities;
  state.relations = relations;
  state.media = media;
  state.settings = Object.fromEntries(settingRows.map(row => [row.key, row.value]));
  $('#project-name').textContent = projectSetting().name || 'World Bible';
}

function toast(message) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  $('#toast-region').appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function pageHeader(title, description, actions = '') {
  return `<div class="page-header"><div><div class="eyebrow">WORLD BIBLE</div><h1>${esc(title)}</h1><p>${esc(description)}</p></div><div class="actions">${actions}</div></div>`;
}
function badge(status) { return `<span class="badge ${statusClass(status)}">${esc(status)}</span>`; }
function emptyState(title, body, button = '') {
  return `<div class="empty-state"><strong>${esc(title)}</strong><div>${esc(body)}</div>${button ? `<div style="margin-top:14px">${button}</div>` : ''}</div>`;
}

function entryListItem(entity, currentRoute='entries') {
  const type = ENTRY_TYPES[entity.type];
  return `<div class="list-item" data-open-entry="${esc(entity.id)}" data-open-route="${esc(currentRoute)}">
    <div><div class="list-title">${esc(entity.name || 'Untitled')}</div><div class="list-meta">${esc(type?.label || entity.type)} • edited ${esc(fmtDate(entity.updatedAt))}</div></div>
    <div class="badges">${entity.favorite ? '<span class="badge">★</span>' : ''}${badge(entity.status)}</div>
  </div>`;
}

function renderDashboard() {
  const recent = [...state.entities].sort((a,b) => new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,6);
  const created = [...state.entities].sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,6);
  const favorites = state.entities.filter(e => e.favorite).slice(0,6);
  const questions = state.entities.filter(e => e.type === 'question' && !['Answered','Shelved'].includes(e.status)).slice(0,5);
  const mysteries = state.entities.filter(e => e.type === 'mystery').sort((a,b) => Number(b.favorite)-Number(a.favorite)).slice(0,5);
  const ideas = state.entities.filter(e => e.type === 'idea').sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt)).slice(0,5);
  const books = state.entities.filter(e => e.type === 'book').sort((a,b) => (+a.fields?.order||999)-(+b.fields?.order||999));
  const currentBook = state.entities.find(e => e.id === projectSetting().currentBookId) || books[0];
  const canonical = state.entities.filter(e => e.status === 'Canon').length;

  main.innerHTML = pageHeader(projectSetting().name || 'World Bible', 'Your private control center for lore, story structure, mysteries, and unanswered questions.', '<button class="button primary" data-new-entry="lore">+ New entry</button>') + `
    <div class="grid stats">
      <div class="card"><div class="muted small">Total entries</div><div class="stat-value">${state.entities.length}</div></div>
      <div class="card"><div class="muted small">Canon</div><div class="stat-value">${canonical}</div></div>
      <div class="card"><div class="muted small">Open questions</div><div class="stat-value">${questions.length}</div></div>
      <div class="card"><div class="muted small">Mysteries tracked</div><div class="stat-value">${state.entities.filter(e=>e.type==='mystery').length}</div></div>
    </div>

    <div class="grid two section">
      <section class="card">
        <div class="section-title"><h2>Quick capture</h2><span class="muted small">Idea inbox</span></div>
        <form id="quick-idea-form" class="quick-capture">
          <input id="quick-idea" placeholder="City built inside the fossilized remains of…" required />
          <button class="button primary" type="submit">Save idea</button>
        </form>
      </section>
      <section class="card">
        <div class="section-title"><h2>Current book</h2><a href="#/story" class="muted small">Story →</a></div>
        ${currentBook ? `<div class="list-item" data-open-entry="${esc(currentBook.id)}" data-open-route="story"><div><div class="list-title">${esc(currentBook.name)}</div><div class="list-meta">${esc(currentBook.summary || currentBook.fields?.mainConflict || 'No summary yet.')}</div></div>${badge(currentBook.status)}</div>` : emptyState('No book selected', 'Create a Book entry, then select it in Settings.')}
      </section>
    </div>

    <div class="grid three section">
      <section class="card"><div class="section-title"><h2>Recently edited</h2><a href="#/entries" class="muted small">All lore →</a></div><div class="list">${recent.length ? recent.map(e=>entryListItem(e,'entries')).join('') : emptyState('Nothing here yet', 'Create your first lore entry to start building the world.')}</div></section>
      <section class="card"><div class="section-title"><h2>Recently created</h2></div><div class="list">${created.length ? created.map(e=>entryListItem(e,'entries')).join('') : '<div class="muted small">Nothing created yet.</div>'}</div></section>
      <section class="card"><div class="section-title"><h2>Favorites</h2></div><div class="list">${favorites.length ? favorites.map(e=>entryListItem(e,'entries')).join('') : emptyState('No favorites yet', 'Star important entries from their detail view for quick access.')}</div></section>
    </div>
    <section class="card section"><div class="section-title"><h2>Shortcuts</h2></div><div class="actions"><a class="button" href="#/timeline">Master Timeline</a><a class="button" href="#/maps">Maps</a><a class="button" href="#/mysteries">Mysteries</a><a class="button" href="#/ideas">Idea Inbox</a></div></section>

    <div class="grid three section">
      <section class="card"><div class="section-title"><h2>Unresolved questions</h2><a href="#/questions" class="muted small">Open →</a></div><div class="list">${questions.length ? questions.map(e=>entryListItem(e,'questions')).join('') : '<div class="muted small">No open questions.</div>'}</div></section>
      <section class="card"><div class="section-title"><h2>Important mysteries</h2><a href="#/mysteries" class="muted small">Open →</a></div><div class="list">${mysteries.length ? mysteries.map(e=>entryListItem(e,'mysteries')).join('') : '<div class="muted small">No mysteries tracked yet.</div>'}</div></section>
      <section class="card"><div class="section-title"><h2>Latest ideas</h2><a href="#/ideas" class="muted small">Inbox →</a></div><div class="list">${ideas.length ? ideas.map(e=>entryListItem(e,'ideas')).join('') : '<div class="muted small">Idea inbox is empty.</div>'}</div></section>
    </div>`;
}

const COLLECTIONS = {
  entries: { title: 'All Lore', description: 'Search and filter every structured entry in the world bible.', types: null, defaultType: 'lore' },
  world: { title: 'World', description: 'Cosmology, ancient beings, societies, religions, creatures, organizations, artifacts, and languages.', types: ['lore','deity','civilization','religion','creature','organization','artifact','language'], defaultType: 'lore' },
  characters: { title: 'Characters', description: 'Character profiles, arcs, secrets, knowledge, beliefs, and relationships.', types: ['character'], defaultType: 'character' },
  geography: { title: 'Geography', description: 'Hierarchical locations from worlds and continents down to districts, ruins, and landmarks.', types: ['location'], defaultType: 'location' },
  history: { title: 'History', description: 'Historical events and eras with uncertain dates, competing interpretations, and author truth.', types: ['event','era'], defaultType: 'event' },
  story: { title: 'Story', description: 'Trilogy overview, books, chapters, and scenes kept separate from objective world lore.', types: ['trilogy','book','chapter','scene'], defaultType: 'book' },
  mysteries: { title: 'Mysteries & Foreshadowing', description: 'Track the true answer, clues, red herrings, intended interpretations, reveals, and payoffs.', types: ['mystery','foreshadowing'], defaultType: 'mystery' },
  ideas: { title: 'Idea Inbox', description: 'Capture ideas immediately without deciding where they belong first.', types: ['idea'], defaultType: 'idea' },
  questions: { title: 'Unresolved Questions', description: 'Keep author questions visible until they are answered, shelved, or developed further.', types: ['question'], defaultType: 'question' }
};

function renderCollection(routeName, selectedId) {
  const cfg = COLLECTIONS[routeName] || COLLECTIONS.entries;
  const pool = cfg.types ? state.entities.filter(e => cfg.types.includes(e.type)) : state.entities;
  const tags = uniqueTags(pool);
  const selected = state.entities.find(e => e.id === selectedId) || pool[0] || null;
  state.selectedId = selected?.id || null;
  const typeOptions = cfg.types && cfg.types.length === 1 ? '' : `<select id="collection-type"><option value="">All types</option>${(cfg.types || Object.keys(ENTRY_TYPES)).map(t=>`<option value="${esc(t)}">${esc(typeLabel(t))}</option>`).join('')}</select>`;
  const statusSet = [...new Set(pool.map(e=>e.status))].sort();

  main.innerHTML = pageHeader(cfg.title, cfg.description, `<button class="button primary" data-new-entry="${esc(cfg.defaultType)}">+ New ${esc(typeLabel(cfg.defaultType))}</button>`) + `
    <div class="entry-layout">
      <section class="card list-panel">
        <div class="filter-row">
          <input id="collection-search" type="search" placeholder="Filter this section…" />
          ${typeOptions}
          <select id="collection-status"><option value="">All statuses</option>${statusSet.map(s=>`<option>${esc(s)}</option>`).join('')}</select>
          <select id="collection-tag"><option value="">All tags</option>${tags.map(t=>`<option>${esc(t)}</option>`).join('')}</select>
        </div>
        <div id="collection-list" class="list"></div>
      </section>
      <section class="card detail-panel" id="detail-panel">${selected ? renderEntryDetail(selected, routeName) : emptyState('No entries yet', 'Create the first entry in this section to begin.')}</section>
    </div>`;

  const update = () => {
    const q = $('#collection-search')?.value || '';
    const type = $('#collection-type')?.value || '';
    const status = $('#collection-status')?.value || '';
    const tag = $('#collection-tag')?.value || '';
    let results = searchEntities(pool, q, { type: type || null, status: status || null, tag: tag || null });
    $('#collection-list').innerHTML = results.length ? results.map(e=>entryListItem(e, routeName)).join('') : emptyState('No matches', 'Try a different search or filter.');
  };
  ['#collection-search','#collection-type','#collection-status','#collection-tag'].forEach(sel => $(sel)?.addEventListener('input', update));
  update();
}

function renderEntryDetail(entity, routeName='entries') {
  const def = ENTRY_TYPES[entity.type];
  const rels = relationsFor(entity.id, state.relations);
  const relatedHtml = rels.map(rel => {
    const other = state.entities.find(e => e.id === otherEntityId(rel, entity.id));
    if (!other) return '';
    const dir = relationDirection(rel, entity.id) === 'outgoing' ? '→' : '←';
    return `<div class="list-item" data-open-entry="${esc(other.id)}" data-open-route="${esc(routeName)}">
      <div><div class="list-title">${esc(other.name)}</div><div class="list-meta">${dir} ${esc(rel.type.replaceAll('_',' '))}${rel.note ? ` • ${esc(rel.note)}` : ''}</div></div>
      <button class="icon-btn" data-delete-relation="${esc(rel.id)}" title="Remove link" aria-label="Remove link">×</button>
    </div>`;
  }).join('');
  const linkedMedia = state.media.filter(m => (m.entityIds || []).includes(entity.id));
  const detailFields = (def?.fields || []).filter(f => !f.knowledge && entity.fields?.[f.key] !== undefined && String(entity.fields[f.key]).trim() !== '');
  const knowledgeFields = (def?.fields || []).filter(f => f.knowledge && entity.fields?.[f.key] && String(entity.fields[f.key]).trim());
  return `
    <div class="detail-head">
      <div><div class="eyebrow">${esc(def?.group || 'ENTRY')} • ${esc(def?.label || entity.type)}</div><h2>${esc(entity.name)}</h2><div class="badges">${badge(entity.status)}${(entity.tags||[]).map(t=>`<span class="badge">#${esc(t)}</span>`).join('')}</div></div>
      <div class="actions"><button class="button ghost" data-toggle-favorite="${esc(entity.id)}">${entity.favorite ? '★ Favorited' : '☆ Favorite'}</button><button class="button" data-edit-entry="${esc(entity.id)}">Edit</button></div>
    </div>
    ${entity.summary ? `<section class="detail-section"><h3>Summary</h3><div class="prose">${text(entity.summary)}</div></section>` : ''}
    ${knowledgeFields.length ? `<section class="detail-section"><h3>Knowledge layers</h3><div class="knowledge-grid">${knowledgeFields.map(f=>`<div class="knowledge-card"><h4>${esc(f.label)}</h4><div class="prose">${text(entity.fields[f.key])}</div></div>`).join('')}</div></section>` : ''}
    ${detailFields.map(f=>`<section class="detail-section"><h3>${esc(f.label)}</h3><div class="prose">${text(entity.fields[f.key])}</div></section>`).join('')}
    ${entity.notes ? `<section class="detail-section"><h3>Author Notes</h3><div class="prose">${text(entity.notes)}</div></section>` : ''}
    <section class="detail-section"><div class="section-title"><h3>Related entries</h3><button class="button ghost" data-add-relation="${esc(entity.id)}">+ Link entry</button></div><div class="list">${relatedHtml || '<div class="muted small">No structured links yet.</div>'}</div></section>
    <section class="detail-section"><div class="section-title"><h3>Images & media</h3><button class="button ghost" data-add-media="${esc(entity.id)}">+ Attach media</button></div>${renderMiniMedia(linkedMedia)}</section>
    <section class="detail-section"><div class="muted small">Created ${esc(fmtDate(entity.createdAt))} • Last edited ${esc(fmtDate(entity.updatedAt))}</div></section>`;
}

function renderMiniMedia(media) {
  if (!media.length) return '<div class="muted small">No media attached.</div>';
  return `<div class="media-grid">${media.map(item => `<div class="media-card">${item.blob ? `<img src="${mediaUrl(item)}" alt="${esc(item.title || item.name || 'Attached image')}" />` : ''}<div class="media-card-body"><strong>${esc(item.title || item.name)}</strong><div class="muted small">${(item.tags||[]).map(t=>`#${esc(t)}`).join(' ')}</div></div></div>`).join('')}</div>`;
}

function mediaUrl(item) {
  if (!item?.blob) return '';
  if (!state.mediaObjectUrls.has(item.id)) state.mediaObjectUrls.set(item.id, URL.createObjectURL(item.blob));
  return state.mediaObjectUrls.get(item.id);
}

function renderTimeline() {
  const events = state.entities.filter(e=>e.type==='event').sort((a,b) => {
    const av = Number(a.fields?.timelineOrder), bv = Number(b.fields?.timelineOrder);
    if (Number.isFinite(av) && Number.isFinite(bv)) return av-bv;
    if (Number.isFinite(av)) return -1;
    if (Number.isFinite(bv)) return 1;
    return String(a.fields?.dateText||'').localeCompare(String(b.fields?.dateText||''));
  });
  main.innerHTML = pageHeader('Master Timeline', 'Historical events support uncertain or traditional dates. Use Timeline Sort Order only when display order cannot be inferred from the written date.', '<button class="button primary" data-new-entry="event">+ Historical Event</button>') + `
    <section class="card"><div class="timeline">${events.length ? events.map(e=>`<div class="timeline-item"><div class="list-item" data-open-entry="${esc(e.id)}" data-open-route="history"><div><div class="list-title">${esc(e.name)}</div><div class="list-meta">${esc(e.fields?.dateText || 'Unknown date')}${e.fields?.era ? ` • ${esc(e.fields.era)}` : ''}</div>${e.summary ? `<div class="small" style="margin-top:7px">${esc(e.summary)}</div>` : ''}</div>${badge(e.status)}</div></div>`).join('') : emptyState('No historical events yet', 'Add events as their dates become known—even approximate or disputed dates are valid.')}</div></section>`;
}

function renderMaps() {
  const maps = state.media.filter(m => (m.tags||[]).some(t => t.toLowerCase() === 'map'));
  const locations = state.entities.filter(e=>e.type==='location');
  main.innerHTML = pageHeader('Maps', 'V1 uses image-based maps and structured location entries. Interactive markers are intentionally deferred until the underlying geography is mature.', '<button class="button primary" data-upload-media="map">+ Add map image</button>') + `
    <div class="grid two">
      <section class="card"><div class="section-title"><h2>Map library</h2><span class="muted small">Tag media with #map</span></div>${maps.length ? renderMiniMedia(maps) : emptyState('No maps yet', 'Upload a map image and it will live in the reusable media library.')}</section>
      <section class="card"><div class="section-title"><h2>Location index</h2><a href="#/geography" class="muted small">Geography →</a></div><div class="list">${locations.slice(0,12).map(e=>entryListItem(e,'geography')).join('') || '<div class="muted small">No locations yet.</div>'}</div></section>
    </div>
    <section class="card section"><h2>Deferred map architecture</h2><p class="prose">Location records already have stable IDs and structured relationships. A future interactive map can store marker coordinates against those IDs without changing the lore database or duplicating location content.</p></section>`;
}

function renderMedia() {
  main.innerHTML = pageHeader('Media', 'A reusable library for maps, sketches, symbols, creatures, architecture, family trees, and other reference images.', '<button class="button primary" data-upload-media="">+ Add media</button>') + `
    <section class="card"><div class="filter-row"><input id="media-search" type="search" placeholder="Search media titles, filenames, or tags…" /></div><div id="media-results"></div></section>`;
  const updateMedia = () => {
    const q = ($('#media-search')?.value || '').trim().toLowerCase();
    const items = state.media.filter(item => !q || [item.title, item.name, ...(item.tags||[])].join(' ').toLowerCase().includes(q));
    $('#media-results').innerHTML = items.length ? `<div class="media-grid">${items.map(item => `<article class="media-card">${item.blob ? `<img src="${mediaUrl(item)}" alt="${esc(item.title || item.name)}" />` : ''}<div class="media-card-body"><strong>${esc(item.title || item.name)}</strong><div class="muted small">${(item.tags||[]).map(t=>`#${esc(t)}`).join(' ') || 'No tags'}</div><div class="muted small">Linked to ${(item.entityIds||[]).length} entr${(item.entityIds||[]).length===1?'y':'ies'}</div><button class="button danger ghost" data-delete-media="${esc(item.id)}" style="margin-top:8px">Remove</button></div></article>`).join('')}</div>` : emptyState('No media matches', state.media.length ? 'Try a different search.' : 'Images are stored locally in IndexedDB and can be linked to multiple entries without duplicate uploads.');
  };
  $('#media-search').addEventListener('input', updateMedia);
  updateMedia();
}

function renderSettings() {
  const project = projectSetting();
  const books = state.entities.filter(e=>e.type==='book').sort((a,b)=>(+a.fields?.order||999)-(+b.fields?.order||999));
  main.innerHTML = pageHeader('Settings & Data', 'Project identity, backup/import, and local privacy controls.', '') + `
    <div class="grid two">
      <section class="card">
        <h2>Project</h2>
        <form id="project-settings" class="form-grid" style="margin-top:12px">
          <label class="full">Project name<input id="setting-project-name" value="${esc(project.name || '')}" /></label>
          <label class="full">Current book<select id="setting-current-book"><option value="">None selected</option>${books.map(b=>`<option value="${esc(b.id)}" ${project.currentBookId===b.id?'selected':''}>${esc(b.name)}</option>`).join('')}</select></label>
          <div class="full"><button class="button primary" type="submit">Save settings</button></div>
        </form>
      </section>
      <section class="card">
        <h2>Local privacy</h2>
        <p class="prose">Your lore content is stored in this browser. The static app can be hosted without a content database or author account because entries and images do not leave the device unless you export or deliberately move them.</p>
        <p class="muted small">Important: clearing this site's browser storage, losing the device/profile, or changing origins can remove access to local data. Keep backups.</p>
      </section>
    </div>
    <section class="card section">
      <div class="section-title"><div><h2>Backup & restore</h2><div class="muted small">Backups include entries, relationships, settings, and media.</div></div></div>
      <div class="actions"><button class="button primary" id="export-backup">Export full JSON backup</button><button class="button" id="import-backup">Restore backup</button></div>
      <p class="muted small">Restore is intentionally replace-only in V0.1 to avoid ambiguous merges. Export a safety backup before restoring another file.</p>
    </section>
    <section class="card section"><h2>Database summary</h2><div class="grid stats" style="margin-top:12px"><div><div class="muted small">Entries</div><strong>${state.entities.length}</strong></div><div><div class="muted small">Relationships</div><strong>${state.relations.length}</strong></div><div><div class="muted small">Media</div><strong>${state.media.length}</strong></div><div><div class="muted small">App version</div><strong>${APP_VERSION}</strong></div></div></section>`;
}

function renderRoute() {
  const r = route();
  document.querySelectorAll('.primary-nav a').forEach(a => a.classList.toggle('active', a.dataset.route === r.name));
  if (COLLECTIONS[r.name]) renderCollection(r.name, r.selected);
  else if (r.name === 'dashboard') renderDashboard();
  else if (r.name === 'timeline') renderTimeline();
  else if (r.name === 'maps') renderMaps();
  else if (r.name === 'media') renderMedia();
  else if (r.name === 'settings') renderSettings();
  else setRoute('dashboard');
  main.focus({preventScroll:true});
}

function fieldInput(field, value='') {
  const common = `name="field:${esc(field.key)}" id="field-${esc(field.key)}"`;
  if (field.type === 'textarea') return `<textarea ${common} rows="5">${esc(value)}</textarea>`;
  if (field.type === 'select') return `<select ${common}><option value=""></option>${(field.options||[]).map(o=>`<option ${String(value)===String(o)?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
  return `<input ${common} type="${field.type === 'number' ? 'number' : 'text'}" value="${esc(value)}" />`;
}

function renderEditorForm(entity) {
  const def = ENTRY_TYPES[entity.type];
  const statuses = validStatusesFor(entity.type);
  const ordinary = (def.fields||[]).filter(f=>!f.knowledge);
  const knowledge = (def.fields||[]).filter(f=>f.knowledge);
  $('#entry-dialog-title').textContent = entity.name ? `Edit ${entity.name}` : `New ${def.label}`;
  $('#delete-entry').classList.toggle('hidden', !state.entities.some(e=>e.id===entity.id));
  $('#entry-form-body').innerHTML = `
    <div class="form-grid">
      <label>Entry type<select id="entry-type" name="type">${Object.entries(ENTRY_TYPES).map(([key,val])=>`<option value="${esc(key)}" ${entity.type===key?'selected':''}>${esc(val.label)}</option>`).join('')}</select></label>
      <label>Status<select id="entry-status" name="status">${statuses.map(s=>`<option ${entity.status===s?'selected':''}>${esc(s)}</option>`).join('')}</select></label>
      <label class="full">Name<input id="entry-name" name="name" value="${esc(entity.name)}" required /></label>
      <label class="full">Summary<textarea id="entry-summary" name="summary" rows="3">${esc(entity.summary||'')}</textarea></label>
      <label class="full">Tags <span class="muted small">comma separated</span><input id="entry-tags" name="tags" value="${esc((entity.tags||[]).join(', '))}" placeholder="ancient, book-one, unresolved" /></label>
      <label>Favorite<select id="entry-favorite" name="favorite"><option value="false" ${!entity.favorite?'selected':''}>No</option><option value="true" ${entity.favorite?'selected':''}>Yes</option></select></label>
    </div>
    ${ordinary.length ? `<div class="form-section"><h3>${esc(def.label)} details</h3><div class="form-grid">${ordinary.map(f=>`<label class="${f.type==='textarea'?'full':''}">${esc(f.label)}${fieldInput(f, entity.fields?.[f.key] ?? '')}</label>`).join('')}</div></div>` : ''}
    ${knowledge.length ? `<div class="form-section"><h3>Knowledge layers</h3><div class="form-grid">${knowledge.map(f=>`<label class="full">${esc(f.label)}${fieldInput(f, entity.fields?.[f.key] ?? '')}</label>`).join('')}</div></div>` : ''}
    <div class="form-section"><h3>Author notes</h3><label>Notes<textarea id="entry-notes" name="notes" rows="6">${esc(entity.notes||'')}</textarea></label></div>`;

  $('#entry-type').addEventListener('change', event => {
    const draft = readEditorEntity();
    draft.type = event.target.value;
    if (!validStatusesFor(draft.type).includes(draft.status)) draft.status = validStatusesFor(draft.type)[0];
    state.editorEntity = draft;
    renderEditorForm(draft);
  });
}

function readEditorEntity() {
  const base = structuredClone(state.editorEntity || createEmptyEntity('lore'));
  base.type = $('#entry-type')?.value || base.type;
  base.name = $('#entry-name')?.value.trim() || '';
  base.status = $('#entry-status')?.value || base.status;
  base.summary = $('#entry-summary')?.value.trim() || '';
  base.tags = ($('#entry-tags')?.value || '').split(',').map(t=>t.trim().replace(/^#/,'')).filter(Boolean);
  base.favorite = $('#entry-favorite')?.value === 'true';
  base.notes = $('#entry-notes')?.value.trim() || '';
  base.fields = base.fields || {};
  document.querySelectorAll('#entry-form-body [name^="field:"]').forEach(input => {
    base.fields[input.name.slice(6)] = input.value.trim();
  });
  base.updatedAt = now();
  return base;
}

function openEntryEditor(type='lore', entityId=null) {
  const existing = entityId ? state.entities.find(e=>e.id===entityId) : null;
  state.editorEntity = structuredClone(existing || createEmptyEntity(type));
  renderEditorForm(state.editorEntity);
  entryDialog.showModal();
  setTimeout(() => $('#entry-name')?.focus(), 0);
}

function openRelationEditor(fromId) {
  $('#relation-from').value = fromId;
  $('#relation-type').innerHTML = RELATION_TYPES.map(r=>`<option value="${esc(r)}">${esc(r.replaceAll('_',' '))}</option>`).join('');
  $('#relation-to').innerHTML = state.entities.filter(e=>e.id!==fromId).sort((a,b)=>a.name.localeCompare(b.name)).map(e=>`<option value="${esc(e.id)}">${esc(e.name)} — ${esc(typeLabel(e.type))}</option>`).join('');
  $('#relation-note').value = '';
  relationDialog.showModal();
}

function openMediaEditor(preselectEntityId='', defaultTag='') {
  $('#media-form').reset();
  $('#media-tags').value = defaultTag;
  $('#media-entries').innerHTML = state.entities.sort((a,b)=>a.name.localeCompare(b.name)).map(e=>`<option value="${esc(e.id)}" ${e.id===preselectEntityId?'selected':''}>${esc(e.name)} — ${esc(typeLabel(e.type))}</option>`).join('');
  mediaDialog.showModal();
}

async function saveEntity(event) {
  event.preventDefault();
  const entity = readEditorEntity();
  const errors = validateEntity(entity);
  if (errors.length) { toast(errors[0]); return; }
  await putOne('entities', entity);
  entryDialog.close();
  await refreshState();
  toast('Entry saved.');
  const r = route();
  const destination = COLLECTIONS[r.name] ? r.name : sectionForType(entity.type);
  setRoute(destination, entity.id);
  renderRoute();
}

function sectionForType(type) {
  if (type==='character') return 'characters';
  if (type==='location') return 'geography';
  if (['event','era'].includes(type)) return 'history';
  if (['book','chapter','scene'].includes(type)) return 'story';
  if (['mystery','foreshadowing'].includes(type)) return 'mysteries';
  if (type==='idea') return 'ideas';
  if (type==='question') return 'questions';
  return 'world';
}

async function saveRelation(event) {
  event.preventDefault();
  const relation = { id: id(), fromId: $('#relation-from').value, toId: $('#relation-to').value, type: $('#relation-type').value, note: $('#relation-note').value.trim(), createdAt: now() };
  const errors = validateRelation(relation);
  if (errors.length) { toast(errors[0]); return; }
  await putOne('relations', relation);
  relationDialog.close();
  await refreshState();
  renderRoute();
  toast('Link added.');
}

async function saveMedia(event) {
  event.preventDefault();
  const file = $('#media-file').files[0];
  if (!file) return;
  const item = {
    id: id(), name: file.name, title: $('#media-title').value.trim() || file.name,
    mime: file.type, size: file.size, blob: file,
    tags: $('#media-tags').value.split(',').map(t=>t.trim().replace(/^#/,'')).filter(Boolean),
    entityIds: [...$('#media-entries').selectedOptions].map(o=>o.value),
    createdAt: now()
  };
  await putOne('media', item);
  mediaDialog.close();
  await refreshState();
  renderRoute();
  toast('Media added.');
}

async function quickIdea(event) {
  event.preventDefault();
  const input = $('#quick-idea');
  const value = input.value.trim();
  if (!value) return;
  const entity = createEmptyEntity('idea');
  entity.name = value.length > 64 ? `${value.slice(0,61)}…` : value;
  entity.summary = value;
  entity.fields.idea = value;
  await putOne('entities', entity);
  input.value = '';
  await refreshState();
  renderDashboard();
  toast('Idea captured.');
}

async function toggleFavorite(entityId) {
  const entity = state.entities.find(e=>e.id===entityId);
  if (!entity) return;
  await putOne('entities', {...entity, favorite: !entity.favorite, updatedAt: now()});
  await refreshState();
  renderRoute();
}

function updateDetailOnly(entityId, routeName) {
  const entity = state.entities.find(e=>e.id===entityId);
  if (!entity) return;
  const panel = $('#detail-panel');
  if (panel) panel.innerHTML = renderEntryDetail(entity, routeName);
}

async function deleteEntityConfirmed() {
  const entity = state.editorEntity;
  if (!entity || !state.entities.some(e=>e.id===entity.id)) return;
  const message = entity.status === 'Contradicted'
    ? `Permanently delete “${entity.name}”? Contradicted lore is normally retained for reference.`
    : `Permanently delete “${entity.name}”? This also removes its structured links.`;
  if (!confirm(message)) return;
  await deleteEntityCascade(entity.id);
  entryDialog.close();
  await refreshState();
  setRoute(sectionForType(entity.type));
  renderRoute();
  toast('Entry permanently deleted.');
}

async function exportBackupAction() {
  toast('Building backup…');
  const data = await buildBackup({includeMedia:true});
  const safe = (projectSetting().name || 'world-bible').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  downloadJson(data, `${safe || 'world-bible'}-backup-${new Date().toISOString().slice(0,10)}.json`);
  toast('Backup exported.');
}

async function importBackupFile(file) {
  try {
    const parsed = JSON.parse(await file.text());
    if (!confirm('Restore this backup and replace the current local database? Export your current data first if you need to keep it.')) return;
    await restoreBackup(parsed, {replace:true});
    await refreshState();
    renderRoute();
    toast('Backup restored.');
  } catch (error) { toast(error.message || 'Could not restore backup.'); }
}

function globalSearch() {
  const input = $('#global-search');
  const popover = $('#search-popover');
  const q = input.value.trim();
  if (!q) { popover.classList.add('hidden'); return; }
  const results = searchEntities(state.entities, q).slice(0,10);
  popover.innerHTML = results.length ? results.map(e=>`<div class="search-result" data-global-result="${esc(e.id)}"><div><strong>${esc(e.name)}</strong><div class="muted small">${esc(typeLabel(e.type))} • ${esc(e.summary || '')}</div></div>${badge(e.status)}</div>`).join('') : '<div class="empty-state">No matches.</div>';
  popover.classList.remove('hidden');
}

function bindStaticEvents() {
  window.addEventListener('hashchange', renderRoute);
  $('#open-sidebar').addEventListener('click', () => $('#sidebar').classList.add('open'));
  $('#close-sidebar').addEventListener('click', () => $('#sidebar').classList.remove('open'));
  document.querySelector('.primary-nav').addEventListener('click', () => $('#sidebar').classList.remove('open'));
  $('#quick-add').addEventListener('click', () => openEntryEditor('lore'));
  $('#random-entry').addEventListener('click', () => {
    if (!state.entities.length) return toast('Create an entry first.');
    const pick = state.entities[Math.floor(Math.random()*state.entities.length)];
    setRoute(sectionForType(pick.type), pick.id);
  });
  $('#entry-form').addEventListener('submit', saveEntity);
  $('#close-entry-dialog').addEventListener('click', () => entryDialog.close());
  $('#cancel-entry').addEventListener('click', () => entryDialog.close());
  $('#delete-entry').addEventListener('click', deleteEntityConfirmed);
  $('#relation-form').addEventListener('submit', saveRelation);
  $('#close-relation-dialog').addEventListener('click', () => relationDialog.close());
  $('#cancel-relation').addEventListener('click', () => relationDialog.close());
  $('#media-form').addEventListener('submit', saveMedia);
  $('#close-media-dialog').addEventListener('click', () => mediaDialog.close());
  $('#cancel-media').addEventListener('click', () => mediaDialog.close());
  $('#global-search').addEventListener('input', globalSearch);
  $('#global-search').addEventListener('keydown', e => {
    if (e.key === 'Escape') $('#search-popover').classList.add('hidden');
  });
  $('#import-file').addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (file) importBackupFile(file);
    e.target.value = '';
  });

  document.addEventListener('click', async event => {
    const target = event.target.closest('[data-new-entry],[data-edit-entry],[data-open-entry],[data-toggle-favorite],[data-add-relation],[data-delete-relation],[data-add-media],[data-upload-media],[data-delete-media],[data-global-result]');
    if (target) {
      if (target.dataset.newEntry) openEntryEditor(target.dataset.newEntry);
      if (target.dataset.editEntry) openEntryEditor(null, target.dataset.editEntry);
      if (target.dataset.openEntry) setRoute(target.dataset.openRoute || sectionForType(state.entities.find(e=>e.id===target.dataset.openEntry)?.type), target.dataset.openEntry);
      if (target.dataset.toggleFavorite) await toggleFavorite(target.dataset.toggleFavorite);
      if (target.dataset.addRelation) openRelationEditor(target.dataset.addRelation);
      if (target.dataset.deleteRelation) {
        event.stopPropagation();
        await deleteOne('relations', target.dataset.deleteRelation); await refreshState(); renderRoute(); toast('Link removed.');
      }
      if (target.dataset.addMedia) openMediaEditor(target.dataset.addMedia, '');
      if (target.hasAttribute('data-upload-media')) openMediaEditor('', target.dataset.uploadMedia || '');
      if (target.dataset.deleteMedia) {
        if (confirm('Remove this media item from the local library?')) { await deleteOne('media', target.dataset.deleteMedia); await refreshState(); renderRoute(); }
      }
      if (target.dataset.globalResult) { $('#global-search').value=''; $('#search-popover').classList.add('hidden'); const e=state.entities.find(x=>x.id===target.dataset.globalResult); setRoute(sectionForType(e.type), e.id); }
    }

    if (event.target.id === 'export-backup') await exportBackupAction();
    if (event.target.id === 'import-backup') $('#import-file').click();
    if (!event.target.closest('.search-wrap')) $('#search-popover').classList.add('hidden');
  });

  document.addEventListener('submit', async event => {
    if (event.target.id === 'quick-idea-form') quickIdea(event);
    if (event.target.id === 'project-settings') {
      event.preventDefault();
      const project = { ...projectSetting(), name: $('#setting-project-name').value.trim() || 'World Bible', currentBookId: $('#setting-current-book').value || null };
      await putOne('settings', {key:'project', value:project});
      await refreshState();
      renderRoute();
      toast('Project settings saved.');
    }
  });
}

async function boot() {
  await initializeDefaults();
  await refreshState();
  bindStaticEvents();
  if (!location.hash) setRoute('dashboard'); else renderRoute();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

boot().catch(error => {
  console.error(error);
  main.innerHTML = pageHeader('Could not open workspace', 'The local database could not be initialized.') + `<section class="card"><div class="prose">${esc(error.message || String(error))}</div></section>`;
});
