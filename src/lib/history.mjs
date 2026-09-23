import { createHash } from 'node:crypto';
import { canonicalUrl, selectUnseen } from './dedupe.mjs';
import { isPublishableClassification } from './classifier.mjs';
import { normalizeForMatch } from './text.mjs';

function weeklyFinding(item) {
  if (item.aiReview?.status === 'disputed') return null;
  const category = item.classification?.category;
  const evidence = normalizeForMatch(`${item.classification?.evidenceText || ''} ${item.summary || ''}`);
  const title = normalizeForMatch(item.title || '');
  if (item.kind === 'gazette') {
    if (category === 'RATEIO' && /balanco patrimonial|relatorio resumido da execucao orcamentaria|demonstrativo da despesa com manutencao|nao se aplicam.{0,160}recursos entregues a consorcios publicos/.test(evidence)) return null;
    if (category === 'PROTOCOLO' && /extrato do contrato de prestacao de servicos/.test(evidence) && /de acordo com o protocolo de intencoes/.test(evidence)) return null;
    if (category === 'CONTROLE' && /constitui ato de improbidade administrativa/.test(evidence) && /contrato de rateio/.test(evidence) && !/auditoria|investigacao|irregularidade apurada|contas rejeitadas/.test(evidence)) {
      return { ...item, classification: { ...item.classification, category: 'RATEIO', emoji: '🟪' } };
    }
  }
  if (category === 'CRIAÇÃO' && /consorcio.{0,50}cria agenda/.test(title)) {
    return { ...item, classification: { ...item.classification, category: 'ATUAÇÃO', emoji: '📰' } };
  }
  if (category === 'ADESÃO' && /\b(autoriza(?:do)?|autorizacao)\b.{0,100}\b(ingresso|integrar|adesao)\b|\b(ingresso|integrar|adesao)\b.{0,100}\bautorizad[oa]\b/.test(`${title} ${evidence.slice(0, 300)}`)) {
    return { ...item, classification: { ...item.classification, category: 'ADESÃO AUTORIZADA', emoji: '🟦' } };
  }
  return item;
}

export function observeRun(state, items, health, minimumScore, now = new Date(), runId = now.toISOString()) {
  state.observations ||= {};
  state.runs ||= {};
  state.health ||= {};
  state.historyStartedAt ||= now.toISOString();
  for (const item of items) {
    const key = createHash('sha256').update(canonicalUrl(item.url)).digest('hex');
    const old = state.observations[key];
    const previous = old?.item;
    const oldReviewed = Boolean(previous?.aiReview);
    const newReviewed = Boolean(item.aiReview);
    const newerReview = newReviewed && (!oldReviewed ||
      new Date(item.aiReview.reviewedAt || 0) > new Date(previous.aiReview.reviewedAt || 0));
    const preservePrevious = previous &&
      !newerReview && ((oldReviewed && !newReviewed) ||
        (oldReviewed === newReviewed && (previous.classification?.score || 0) > (item.classification?.score || 0)));
    const bestItem = preservePrevious ? previous : item;
    state.observations[key] = {
      firstSeenAt: old?.firstSeenAt || now.toISOString(), lastSeenAt: now.toISOString(),
      item: { ...bestItem, summary: (bestItem.summary || '').slice(0, 1800), rawText: undefined, excerpts: undefined },
    };
  }
  state.runs[runId] = { at: now.toISOString(), collected: items.length, minimumScore, health };
  for (const source of health) {
    if (source.status === 'disabled') {
      state.health[source.name] = { ...source, consecutiveFailures: 0, checkedAt: now.toISOString() };
      continue;
    }
    const old = state.health[source.name] || {};
    state.health[source.name] = { ...source, checkedAt: now.toISOString(),
      consecutiveFailures: source.status === 'ok' ? 0 : (old.consecutiveFailures || 0) + 1,
      lastSuccessAt: source.status === 'ok' ? now.toISOString() : old.lastSuccessAt || null };
  }
  const cutoff = now.getTime() - 60 * 86400000;
  for (const [id, record] of Object.entries(state.observations)) {
    if (new Date(record.lastSeenAt).getTime() < cutoff) delete state.observations[id];
  }
  for (const [id, run] of Object.entries(state.runs)) {
    if (new Date(run.at).getTime() < cutoff) delete state.runs[id];
  }
}

export function weeklyWindow(now = new Date(), rolling = false) {
  let end = new Date(now);
  if (!rolling) {
    const local = new Date(now.getTime() - 3 * 3600000);
    const day = local.getUTCDay();
    end = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() - ((day + 1) % 7), 12));
    if (end > now) end = new Date(end.getTime() - 7 * 86400000);
  }
  return { start: new Date(end.getTime() - 7 * 86400000), end };
}

export function buildWeeklyReport(state, { start, end }, minimumScore = 5) {
  const inside = (date) => new Date(date) >= start && new Date(date) < end;
  const observations = Object.values(state.observations || {}).filter((r) => inside(r.firstSeenAt));
  const relevant = observations.map((r) => r.item).filter((i) =>
    isPublishableClassification(i.classification, minimumScore) && i.kind !== 'gazette-index')
    .map(weeklyFinding).filter(Boolean);
  const sorted = relevant.sort((a, b) => b.classification.score - a.classification.score || new Date(b.publishedAt) - new Date(a.publishedAt));
  const events = selectUnseen(sorted, { seen: {}, pending: {} });
  events.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt) || b.classification.score - a.classification.score);
  const sources = {};
  const categories = {};
  for (const item of events) {
    sources[item.source] = (sources[item.source] || 0) + 1;
    const category = item.classification.category;
    categories[category] = (categories[category] || 0) + 1;
  }
  const runs = Object.values(state.runs || {}).filter((r) => inside(r.at));
  const failures = [...new Set(runs.flatMap((r) => r.health.filter((h) => ['error', 'degraded'].includes(h.status)).map((h) => h.name.replace(/ — consulta \d+$/, ''))))];
  const urls = new Set(events.map((i) => canonicalUrl(i.url)));
  const pending = Object.values(state.pending || {}).filter((r) => urls.has(canonicalUrl(r.item.url))).length;
  return { start: start.toISOString(), end: end.toISOString(),
    historyStartedAt: state.historyStartedAt || null,
    partial: !state.historyStartedAt || new Date(state.historyStartedAt) > start,
    observations: observations.length, events: events.length, categories, sources,
    sent: Object.values(state.seen).filter((r) => inside(r.sentAt)).length,
    pending, preview: events.filter((i) => i.previewOnly).length,
    runs: runs.length, failures, highlights: events };
}
