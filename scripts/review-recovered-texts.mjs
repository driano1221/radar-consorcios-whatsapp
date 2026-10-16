// Recalcula apenas sugestões de revisão com os textos integrais já guardados.
// Não promove documentos à base de eventos nem envia mensagens.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, saveCatalog } from '../src/lib/catalog.mjs';
import { recoveredSuggestion } from '../src/lib/recovered-suggestion.mjs';
import { redactPublicText } from '../src/lib/article-text-store.mjs';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'data', 'catalogo');
const apply = process.argv.includes('--apply');
const records = await loadCatalog(path.join(directory, 'arquivo-coletas.ndjson'));
const reviews = (await readFile(path.join(directory, 'revisoes-eventos.ndjson'), 'utf8'))
  .split(/\r?\n/).filter(Boolean).map(JSON.parse);
const reviewedIds = new Set(reviews.map((row) => row.documento_id));
const texts = (await readFile(path.join(directory, 'textos-artigos.ndjson'), 'utf8'))
  .split(/\r?\n/).filter(Boolean).map(JSON.parse).map((row) => {
    const texto = redactPublicText(row.texto);
    return { ...row, texto, texto_sha256: createHash('sha256').update(texto).digest('hex') };
  });
let suggested = 0;
const firstByTextHash = new Map();
for (const stored of texts) {
  const row = records.get(stored.documento_id);
  if (!row) continue;
  const sameTextAs = firstByTextHash.get(stored.texto_sha256) || '';
  if (!sameTextAs) firstByTextHash.set(stored.texto_sha256, row.id);
  const { candidate, fields } = recoveredSuggestion(row, stored, { reviewed: reviewedIds.has(row.id), sameTextAs });
  if (candidate) suggested += 1;
  records.set(row.id, { ...row,
    article_text_sha256: stored.texto_sha256,
    article_duplicate_of: sameTextAs,
    ...fields });
}
console.log(`[releitura] ${texts.length} textos integrais guardados; ${suggested} sugestões para revisão, sem promoção automática.`);
if (apply) {
  await writeFile(path.join(directory, 'textos-artigos.ndjson'),
    texts.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
  await saveCatalog(directory, records);
  console.log('[releitura] Sugestões atualizadas no catálogo; nenhum envio ao WhatsApp.');
}
