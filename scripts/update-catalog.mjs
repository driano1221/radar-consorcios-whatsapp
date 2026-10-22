import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, mergeStateIntoCatalog, saveCatalog } from '../src/lib/catalog.mjs';
import { loadOriginalTriage } from '../src/lib/simple-triage.mjs';
import { reprocessTriage,upgradeLegacyTriage } from './reprocess-triage.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'data', 'catalogo');
const statePath = path.join(root, 'state', 'news-state.json');
const state = JSON.parse(await readFile(statePath, 'utf8'));
await reprocessTriage(directory, { state, apply: true });
const editorialReviews = (await readFile(path.join(directory, 'revisoes-eventos.ndjson'), 'utf8'))
  .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const reviewedIds = new Set(editorialReviews.map((review) => review.documento_id).filter(Boolean));
for (const id of (await loadOriginalTriage(directory)).keys()) reviewedIds.add(id);
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
    mergeStateIntoCatalog(records, JSON.parse(content), { reviewedIds });
    recovered += 1;
  }
  console.log(`[catálogo] ${recovered} versões históricas do estado processadas.`);
}

mergeStateIntoCatalog(records, state, { reviewedIds });
await upgradeLegacyTriage(directory,records,state,reviewedIds);
// Full-text evidence is stored separately, never substituted for a sealed excerpt.
try {
  const texts = (await readFile(path.join(directory, 'textos-artigos.ndjson'), 'utf8'))
    .split(/\r?\n/).filter(Boolean).map(JSON.parse);
  for (const text of texts) {
    const row = records.get(text.documento_id);
    if (!row) continue;
    records.set(row.id, { ...row, article_text_sha256: text.texto_sha256,
      article_reader: text.leitor, article_url: row.article_url || text.url_artigo,
      article_recovery_reason: '' });
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const counts = await saveCatalog(directory, records);
console.log(`[catálogo] ${counts.all} documentos encontrados; ${counts.relevant} classificados como potenciais eventos; ${counts.consortia} consórcios identificados explicitamente.`);
