import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizeForMatch } from './text.mjs';

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
  return sha256(normalizeForMatch(item.title).replace(/\b(de|da|do|das|dos|e|em|no|na)\b/g, ' '));
}

export async function loadState(stateFile) {
  try {
    const parsed = JSON.parse(await readFile(stateFile, 'utf8'));
    return {
      version: 3,
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
}

function resemblesKnownEvent(item, tokens, records, threshold = 0.66) {
  return records.some(
    (record) =>
      record.category === item.classification?.category &&
      record.contentTokens?.length >= 4 &&
      jaccard(tokens, record.contentTokens) >= threshold,
  );
}

export function selectUnseen(items, state) {
  const pendingRecords = Object.values(state.pending || {}).map(({ item }) => ({
    category: item.classification?.category,
    contentTokens: item.contentTokens,
    titleFingerprint: item.titleFingerprint,
  }));
  const records = [...Object.values(state.seen), ...pendingRecords];
  const knownFingerprints = new Set(records.map((record) => record.titleFingerprint).filter(Boolean));
  const batchFingerprints = new Set();
  const batchRecords = [];

  return items.filter((item) => {
    const id = itemId(item);
    const fingerprint = titleFingerprint(item);
    const contentTokens = significantTokens(item);
    if (
      state.seen[id] ||
      knownFingerprints.has(fingerprint) ||
      batchFingerprints.has(fingerprint) ||
      resemblesKnownEvent(item, contentTokens, records) ||
      resemblesKnownEvent(item, contentTokens, batchRecords)
    ) {
      return false;
    }
    item.id = id;
    item.titleFingerprint = fingerprint;
    item.contentTokens = contentTokens;
    batchFingerprints.add(fingerprint);
    batchRecords.push({ category: item.classification?.category, contentTokens });
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
  };
  if (state.pending) delete state.pending[id];
}

export { jaccard, significantTokens };
