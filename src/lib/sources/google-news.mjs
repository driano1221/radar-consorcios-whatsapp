import { XMLParser } from 'fast-xml-parser';
import { fetchWithRetry } from '../http.mjs';
import { normalizeWhitespace } from '../text.mjs';

const parser = new XMLParser({ ignoreAttributes: false, processEntities: true });

function asArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function textValue(value) {
  if (typeof value === 'string') return value;
  return value?.['#text'] || value?.__cdata || '';
}

async function fetchQuery(query, since, fetchImpl) {
  const params = new URLSearchParams({
    q: query,
    hl: 'pt-BR',
    gl: 'BR',
    ceid: 'BR:pt-419',
  });
  const url = `https://news.google.com/rss/search?${params}`;
  const response = await fetchWithRetry(url, {
    fetchImpl,
    timeoutMs: 12000,
    retries: 1,
    headers: { 'user-agent': 'RadarConsorciosIPEA/0.2 (+pesquisa acadêmica)' },
  });
  if (!response.ok) throw new Error(`Google News respondeu ${response.status} para ${query}`);
  const xml = await response.text();
  const parsed = parser.parse(xml);

  return asArray(parsed?.rss?.channel?.item)
    .map((entry) => {
      const publishedAt = new Date(textValue(entry.pubDate));
      return {
        kind: 'news',
        title: normalizeWhitespace(textValue(entry.title)),
        url: textValue(entry.link),
        publishedAt: Number.isNaN(publishedAt.getTime()) ? null : publishedAt.toISOString(),
        source: normalizeWhitespace(textValue(entry.source)) || 'Google News',
        summary: normalizeWhitespace(textValue(entry.description)),
        rawText: normalizeWhitespace(textValue(entry.description)),
      };
    })
    .filter(
      (item) => item.publishedAt && new Date(item.publishedAt) >= since && item.title && item.url,
    );
}

export async function fetchGoogleNews(config, since, fetchImpl = fetch) {
  if (!config.enabled) return [];
  const settled = await Promise.allSettled(
    config.queries.map((query) => fetchQuery(query, since, fetchImpl)),
  );
  const items = [];
  let successfulQueries = 0;
  for (const result of settled) {
    if (result.status === 'fulfilled') {
      successfulQueries += 1;
      items.push(...result.value);
    }
    else console.warn(`[fonte:google-news] ${result.reason.message}`);
  }
  if (!successfulQueries) throw new Error('Todas as consultas ao Google News falharam.');
  return items;
}
