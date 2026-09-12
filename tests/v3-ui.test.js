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
