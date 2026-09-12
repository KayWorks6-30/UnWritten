import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

const db=new DatabaseSync(':memory:');
for(const file of ['migrations/0001_initial.sql','migrations/0002_v3_workspace.sql']) db.exec(await readFile(file,'utf8'));
const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name));
for(const table of ['entities','relations','settings','media','clues','reveals','knowledge','map_versions','map_markers','workspace']){
  if(!tables.has(table)) throw new Error(`Migration smoke is missing table ${table}.`);
}
const integrity=db.prepare('PRAGMA integrity_check').get();
if(integrity.integrity_check!=='ok') throw new Error(`SQLite integrity check failed: ${integrity.integrity_check}`);
console.log(`Migration smoke passed: ${tables.size} authoritative tables, SQLite integrity ok.`);
