import { APP_VERSION, SCHEMA_VERSION } from '../domain/schema.js';
import { getAll, replaceAll } from './db.js';

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function mediaToPortable(item) {
  if (!(item.blob instanceof Blob)) return item;
  const { blob, ...rest } = item;
  return { ...rest, dataUrl: await blobToDataUrl(blob) };
}

async function portableToMedia(item) {
  if (!item.dataUrl) return item;
  const response = await fetch(item.dataUrl);
  const blob = await response.blob();
  const { dataUrl, ...rest } = item;
  return { ...rest, blob };
}

export async function buildBackup({ includeMedia = true } = {}) {
  const [entities, relations, settings, mediaRaw] = await Promise.all([
    getAll('entities'), getAll('relations'), getAll('settings'), getAll('media')
  ]);
  const media = includeMedia ? await Promise.all(mediaRaw.map(mediaToPortable)) : [];
  return {
    format: 'kayworks-world-bible-backup',
    appVersion: APP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    entities,
    relations,
    settings,
    media
  };
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function restoreBackup(data, { replace = true } = {}) {
  if (data?.format !== 'kayworks-world-bible-backup') throw new Error('This is not a World Bible backup file.');
  if (!Array.isArray(data.entities) || !Array.isArray(data.relations)) throw new Error('Backup is missing required records.');
  const media = await Promise.all((data.media || []).map(portableToMedia));
  if (!replace) throw new Error('Merge import is not implemented in V0.1. Use replace after exporting a safety backup.');
  await replaceAll('entities', data.entities);
  await replaceAll('relations', data.relations);
  await replaceAll('settings', data.settings || []);
  await replaceAll('media', media);
}
