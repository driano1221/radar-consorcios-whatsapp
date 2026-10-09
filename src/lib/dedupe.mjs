import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeForMatch } from './text.mjs';
import { classifyItem, isPublishableClassification } from './classifier.mjs';
import { formalEventKey } from './event-identity.mjs';

const STOP_WORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'consorcio', 'consorcios', 'da', 'das', 'de', 'do', 'dos', 'e',
  'em', 'intermunicipal', 'municipal', 'municipio', 'municipios', 'na', 'nas', 'no', 'nos', 'o', 'os',
  'para', 'por', 'publico', 'publicos', 'que', 'um', 'uma', 'diario', 'oficial',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function canonicalUrl(value = '') {
  try {
    const url = new URL(value);
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_.+|fbclid|gclid|mc_cid|mc_eid|ref|ref_src|ocid)$/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    url.hash = '';
    return url.toString();
  } catch {
    return value;
  }
}

export function itemId(item) {
  return sha256(`${canonicalUrl(item.url)}|${normalizeForMatch(item.title)}`);
}

function significantTokens(item) {
  const text = normalizeForMatch(
    `${item.title || ''} ${(item.summary || item.rawText || '').slice(0, 700)}`,
  );
  return [...new Set(text.match(/[a-z0-9]{3,}/g) || [])]
    .filter((token) => !STOP_WORDS.has(token))
    .slice(0, 60)
    .sort();
}

function jaccard(left, right) {
  if (!left?.length || !right?.length) return 0;
  const a = new Set(left);
  const b = new Set(right);
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export function titleFingerprint(item) {
  if (item.kind === 'gazette') return sha256(`${canonicalUrl(item.url)}|${item.territoryId || item.territoryName}`);
  return sha256(normalizeForMatch(item.title).replace(/\b(de|da|do|das|dos|e|em|no|na)\b/g, ' '));
}

export async function loadState(stateFile) {
  try {
    const parsed = JSON.parse(await readFile(stateFile, 'utf8'));
    return {
      ...parsed,
      version: 4,
      seen: parsed.seen || {},
      pending: parsed.pending || {},
    };
  } catch (error) {
    if (error.code === 'ENOENT') return { version: 3, seen: {}, pending: {} };
    throw new Error(`Estado de notícias inválido em ${stateFile}: ${error.message}`);
  }
}

export async function saveState(stateFile, state) {
  await mkdir(path.dirname(stateFile), { recursive: true });
  const tempFile = `${stateFile}.${process.pid}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  await import('node:fs/promises').then(({ rename }) => rename(tempFile, stateFile));
}

export function pruneState(state, retentionDays, pendingRetentionDays = 30) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  for (const [id, record] of Object.entries(state.seen)) {
    if (new Date(record.sentAt).getTime() < cutoff) delete state.seen[id];
  }
  const pendingCutoff = Date.now() - pendingRetentionDays * 24 * 60 * 60 * 1000;
  for (const [id, record] of Object.entries(state.pending || {})) {
    if (new Date(record.queuedAt).getTime() < pendingCutoff) delete state.pending[id];
  }
  for (const [id, review] of Object.entries(state.aiReviews || {})) {
    if (new Date(review.reviewedAt).getTime() < cutoff) delete state.aiReviews[id];
  }
}

function eventHeadline(title = '', source = '') {
  const normalized = normalizeForMatch(title);
  const suffix = normalizeForMatch(source);
  return suffix && normalized.endsWith(` - ${suffix}`)
    ? normalized.slice(0, -(` - ${suffix}`).length) : normalized;
}

function resemblesKnownEvent(item, tokens, records, threshold = 0.66) {
  return records.some((record) => {
    const itemDate = item.eventAt || item.sourcePublishedAt || item.publishedAt;
    const recordDate = record.eventAt || record.sourcePublishedAt || record.publishedAt || record.sentAt;
    const closeInTime = !itemDate || !recordDate ||
      Math.abs(new Date(itemDate) - new Date(recordDate)) <= 7 * 86400000;
    if (!closeInTime) return false;
    const headline = eventHeadline(item.title, item.source);
    const knownHeadline = eventHeadline(record.title, record.source);
    if (headline.length >= 30 && headline === knownHeadline) return true;
    return record.category === item.classification?.category && record.contentTokens?.length >= 4 &&
      jaccard(tokens, record.contentTokens) >= threshold;
  });
}

export function selectUnseen(items, state, { confirmedEvents = new Map() } = {}) {
  const pendingRecords = Object.values(state.pending || {}).map(({ item }) => ({
    category: item.classification?.category,
    contentTokens: item.contentTokens,
    titleFingerprint: item.titleFingerprint,
    publishedAt: item.publishedAt,
    sourcePublishedAt: item.sourcePublishedAt, eventAt: item.eventAt,
    articleUrl: item.articleUrl, eventKey: item.eventKey || formalEventKey(item),
    title: item.title,
    source: item.source,
  }));
  const records = [...Object.values(state.seen), ...pendingRecords];
  const sentUrls = new Set(Object.values(state.seen || {}).map((record) => canonicalUrl(record.url || '')).filter(Boolean));
  const sentObservations = Object.values(state.observations || {}).map((record) => record.item)
    .filter((item) => item && sentUrls.has(canonicalUrl(item.url || '')));
  // Títulos genéricos de diários antigos não identificam o ato nem sua edição.
  const knownFingerprints = new Set(records.filter((r) => !/^Diário Oficial de /i.test(r.title || '')).map((record) => record.titleFingerprint).filter(Boolean));
  const knownArticles = new Set([...records, ...sentObservations]
    .map((record) => canonicalUrl(record.articleUrl || '')).filter(Boolean));
  const knownEvents = new Set([...records, ...sentObservations]
    .map((record) => record.eventKey || formalEventKey(record)).filter(Boolean));
  const batchFingerprints = new Set();
  const batchArticles = new Set();
  const batchEvents = new Set();
  const batchRecords = [];

  return items.filter((item) => {
    const id = itemId(item);
    const fingerprint = titleFingerprint(item);
    const articleUrl = canonicalUrl(item.articleUrl || '');
    const eventKey = item.eventKey || formalEventKey(item);
    const confirmedUrls = eventKey ? confirmedEvents.get(eventKey) : null;
    const contentTokens = significantTokens(item);
    if (
      state.seen[id] ||
      (confirmedUrls?.size && !confirmedUrls.has(canonicalUrl(item.url || '')) &&
        !confirmedUrls.has(articleUrl)) ||
      (articleUrl && (knownArticles.has(articleUrl) || batchArticles.has(articleUrl))) ||
      (eventKey && (knownEvents.has(eventKey) || batchEvents.has(eventKey))) ||
      knownFingerprints.has(fingerprint) ||
      batchFingerprints.has(fingerprint) ||
      resemblesKnownEvent(item, contentTokens, records) ||
      resemblesKnownEvent(item, contentTokens, batchRecords)
    ) {
      return false;
    }
    item.id = id;
    item.titleFingerprint = fingerprint;
    if (eventKey) item.eventKey = eventKey;
    item.contentTokens = contentTokens;
    batchFingerprints.add(fingerprint);
    if (articleUrl) batchArticles.add(articleUrl);
    if (eventKey) batchEvents.add(eventKey);
    batchRecords.push({ category: item.classification?.category, contentTokens,
      publishedAt: item.publishedAt, sourcePublishedAt: item.sourcePublishedAt, eventAt: item.eventAt,
      articleUrl: item.articleUrl, eventKey, title: item.title, source: item.source });
    return true;
  });
}

export function enqueuePending(state, items, queuedAt = new Date().toISOString()) {
  state.pending ||= {};
  let added = 0;
  for (const item of items) {
    const id = item.id || itemId(item);
    if (state.seen[id] || state.pending[id]) continue;
    state.pending[id] = {
      queuedAt,
      attempts: 0,
      lastAttemptAt: null,
      lastError: null,
      item: {
        ...item,
        id,
        titleFingerprint: item.titleFingerprint || titleFingerprint(item),
        eventKey: item.eventKey || formalEventKey(item),
        contentTokens: item.contentTokens || significantTokens(item),
      },
    };
    added += 1;
  }
  return added;
}

export function listPending(state) {
  return Object.values(state.pending || {})
    .sort((left, right) => {
      const score = (right.item.classification?.score || 0) - (left.item.classification?.score || 0);
      return score || new Date(left.queuedAt) - new Date(right.queuedAt);
    })
    .map((record) => record.item);
}

// Uma regra editorial corrigida deve valer para a fila persistida antes de
// consultar a IA ou enviar itens classificados em execuções antigas.
export function reclassifyPending(state, minimumScore = 5, editorialGuard = null, eligible = null) {
  let removed = 0;
  for (const [id, record] of Object.entries(state.pending || {})) {
    const classification = editorialGuard
      ? editorialGuard(record.item, classifyItem(record.item))
      : classifyItem(record.item);
    if (!isPublishableClassification(classification, minimumScore) ||
      (eligible && !eligible(record.item, classification))) {
      delete state.pending[id];
      removed += 1;
    } else {
      record.item.classification = classification;
    }
  }
  return removed;
}

export function markPendingFailure(state, items, error, attemptedAt = new Date().toISOString()) {
  for (const item of items) {
    const record = state.pending?.[item.id || itemId(item)];
    if (!record) continue;
    record.attempts = (record.attempts || 0) + 1;
    record.lastAttemptAt = attemptedAt;
    record.lastError = String(error?.message || error).slice(0, 300);
  }
}

export function countSentToday(state, now = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const today = formatter.format(now);
  return Object.values(state.seen).filter((record) => formatter.format(new Date(record.sentAt)) === today)
    .length;
}

export function markSeen(state, item, sentAt = new Date().toISOString()) {
  const id = item.id || itemId(item);
  state.seen[id] = {
    sentAt,
    url: canonicalUrl(item.url),
    title: item.title,
    titleFingerprint: item.titleFingerprint || titleFingerprint(item),
    contentTokens: item.contentTokens || significantTokens(item),
    category: item.classification?.category || 'GERAL',
    source: item.source,
    publishedAt: item.publishedAt,
    sourcePublishedAt: item.sourcePublishedAt || '', eventAt: item.eventAt || '',
    articleUrl: item.articleUrl || '', eventKey: item.eventKey || formalEventKey(item),
  };
  if (state.pending) delete state.pending[id];
}

export { jaccard, significantTokens };
