import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { canonicalUrl } from './dedupe.mjs';
import { formalEventKey } from './event-identity.mjs';
import { materializeDocumentActs } from './document-acts.mjs';
import { loadAlternativeDecisionData, validAlternativeDecision, applyAlternativeGuard } from './alternative-triage.mjs';

const EMOJI = { CRIAÇÃO: '🟩', 'CRIAÇÃO EM TRAMITAÇÃO': '🟩',
  ADESÃO: '🟦', 'ADESÃO AUTORIZADA': '🟦', 'ADESÃO EM TRAMITAÇÃO': '🟦',
  'PROPOSTA DE ADESÃO': '🟦', SAÍDA: '🟧', 'SAÍDA AUTORIZADA': '🟧',
  RATEIO: '🟪', 'RATEIO EM TRAMITAÇÃO': '🟪', FINANÇAS: '🟪',
  PROTOCOLO: '🟨', GOVERNANÇA: '🟨', 'COOPERAÇÃO AUTORIZADA': '📰',
  CONTROLE: '🔎', CRISE: '🟥', ATUAÇÃO: '📰' };

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
  const [archive, reviews, actDefinitions] = await Promise.all([
    readNdjson(path.join(directory, 'arquivo-coletas.ndjson')),
    readNdjson(path.join(directory, 'revisoes-eventos.ndjson')),
    readNdjson(path.join(directory, 'atos-identificados.ndjson')),
  ]);
  const byId = new Map([...archive, ...materializeDocumentActs(archive, actDefinitions)].map((row) => [row.id, row]));
  const splitParents = new Set(actDefinitions.map((act) => act.documento_pai_id));
  const guard = new Map();
  for (const review of reviews) {
    if (!['nao_evento', 'duplicata', 'confirmar_evento', 'corrigir_categoria'].includes(review.decisao)) continue;
    if (splitParents.has(review.documento_id)) continue;
    const row = byId.get(review.documento_id);
    if (!row || !review.motivo || !review.evidencia || !review.trecho_sha256) continue;
    if (['confirmar_evento', 'corrigir_categoria'].includes(review.decisao) && !EMOJI[review.categoria]) continue;
    if (createHash('sha256').update(row.trecho || '').digest('hex') !== review.trecho_sha256) continue;
    guard.set(canonicalUrl(row.url), review);
    // Only explicit URLs from an approved historical batch; never wildcard a host.
    if (review.lote_retroativo && review.publicar === false) {
      for (const url of review.urls_documento || []) {
        if (/^https:\/\//.test(url) && !guard.has(canonicalUrl(url))) guard.set(canonicalUrl(url), review);
      }
    }
  }
  for (const id of splitParents) {
    const row = byId.get(id);
    if (row) {
      const review = reviews.find(r => r.documento_id === id && r.publicar === false &&
        r.trecho_sha256 === createHash('sha256').update(row.trecho || '').digest('hex'));
      for (const url of [row.url, row.article_url, ...(review?.urls_documento || [])].filter(Boolean))
        guard.set(canonicalUrl(url), { decisao: 'desdobrado',
          motivo: 'Publicação já separada em atos com decisões individuais na base; não reenviar como um evento.' });
    }
  }
  const auxiliary = await loadAlternativeDecisionData(directory);
  const humanIds = new Set(reviews.map(r => r.documento_id));
  for (const row of archive) {
    const decision = auxiliary.decisions.get(row.id);
    if (splitParents.has(row.id) || guard.has(canonicalUrl(row.url))) continue;
    if (validAlternativeDecision(row, decision, auxiliary.sources, humanIds))
      guard.set(canonicalUrl(row.url), { origin: 'alternative_automatic', decision });
  }
  return guard;
}

// Documentos diferentes sobre a mesma lei permanecem na base, mas o ato
// confirmado por uma fonte não deve gerar novo alerta por outra fonte.
export async function loadConfirmedEventRegistry(directory) {
  const [archive, reviews, actDefinitions, texts] = await Promise.all([
    readNdjson(path.join(directory, 'arquivo-coletas.ndjson')),
    readNdjson(path.join(directory, 'revisoes-eventos.ndjson')),
    readNdjson(path.join(directory, 'atos-identificados.ndjson')),
    readNdjson(path.join(directory, 'textos-artigos.ndjson')),
  ]);
  const splitParents = new Set(actDefinitions.map((act) => act.documento_pai_id));
  const byId = new Map([...archive, ...materializeDocumentActs(archive, actDefinitions)]
    .map((row) => [row.id, row]));
  const registry = new Map();
  const reviewById = new Map(reviews.map(r => [r.documento_id, r]));
  const byText = new Map(texts.filter(t => t.texto_sha256 === createHash('sha256').update(t.texto || '').digest('hex'))
    .map(t => [t.documento_id, t]));
  for (const review of reviews) {
    const canonicalReview = review.decisao === 'duplicata' ? reviewById.get(review.documento_relacionado) : review;
    if (!['confirmar_evento', 'corrigir_categoria'].includes(canonicalReview?.decisao)) continue;
    const canonicalRow = byId.get(canonicalReview.documento_id);
    if (!canonicalRow || createHash('sha256').update(canonicalRow.trecho || '').digest('hex') !== canonicalReview.trecho_sha256) continue;
    if (splitParents.has(review.documento_id)) continue;
    const row = byId.get(review.documento_id);
    if (!row || !review.trecho_sha256 || createHash('sha256').update(row.trecho || '').digest('hex') !== review.trecho_sha256) continue;
    const key = formalEventKey({ title: row.titulo,
      rawText: byText.get(row.id)?.texto || '', publishedAt: row.data_noticia_original || row.data_publicacao,
      classification: { category: canonicalReview.categoria, evidenceText: review.evidencia },
      editorialFacts: review.fatos || {} });
    if (!key) continue;
    if (!registry.has(key)) registry.set(key, new Set());
    registry.get(key).add(canonicalUrl(canonicalRow.url));
    if (canonicalRow.article_url) registry.get(key).add(canonicalUrl(canonicalRow.article_url));
  }
  return registry;
}

export function applyEditorialGuard(item, guard) {
  const review = guard.get(canonicalUrl(item.url || ''));
  if (!review) return item;
  if (review.origin === 'alternative_automatic') return applyAlternativeGuard(item, review.decision);
  const previous = item.classification || {};
  if (review.decisao === 'desdobrado') return { ...item, classification: {
    ...previous, category: 'GERAL', emoji: '📰', score: 0,
    stage: 'edição separada em atos individualizados',
    reasons: [...(previous.reasons || []), `rejeitado: ${review.motivo}`],
  }, editorialDecision: 'desdobrado', catalogDecision: 'desdobrado',
  publicationDecision: 'historico', publicationReason: review.motivo };
  if (['confirmar_evento', 'corrigir_categoria'].includes(review.decisao)) {
    return { ...item, previewOnly: false, reviewReason: '', classification: {
      ...previous, category: review.categoria, emoji: EMOJI[review.categoria],
      score: Math.max(5, previous.score || 0),
      stage: review.etapa || previous.stage,
      ...(review.fatos?.identidade_nao_aplicavel ? { scope: 'orientacao_geral' } : {}),
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
