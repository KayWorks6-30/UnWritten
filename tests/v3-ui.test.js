import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('navigation exposes collapsible sidebar and sidebar search palette',async()=>{
  const [html,css,app]=await Promise.all([read('index.html'),read('styles.css'),read('js/app.js')]);
  assert.match(html,/id="sidebar-search"/);
  assert.match(html,/id="search-dialog"/);
  assert.match(html,/id="palette-search"/);
  assert.match(html,/id="close-sidebar"[^>]*>☰</);
  assert.match(html,/id="open-sidebar"/);
  assert.match(css,/body\.sidebar-collapsed \.app-shell/);
  assert.match(css,/\.topbar \{ position: relative; top: auto; \}/);
  assert.match(app,/localStorage\.setItem\('unwritten\.sidebarCollapsed'/);
  assert.match(app,/openSearchDialog\(\)/);
  assert.match(app,/event\.key\.toLowerCase\(\)==='k'/);
});

test('collection pages use top filters, closable detail, results below, and auto-scroll opened records',async()=>{
  const app=await read('js/app.js');
  assert.match(app,/class="card collection-filter-card"/);
  assert.match(app,/class="card collection-detail"/);
  assert.match(app,/class="card collection-results"/);
  assert.match(app,/id="clear-collection-filters"/);
  assert.match(app,/data-close-detail=/);
  assert.match(app,/detail\.scrollIntoView/);
  assert.doesNotMatch(app,/class="entry-layout/);
});


test('V3.2.0 portrait layout, per-image sizing, viewer zoom, archive fix, and persistent Wrangler vars are wired',async()=>{
  const [app,index,css,wrangler]=await Promise.all([
    readFile(new URL('../js/app.js',import.meta.url),'utf8'),
    readFile(new URL('../index.html',import.meta.url),'utf8'),
    readFile(new URL('../styles.css',import.meta.url),'utf8'),
    readFile(new URL('../wrangler.jsonc',import.meta.url),'utf8')
  ]);
  assert.match(app,/types:\['character','deity'\]/);
  assert.match(app,/data-view-media/);
  assert.match(app,/data-media-card-size/);
  assert.match(app,/adjustMediaCardSize/);
  assert.match(app,/setMediaViewerZoom/);
  assert.match(index,/id="media-viewer-dialog"/);
  assert.match(index,/id="media-viewer-zoom-in"/);
  assert.match(index,/id="media-viewer-zoom-reset"/);
  assert.match(css,/\.media-viewer-stage/);
  assert.match(css,/\.media-viewer-zoom-plane/);
  assert.match(css,/\.character-portrait-preview img \{[^}]*width: 100%/s);
  assert.match(app,/baseUpdatedAt:state\.editorBaseUpdatedAt\|\|existing\.updatedAt/);
  assert.match(wrangler,/"keep_vars"\s*:\s*true/);
});

test('V3.2.0 collection discovery supports searchable multi-tag filters and organization preferences',async()=>{
  const [app,css]=await Promise.all([read('js/app.js'),read('styles.css')]);
  assert.match(app,/id="collection-tag-search"/);
  assert.match(app,/id="collection-tag-mode"/);
  assert.match(app,/Match all selected/);
  assert.match(app,/Match any selected/);
  assert.match(app,/id="collection-sort"/);
  assert.match(app,/id="collection-group"/);
  assert.match(app,/id="collection-view"/);
  assert.match(app,/unwritten\.collectionPreferences/);
  assert.match(app,/routeName==='characters'[\s\S]*sort:'name-asc',group:'alpha',view:'cards'/);
  assert.match(css,/\.collection-card-grid/);
  assert.match(css,/\.tag-picker-options/);
});
