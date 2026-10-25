import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { canonicalUrl } from './dedupe.mjs';
import { applyEditorialGuard, loadEditorialGuard } from './editorial-guard.mjs';
import { classifyItem } from './classifier.mjs';
import { decidePublication, isNotifiable } from './publication-gate.mjs';
import { materializeDocumentActs } from './document-acts.mjs';
import { isWhatsAppCategoryAllowed } from './whatsapp-policy.mjs';
import { applySimpleTriage } from './simple-triage.mjs';
import { verifiedTriage } from './triage-proof.mjs';

const confirmed = review => ['confirmar_evento', 'corrigir_categoria'].includes(review?.decisao);
const dateValue = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? `${value}T12:00:00-03:00` : value;

// The weekly date is the original publication, not the date of a recrawl or
// manual review. Alert suppression and weekly inclusion are independent.
export function weeklyPublicationDate(item, row, review) {
  return dateValue(review.fatos?.data_publicacao_original || row?.data_noticia_original ||
    item.sourcePublishedAt || (row?.registro_tipo === 'ato' ? row.data_publicacao : '') ||
    (!/^https?:\/\/news\.google\.com\//i.test(row?.url || item.url || '')
      ? row?.data_publicacao || item.publishedAt : '') || review.data_fato || '');
}

export async function prepareWeeklyState(state, directory, window, options = {}) {
  const read = async name => (await readFile(path.join(directory, name), 'utf8'))
    .trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const [archive, reviews, definitions, guard, texts] = await Promise.all([
    read('arquivo-coletas.ndjson'), read('revisoes-eventos.ndjson'), read('atos-identificados.ndjson'),
    loadEditorialGuard(directory), read('textos-artigos.ndjson'),
  ]);
  const rows = [...archive, ...materializeDocumentActs(archive, definitions)];
  const byId = new Map(rows.map(row => [row.id, row]));
  const byUrl = new Map(rows.flatMap(row => [row.url, row.article_url].filter(Boolean).map(url => [canonicalUrl(url), row])));
  const textById = new Map(texts.map(text => [text.documento_id, text]));
  const observations = {};
  const audit = [];
  const selectedReviews = new Set();
  const addReviewed = (item, observation, row, review, key) => {
    if (selectedReviews.has(review.documento_id)) return;
    selectedReviews.add(review.documento_id);
    const date = weeklyPublicationDate(item, row, review);
    const inside = date && new Date(date) >= window.start && new Date(date) < window.end;
    // A republication of an explicitly historical act is not a new event.
    // Preserve the known month rather than presenting June/August laws as October news.
    const historicalMonth = review.mes_fato && review.mes_fato < window.start.toISOString().slice(0, 7);
    const channelAllowed = isWhatsAppCategoryAllowed({ classification: { category: review.categoria } });
    const include = inside && !historicalMonth && review.incluir_resumo !== false && channelAllowed;
    const reason = !channelAllowed ? 'Controle/fiscalização: manter na base e no painel, sem envio ao WhatsApp.'
      : historicalMonth ? 'Fato de mês anterior comprovado; não apresentar republicação como novidade.'
      : !date ? 'Sem data original comprovada para o resumo.' : !inside
      ? 'Publicação original fora do período.' : review.incluir_resumo === false
        ? 'Resumo explicitamente bloqueado pela revisão.' : 'Fato confirmado no período; bloqueio de alerta individual preservado.';
    audit.push({ id: row.id, title: row.titulo, date, included: Boolean(include), reason });
    const protectedItem = applyEditorialGuard(item, new Map([[canonicalUrl(item.url), review]]));
    observations[key] = { ...observation, item: { ...protectedItem,
      weeklyDecision: include ? 'incluir' : 'excluir', weeklyDate: date,
      weeklyEvidence: { documentId: row.id, reason, evidence: review.evidencia },
      // Only the weekly presentation uses this date. The stored item is untouched.
      ...(include ? { publishedAt: date, presentationTitle: review.titulo_resumo || item.presentationTitle } : {}),
    } };
  };
  for (const [key, observation] of Object.entries(state.observations || {})) {
    const original = observation.item;
    if (!original?.url) continue;
    const review = guard.get(canonicalUrl(original.url));
    if (confirmed(review)) {
      addReviewed(original, observation, byId.get(review.documento_id), review, key);
      continue;
    }
    const row = byUrl.get(canonicalUrl(original.url));
    const triage = row?.triagem_automatica;
    if (!review && ['confirmado', 'descartado'].includes(triage?.status)) {
      const body = textById.get(row.id)?.texto || '';
      const verified = verifiedTriage(triage, body);
      const date = weeklyPublicationDate(original, row, {});
      const inside = date && new Date(date) >= window.start && new Date(date) < window.end;
      const channel = isWhatsAppCategoryAllowed({ classification: { category: triage.category } });
      const publication = decidePublication({ ...original, triage,
        classification: { ...original.classification, category: triage.category,
          stage: triage.stage, evidenceText: triage.evidence, score: Math.max(5, original.classification?.score || 0) },
      }, { ...options, now: window.end });
      const publishable = isNotifiable(publication, options.minimumScore) && !original.previewOnly;
      const include = verified && triage.status === 'confirmado' && !triage.retroactive &&
        triage.weeklyAllowed !== false && inside && channel && publishable;
      const reason = !verified ? 'Prova da decisão canônica ausente ou alterada; não reclassificar por trecho parcial.'
        : triage.status === 'descartado' ? 'Rejeição canônica preservada.'
        : triage.retroactive || triage.weeklyAllowed === false ? 'Resumo bloqueado para revisão histórica.'
        : !channel ? 'Controle/fiscalização: somente no painel.'
        : !inside ? 'Publicação original fora do período.'
        : !publishable ? publication.publicationReason || 'Fonte em prévia ou alerta não liberado.'
        : 'Triagem canônica confirmada com corpo e prova verificados.';
      audit.push({ id: row.id, title: row.titulo, date, included: Boolean(include), reason });
      observations[key] = { ...observation, item: { ...publication, rawText: body, triage,
        weeklyDecision: include ? 'incluir' : 'excluir', weeklyDate: date,
        weeklyEvidence: { documentId: row.id, reason, evidence: triage.evidence },
        ...(include ? { publishedAt: date } : {}),
      } };
      continue;
    }
    const item = applySimpleTriage(decidePublication(applyEditorialGuard({ ...original,
      classification: classifyItem({ ...original, rawText: original.summary || original.rawText || '',
        excerpts: [original.classification?.evidenceText, original.summary].filter(Boolean) }),
    }, guard), { ...options, now: window.end }));
    observations[key] = { ...observation, item };
  }
  // Include sealed confirmed documents even when they are absent from the
  // short-lived observation cache, including separately reviewed acts in PDFs.
  const parents = new Set(definitions.map(d => d.documento_pai_id));
  for (const review of reviews) {
    const row = byId.get(review.documento_id);
    if (!row || parents.has(row.id) || !confirmed(review) || selectedReviews.has(row.id) ||
      createHash('sha256').update(row.trecho || '').digest('hex') !== review.trecho_sha256 ||
      !review.evidencia || !review.motivo) continue;
    const item = { url: row.url, articleUrl: row.article_url, title: row.titulo, source: row.fonte,
      publishedAt: row.data_publicacao, sourcePublishedAt: row.data_noticia_original,
      kind: row.registro_tipo === 'ato' ? 'document' : /Diário Oficial/.test(row.titulo) ? 'gazette' : 'news',
      territoryName: row.municipio, summary: row.trecho, classification: { score: 5, category: review.categoria } };
    addReviewed(item, { firstSeenAt: row.primeira_coleta, lastSeenAt: row.ultima_coleta }, row, review, `review:${row.id}`);
  }
  return { ...state, observations, weeklySelectionAudit: audit };
}
