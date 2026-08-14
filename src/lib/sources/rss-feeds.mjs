import { XMLParser } from 'fast-xml-parser';
import { fetchWithRetry } from '../http.mjs';
import { normalizeWhitespace } from '../text.mjs';

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
  const entries = asArray(parsed?.rss?.channel?.item || parsed?.feed?.entry);
  return entries
    .map((entry) => ({
      kind: 'news',
      title: normalizeWhitespace(textValue(entry.title)),
      url: entryLink(entry),
      publishedAt: parseDate(entry),
      source: feed.name,
      summary: normalizeWhitespace(
        textValue(entry.description || entry.summary || entry.content || entry['content:encoded']),
      ),
      rawText: normalizeWhitespace(
        textValue(entry.description || entry.summary || entry.content || entry['content:encoded']),
      ),
    }))
    .filter(
      (item) => item.publishedAt && new Date(item.publishedAt) >= since && item.title && item.url,
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
  return parseFeed(await response.text(), feed, since);
}

export async function fetchRssFeeds(config, since, fetchImpl = fetch) {
  if (!config.enabled || !config.feeds?.length) return [];
  const settled = await Promise.allSettled(
    config.feeds.map((feed) => fetchFeed(feed, since, config, fetchImpl)),
  );
  const items = [];
  let successfulFeeds = 0;
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successfulFeeds += 1;
      items.push(...result.value);
    } else {
      console.warn(`[fonte:rss:${config.feeds[index].name}] ${result.reason.message}`);
    }
  });
  if (!successfulFeeds) throw new Error('Todos os feeds RSS falharam.');
  return items;
}

export { parseFeed };
