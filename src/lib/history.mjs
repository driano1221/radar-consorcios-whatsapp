import { createHash } from 'node:crypto';
import { canonicalUrl, selectUnseen } from './dedupe.mjs';
import { isPublishableClassification } from './classifier.mjs';

export function observeRun(state, items, health, minimumScore, now = new Date(), runId = now.toISOString()) {
  state.observations ||= {};
  state.runs ||= {};
  state.health ||= {};
  state.historyStartedAt ||= now.toISOString();
  for (const item of items) {
    const key = createHash('sha256').update(canonicalUrl(item.url)).digest('hex');
    const old = state.observations[key];
    state.observations[key] = {
      firstSeenAt: old?.firstSeenAt || now.toISOString(), lastSeenAt: now.toISOString(),
      item: { ...item, summary: (item.summary || '').slice(0, 1800), rawText: undefined, excerpts: undefined },
    };
  }
  state.runs[runId] = { at: now.toISOString(), collected: items.length, minimumScore, health };
  for (const source of health) {
    if (source.status === 'disabled') continue;
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
    isPublishableClassification(i.classification, minimumScore) && i.kind !== 'gazette-index');
  const sorted = relevant.sort((a, b) => b.classification.score - a.classification.score || new Date(b.publishedAt) - new Date(a.publishedAt));
  const events = selectUnseen(sorted, { seen: {}, pending: {} });
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
    runs: runs.length, failures, highlights: events.slice(0, 5) };
}
