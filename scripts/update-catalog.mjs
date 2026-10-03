import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, mergeStateIntoCatalog, saveCatalog } from '../src/lib/catalog.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'data', 'catalogo');
const statePath = path.join(root, 'state', 'news-state.json');
const records = process.argv.includes('--history')
  ? new Map()
  : await loadCatalog(path.join(directory, 'arquivo-coletas.ndjson'));

if (process.argv.includes('--history')) {
  const commits = execFileSync('git', ['rev-list', '--reverse', 'HEAD', '--', 'state/news-state.json'],
    { cwd: root, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
  let recovered = 0;
  for (const commit of commits) {
    const content = execFileSync('git', ['show', `${commit}:state/news-state.json`],
      { cwd: root, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 });
    mergeStateIntoCatalog(records, JSON.parse(content));
    recovered += 1;
  }
  console.log(`[catálogo] ${recovered} versões históricas do estado processadas.`);
}

mergeStateIntoCatalog(records, JSON.parse(await readFile(statePath, 'utf8')));
const counts = await saveCatalog(directory, records);
console.log(`[catálogo] ${counts.all} documentos encontrados; ${counts.relevant} classificados como potenciais eventos; ${counts.consortia} consórcios identificados explicitamente.`);
