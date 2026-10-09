import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalUrl } from './dedupe.mjs';

async function readNdjson(file) {
  try {
    return (await readFile(file, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

// Somente decisões lacradas ao trecho exato do arquivo entram no bloqueio.
// URLs de páginas agregadoras também são bloqueadas: documentos novos devem
// ganhar links próprios, em vez de reutilizar o URL do índice.
export async function loadEditorialGuard(directory) {
  const [archive, reviews] = await Promise.all([
    readNdjson(path.join(directory, 'arquivo-coletas.ndjson')),
    readNdjson(path.join(directory, 'revisoes-eventos.ndjson')),
  ]);
  const byId = new Map(archive.map((row) => [row.id, row]));
  const guard = new Map();
  for (const review of reviews) {
    if (!['nao_evento', 'duplicata'].includes(review.decisao)) continue;
    const row = byId.get(review.documento_id);
    if (!row || !review.motivo || !review.evidencia || !review.trecho_sha256) continue;
    if (createHash('sha256').update(row.trecho || '').digest('hex') !== review.trecho_sha256) continue;
    guard.set(canonicalUrl(row.url), review);
  }
  return guard;
}

export function applyEditorialGuard(item, guard) {
  const review = guard.get(canonicalUrl(item.url || ''));
  if (!review) return item;
  const previous = item.classification || {};
  return { ...item, classification: {
    ...previous, category: 'GERAL', emoji: '📰', score: 0,
    stage: review.decisao === 'duplicata' ? 'episódio já registrado' : 'descartado após revisão documental',
    reasons: [...(previous.reasons || []), `rejeitado: revisão editorial — ${review.motivo}`],
    evidenceText: review.evidencia,
  }, editorialDecision: review.decisao };
}
