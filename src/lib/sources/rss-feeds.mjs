import { XMLParser } from 'fast-xml-parser';
import { fetchWithRetry } from '../http.mjs';
import { normalizeWhitespace } from '../text.mjs';
import { canonicalUrl } from '../dedupe.mjs';
import { enrichArticles } from './web-scrapers.mjs';

const parser = new XMLParser({ ignoreAttributes: false, processEntities: true });

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return value?.['#text'] || value?.__cdata || '';
}

function entryLink(entry) {
  if (typeof entry.link === 'string') return entry.link;
  const links = asArray(entry.link);
  const preferred = links.find((link) => link?.['@_rel'] === 'alternate') || links[0];
  return preferred?.['@_href'] || textValue(preferred);
}

function parseDate(entry) {
  const value = textValue(entry.pubDate || entry.published || entry.updated || entry.date);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseFeed(xml, feed, since) {
  const parsed = parser.parse(xml);
  if (!parsed?.rss?.channel && !parsed?.feed) throw new Error('Resposta não é RSS/Atom válido');
  const entries = asArray(parsed?.rss?.channel?.item || parsed?.feed?.entry);
  return entries
    .map((entry) => ({
      kind: 'news',
      title: normalizeWhitespace(textValue(entry.title)),
      url: canonicalUrl(normalizeWhitespace(entryLink(entry))),
      publishedAt: parseDate(entry),
      source: feed.name,
      sourceUrl: feed.url,
      stateCode: feed.stateCode,
      entityName: feed.entityName,
      entityAlias: feed.entityAlias,
      summary: normalizeWhitespace(
        textValue(entry['content:encoded'] || entry.content || entry.description || entry.summary),
      ),
      rawText: normalizeWhitespace(
        textValue(entry['content:encoded'] || entry.content || entry.description || entry.summary),
      ),
    }))
    .filter(
      (item) => item.publishedAt && new Date(item.publishedAt) >= since && new Date(item.publishedAt) <= new Date() && item.title && /^https?:\/\//i.test(item.url),
    );
}

async function fetchFeed(feed, since, config, fetchImpl) {
  const response = await fetchWithRetry(feed.url, {
    fetchImpl,
    timeoutMs: config.timeoutMs,
    retries: config.retries,
    headers: { 'user-agent': 'RadarConsorciosIPEA/0.2 (+pesquisa acadêmica)' },
  });
  if (!response.ok) throw new Error(`${feed.name} respondeu ${response.status}`);
  return enrichArticles(parseFeed(await response.text(), feed, since), feed, config, fetchImpl);
}

export async function fetchRssFeeds(config, since, fetchImpl = fetch) {
  if (!config.enabled || !config.feeds?.length) return [];
  const feeds = config.feeds.filter((feed) => feed.enabled !== false);
  const settled = await Promise.allSettled(
    feeds.map((feed) => fetchFeed(feed, since, config, fetchImpl)),
  );
  const items = [];
  let successfulFeeds = 0;
  const diagnostics = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successfulFeeds += 1;
      items.push(...result.value);
      diagnostics.push({ name: feeds[index].name, status: 'ok', itemCount: result.value.length });
    } else {
      diagnostics.push({ name: feeds[index].name, status: 'error', itemCount: 0, message: result.reason.message });
      console.warn(`[fonte:rss:${feeds[index].name}] ${result.reason.message}`);
    }
  });
  return { items, diagnostics, ok: successfulFeeds > 0, degraded: successfulFeeds < feeds.length };
}

export { parseFeed };
