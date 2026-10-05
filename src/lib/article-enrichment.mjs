import * as cheerio from 'cheerio';
import googleNewsDecoder from 'google-news-url-decoder';
import { fetchWithRetry } from './http.mjs';
import { normalizeWhitespace } from './text.mjs';
import { classifyItem } from './classifier.mjs';

const { GoogleDecoder } = googleNewsDecoder;
const decoder = new GoogleDecoder();
const SIGNAL = /cons[oó]rc|rateio|protocolo de inten[cç][oõ]es|ades[aã]o|desligamento|retirada/i;

function comparable(value) {
  return normalizeWhitespace(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function lacksArticleText(item) {
  const title = comparable(item.title || '');
  const summary = comparable(item.rawText || item.summary || '');
  return !summary || (summary.length >= 25 && title.includes(summary));
}

function publicHttpUrl(raw) {
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    const host = url.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') ||
      /^(?:127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?$|fc|fd|fe80)/.test(host) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)) return '';
    return url.href;
  } catch { return ''; }
}

export function extractArticleText(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, aside, header, form, noscript, .related, .comments, .advertisement').remove();
  const selectors = ['[itemprop="articleBody"]', 'article', '.entry-content', '.post-content', 'main'];
  for (const selector of selectors) {
    const text = normalizeWhitespace($(selector).first().text());
    if (text.length >= 250) return text.slice(0, 4000);
  }
  const description = normalizeWhitespace($('meta[property="og:description"]').attr('content') ||
    $('meta[name="description"]').attr('content') || '');
  return description.length >= 100 ? description.slice(0, 1200) : '';
}

async function bounded(promise, milliseconds) {
  let timer;
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('resolução do link expirou')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

async function fetchPublicHtml(url, fetchImpl) {
  let current = url;
  for (let hop = 0; hop < 4; hop += 1) {
    const response = await fetchWithRetry(current, { fetchImpl, timeoutMs: 10000, retries: 0,
      redirect: 'manual', headers: { 'user-agent': 'RadarConsorciosIPEA/0.2 (+pesquisa acadêmica)' } });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const next = publicHttpUrl(new URL(response.headers.get('location') || '', current).href);
    if (!next) return null;
    current = next;
  }
  return null;
}

export async function enrichArticle(item, { fetchImpl = fetch, decode = (url) => decoder.decode(url) } = {}) {
  if (!lacksArticleText(item) || item.kind === 'gazette') return item;
  let articleUrl = publicHttpUrl(item.url);
  if (!articleUrl) return item;
  if (new URL(articleUrl).hostname === 'news.google.com') {
    const result = await bounded(decode(articleUrl), 12000);
    articleUrl = publicHttpUrl(result?.decoded_url);
    if (!result?.status || !articleUrl) return item;
  }
  if (/\.pdf(?:$|\?)/i.test(articleUrl)) return item;
  const response = await fetchPublicHtml(articleUrl, fetchImpl);
  if (!response?.ok || !/text\/html/i.test(response.headers.get('content-type') || '')) return item;
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 2_000_000) return item;
  const html = await response.text();
  if (html.length > 2_000_000) return item;
  const text = extractArticleText(html);
  if (text.length < 100 || !SIGNAL.test(text)) return item;
  return { ...item, articleUrl, summary: text.slice(0, 1800), rawText: text,
    contentProvenance: 'pagina_original' };
}

export async function enrichArticles(items, { limit = 12, concurrency = 3, ...deps } = {}) {
  const selected = items.map((item, index) => ({ item, index }))
    .filter(({ item }) => item.kind !== 'gazette' && lacksArticleText(item) && SIGNAL.test(item.title || ''))
    .sort((a, b) => Number(/ades[aã]o|ingresso|ratifica|cria[cç][aã]o|retirada|desligamento/i.test(b.item.title)) -
      Number(/ades[aã]o|ingresso|ratifica|cria[cç][aã]o|retirada|desligamento/i.test(a.item.title)))
    .slice(0, limit);
  const output = [...items];
  let next = 0; let enriched = 0; let failed = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, async () => {
    while (next < selected.length) {
      const { item, index } = selected[next++];
      try {
        output[index] = await enrichArticle(item, deps);
        if (output[index] !== item) enriched += 1;
      } catch (error) { failed += 1; console.warn(`[texto] ${item.source}: ${error.message}`); }
    }
  }));
  return { items: output, attempted: selected.length, enriched, failed };
}

export function classifyEnrichedItem(item, original) {
  const classification = classifyItem(item);
  const before = original === item ? classification : classifyItem(original);
  const categoryChanged = item.contentProvenance === 'pagina_original' &&
    classification.category !== 'GERAL' && classification.category !== before.category;
  return { ...item, classification, previewOnly: Boolean(item.previewOnly || categoryChanged) };
}
