import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalUrl } from './dedupe.mjs';
import { formalEventKey } from './event-identity.mjs';

const EMOJI = { CRIAÇÃO: '🟩', ADESÃO: '🟦', 'ADESÃO AUTORIZADA': '🟦', SAÍDA: '🟧',
  RATEIO: '🟪', PROTOCOLO: '🟨', GOVERNANÇA: '🟨', CONTROLE: '🔎', CRISE: '🟥', ATUAÇÃO: '📰' };

async function readNdjson(file) {
  try {
    return (await readFile(file, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

// Somente decisões lacradas ao trecho exato do arquivo são reaplicadas.
// URLs de páginas agregadoras descartadas também permanecem bloqueadas:
// documentos novos devem ganhar links próprios, não reutilizar o índice.
export async function loadEditorialGuard(directory) {
  const [archive, reviews] = await Promise.all([
    readNdjson(path.join(directory, 'arquivo-coletas.ndjson')),
    readNdjson(path.join(directory, 'revisoes-eventos.ndjson')),
  ]);
  const byId = new Map(archive.map((row) => [row.id, row]));
  const guard = new Map();
  for (const review of reviews) {
    if (!['nao_evento', 'duplicata', 'confirmar_evento', 'corrigir_categoria'].includes(review.decisao)) continue;
    const row = byId.get(review.documento_id);
    if (!row || !review.motivo || !review.evidencia || !review.trecho_sha256) continue;
    if (['confirmar_evento', 'corrigir_categoria'].includes(review.decisao) && !EMOJI[review.categoria]) continue;
    if (createHash('sha256').update(row.trecho || '').digest('hex') !== review.trecho_sha256) continue;
    guard.set(canonicalUrl(row.url), review);
  }
  return guard;
}

// Documentos diferentes sobre a mesma lei permanecem na base, mas o ato
// confirmado por uma fonte não deve gerar novo alerta por outra fonte.
export async function loadConfirmedEventRegistry(directory) {
  const [archive, reviews] = await Promise.all([
    readNdjson(path.join(directory, 'arquivo-coletas.ndjson')),
    readNdjson(path.join(directory, 'revisoes-eventos.ndjson')),
  ]);
  const byId = new Map(archive.map((row) => [row.id, row]));
  const registry = new Map();
  for (const review of reviews) {
    if (!['confirmar_evento', 'corrigir_categoria'].includes(review.decisao)) continue;
    const row = byId.get(review.documento_id);
    if (!row || !review.trecho_sha256 || createHash('sha256').update(row.trecho || '').digest('hex') !== review.trecho_sha256) continue;
    const key = formalEventKey({ title: row.titulo,
      classification: { category: review.categoria, evidenceText: review.evidencia },
      editorialFacts: review.fatos || {} });
    if (!key) continue;
    if (!registry.has(key)) registry.set(key, new Set());
    registry.get(key).add(canonicalUrl(row.url));
    if (row.article_url) registry.get(key).add(canonicalUrl(row.article_url));
  }
  return registry;
}

export function applyEditorialGuard(item, guard) {
  const review = guard.get(canonicalUrl(item.url || ''));
  if (!review) return item;
  const previous = item.classification || {};
  if (['confirmar_evento', 'corrigir_categoria'].includes(review.decisao)) {
    return { ...item, previewOnly: false, reviewReason: '', classification: {
      ...previous, category: review.categoria, emoji: EMOJI[review.categoria],
      score: Math.max(5, previous.score || 0),
      stage: review.etapa || previous.stage,
      evidenceText: review.evidencia,
      reasons: [...(previous.reasons || []), `confirmado por revisão editorial — ${review.motivo}`],
    }, editorialDecision: review.decisao, catalogDecision: 'confirmado',
    editorialFacts: review.fatos || {},
    ...(review.data_fato ? { eventAt: review.data_fato } : {}),
    ...(review.mes_fato ? { eventMonth: review.mes_fato } : {}),
    ...(review.publicar === false ? {
      publicationDecision: 'historico',
      publicationReason: review.motivo_publicacao || review.motivo,
    } : {}) };
  }
  return { ...item, classification: {
    ...previous, category: 'GERAL', emoji: '📰', score: 0,
    stage: review.decisao === 'duplicata' ? 'episódio já registrado' : 'descartado após revisão documental',
    reasons: [...(previous.reasons || []), `rejeitado: revisão editorial — ${review.motivo}`],
    evidenceText: review.evidencia,
  }, editorialDecision: review.decisao, catalogDecision: 'descartado',
    publicationDecision: 'descartado', publicationReason: review.motivo };
}
