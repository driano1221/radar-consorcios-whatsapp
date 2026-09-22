import { fetchWithRetry } from '../http.mjs';
import { normalizeWhitespace } from '../text.mjs';

const ARTICLE_PATH = {
  noticia: 'noticias',
  evento: 'eventos',
  'boa-pratica': 'boas-praticas',
};

export function parseCigaArticle(row, config, since, now = new Date()) {
  if (!ARTICLE_PATH[row?.tipo] || !/^\d{4}-\d{2}-\d{2}$/.test(row.data || '')) return null;
  if (!row.slug || !row.titulo) return null;
  const publishedAt = `${row.data}T12:00:00-03:00`;
  const date = new Date(publishedAt);
  if (Number.isNaN(date.getTime()) || date < since || date > now) return null;
  const summary = normalizeWhitespace(row.corpo || row.resumo || '');
  return {
    kind: 'news',
    title: normalizeWhitespace(row.titulo),
    url: new URL(`/blog/${ARTICLE_PATH[row.tipo]}/${encodeURIComponent(row.slug)}`, config.baseUrl).href,
    publishedAt,
    source: 'CIGA',
    sourceUrl: new URL('/blog/noticias', config.baseUrl).href,
    stateCode: 'SC',
    entityAlias: 'CIGA',
    entityName: 'Consórcio de Inovação na Gestão Pública',
    summary,
    rawText: summary,
  };
}

export async function fetchCiga(config, since, fetchImpl = fetch) {
  if (!config?.enabled) return { items: [], diagnostics: [], ok: true };
  const items = [];
  const pageSize = config.pageSize || 100;
  const maxPages = config.maxPages || 2;
  let truncated = false;
  for (let page = 1; page <= maxPages; page += 1) {
    const url = new URL('/api/artigos', config.baseUrl);
    url.searchParams.set('pagination[page]', String(page));
    url.searchParams.set('pagination[pageSize]', String(pageSize));
    url.searchParams.set('sort', 'data:desc');
    const response = await fetchWithRetry(url, {
      fetchImpl, timeoutMs: config.timeoutMs || 12000, retries: config.retries ?? 1,
    });
    if (!response.ok) throw new Error(`CIGA respondeu HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload.data) || !payload.meta?.pagination) {
      throw new Error('CIGA: formato inesperado da API de artigos');
    }
    items.push(...payload.data.map((row) => parseCigaArticle(row, config, since)).filter(Boolean));
    const hasMore = page < payload.meta.pagination.pageCount;
    const oldest = payload.data.at(-1)?.data;
    if (!hasMore || oldest && new Date(`${oldest}T23:59:59-03:00`) < since) break;
    if (page === maxPages) truncated = true;
  }
  return { items, diagnostics: [{ name: 'CIGA', status: truncated ? 'degraded' : 'ok', itemCount: items.length,
    ...(truncated ? { message: 'Limite de páginas da API atingido' } : {}) }], ok: true, degraded: truncated };
}
