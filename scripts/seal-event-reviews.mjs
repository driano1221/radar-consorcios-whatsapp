import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'data', 'catalogo');
const archive = (await readFile(path.join(directory, 'arquivo-coletas.ndjson'), 'utf8'))
  .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const records = new Map(archive.map((row) => [row.id, row]));
const file = path.join(directory, 'revisoes-eventos.ndjson');
const reviews = (await readFile(file, 'utf8')).split(/\r?\n/).filter(Boolean)
  .map((line) => JSON.parse(line));
for (const review of reviews) {
  const row = records.get(review.documento_id);
  if (!row || !['nao_evento', 'corrigir_categoria'].includes(review.decisao) ||
    (review.decisao === 'corrigir_categoria' && !review.categoria) ||
    !review.evidencia || !review.motivo) {
    throw new Error(`Revisão incompleta ou documento ausente: ${review.documento_id}`);
  }
  const hash = createHash('sha256').update(row.trecho || '').digest('hex');
  if (review.trecho_sha256 && review.trecho_sha256 !== hash) {
    throw new Error(`O trecho mudou; reexaminar antes de renovar: ${review.documento_id}`);
  }
  review.trecho_sha256 = hash;
}
await writeFile(file, `${reviews.map((review) => JSON.stringify(review)).join('\n')}\n`, 'utf8');
console.log(`[auditoria] ${reviews.length} revisões lacradas ao trecho observado.`);
