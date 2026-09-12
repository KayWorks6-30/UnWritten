import { ENTRY_TYPES } from '../domain/schema.js';

function clean(value){ return String(value??'').trim(); }
function heading(text,level=2){ return `${'#'.repeat(level)} ${text}\n\n`; }
function nameFor(id, entities){ return entities.find(e=>e.id===id)?.name || id || ''; }

export function buildMarkdownExport({project,entities,relations,clues,reveals,knowledge,mapVersions,mapMarkers}){
  const active=entities.filter(e=>!e.archivedAt).sort((a,b)=>(ENTRY_TYPES[a.type]?.label||a.type).localeCompare(ENTRY_TYPES[b.type]?.label||b.type)||a.name.localeCompare(b.name));
  let out=`# ${clean(project?.name)||'UnWritten.KayWorks'}\n\nExported ${new Date().toISOString()}\n\n`;
  for(const entity of active){
    const def=ENTRY_TYPES[entity.type]||{label:entity.type,fields:[]}; out+=`---\n\n# ${entity.name}\n\n`;
    out+=`**Type:** ${def.label}  \n**Status:** ${entity.status}  \n`;
    if(entity.tags?.length) out+=`**Tags:** ${entity.tags.map(t=>`#${t}`).join(' ')}  \n`;
    out+='\n'; if(clean(entity.summary)) out+=`${heading('Summary')}${clean(entity.summary)}\n\n`;
    for(const field of def.fields||[]){ const value=entity.fields?.[field.key]; if(!clean(value)) continue; const display=field.type==='entity'?nameFor(value,entities):value; out+=`${heading(field.label)}${clean(display)}\n\n`; }
    const rels=relations.filter(r=>r.fromId===entity.id||r.toId===entity.id); if(rels.length){ out+=heading('Related Entries'); for(const r of rels){ const other=r.fromId===entity.id?r.toId:r.fromId; out+=`- ${r.type.replaceAll('_',' ')}: ${nameFor(other,entities)}${r.note?` — ${r.note}`:''}\n`; } out+='\n'; }
    const entityClues=clues.filter(c=>c.mysteryId===entity.id); if(entityClues.length){ out+=heading('Clues'); for(const c of entityClues) out+=`- ${c.label||'Clue'}${c.storyEntityId?` (${nameFor(c.storyEntityId,entities)})`:''}: ${c.description||''}\n`; out+='\n'; }
    const entityReveals=reveals.filter(r=>r.targetEntityId===entity.id||r.mysteryId===entity.id); if(entityReveals.length){ out+=heading('Reveal Records'); for(const r of entityReveals) out+=`- ${r.title}: ${r.summary||''}\n`; out+='\n'; }
    const entityKnowledge=knowledge.filter(k=>k.subjectEntityId===entity.id); if(entityKnowledge.length){ out+=heading('Character / Reader Knowledge'); for(const k of entityKnowledge) out+=`- ${k.knowerKind==='reader'?'Reader':nameFor(k.knowerEntityId,entities)} — ${k.state}: ${k.belief||''}\n`; out+='\n'; }
    if(clean(entity.notes)) out+=`${heading('Author Notes')}${clean(entity.notes)}\n\n`;
  }
  if(mapVersions.length||mapMarkers.length) out+=`---\n\n${heading('Map Metadata',1)}Map versions: ${mapVersions.length}\n\nMap markers: ${mapMarkers.length}\n`;
  return out;
}
