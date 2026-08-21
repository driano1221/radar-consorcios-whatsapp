import { load } from 'cheerio';
import { fetchWithRetry } from '../http.mjs';
import { normalizeWhitespace } from '../text.mjs';

const DEFAULT_USER_AGENT =
  'RadarConsorciosIPEA/0.3 (+pesquisa academica; https://github.com/driano1221/radar-consorcios-whatsapp)';

function parseBrazilianDate(value) {
  const match = String(value || '').match(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T12:00:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function absoluteUrl(value, baseUrl) {
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return '';
  }
}

function withinWindow(item, since) {
  return item.title && item.url && item.publishedAt && new Date(item.publishedAt) >= since;
}

async function responseText(response, encoding) {
  const bytes = await response.arrayBuffer();
  const charset =
    encoding || /charset=([^;\s]+)/i.exec(response.headers.get('content-type') || '')?.[1] || 'utf-8';
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

export function parseRncp(html, site, since) {
  const $ = load(html);
  const cards = $('.post-item');
  if (!cards.length) throw new Error('cards .post-item nao encontrados');
  return cards
    .map((_, element) => {
      const card = $(element);
      const anchor = card.find('.entry-title a').first();
      const title = normalizeWhitespace(anchor.text());
      const summary = normalizeWhitespace(card.find('.post-excerpt, .post-desc').first().text());
      return {
        kind: 'news',
        title,
        url: absoluteUrl(anchor.attr('href'), site.url),
        publishedAt: parseBrazilianDate(card.find('.post-date.updated, .post-date').first().text()),
        source: site.name,
        sourceUrl: site.url,
        summary,
        rawText: summary,
      };
    })
    .get()
    .filter((item) => withinWindow(item, since));
}

export function parseCnm(html, site, since) {
  const $ = load(html);
  const page = $('#app').attr('data-page');
  if (!page) throw new Error('estrutura Inertia data-page nao encontrada');
  const parsed = JSON.parse(page);
  const rows = parsed?.props?.dados?.data;
  if (!Array.isArray(rows)) throw new Error('lista props.dados.data nao encontrada');

  return rows
    .map((row) => ({
      kind: 'news',
      title: normalizeWhitespace(row.titulo),
      url: absoluteUrl(`/comunicacao/noticias/${row.slug}`, site.url),
      publishedAt: parseBrazilianDate(row.datetime),
      source: site.name,
      sourceUrl: site.url,
      summary: normalizeWhitespace(row.conteudo),
      rawText: normalizeWhitespace(row.conteudo),
    }))
    .filter((item) => withinWindow(item, since));
}

export function parseTceMg(html, site, since) {
  const $ = load(html);
  const items = [];
  const datedHeadings = $('h2:has(.data-noticia-internas)');
  if (!datedHeadings.length) throw new Error('manchetes datadas nao encontradas');
  datedHeadings.each((_, element) => {
    const heading = $(element);
    const anchor = heading.find('a[href*="/Noticia/"]').first();
    const date = parseBrazilianDate(heading.find('.data-noticia-internas').text());
    if (!anchor.length || !date) return;
    const title = normalizeWhitespace(anchor.text());
    const paragraph = heading.nextAll('p').first();
    const summary = normalizeWhitespace(paragraph.text());
    const item = {
      kind: 'news',
      title,
      url: absoluteUrl(anchor.attr('href'), site.url),
      publishedAt: date,
      source: site.name,
      sourceUrl: site.url,
      summary,
      rawText: summary,
    };
    if (withinWindow(item, since)) items.push(item);
  });
  return items;
}

export function parseDiarioMunicipalIndex(html, site, since) {
  const $ = load(html);
  const link = $('#downloadPdf').attr('href') || $('#urlPdf').attr('value');
  const publishedAt = parseBrazilianDate($('#ultima-edicao span').first().text());
  if (!link || !publishedAt) throw new Error('indice da ultima edicao nao encontrado');
  const item = {
    kind: 'gazette-index',
    title: `Edição oficial mais recente — ${site.name}`,
    url: absoluteUrl(link, site.url),
    publishedAt,
    source: site.name,
    sourceUrl: site.url,
    summary: 'Monitoramento do índice da edição. O PDF ainda não é analisado por este coletor.',
    rawText: '',
  };
  return withinWindow(item, since) ? [item] : [];
}

const PARSERS = {
  rncp: parseRncp,
  cnm: parseCnm,
  'tce-mg': parseTceMg,
  'diario-municipal-index': parseDiarioMunicipalIndex,
};

async function fetchSite(site, since, config, fetchImpl) {
  const parser = PARSERS[site.adapter];
  if (!parser) throw new Error(`adaptador desconhecido: ${site.adapter}`);
  const response = await fetchWithRetry(site.url, {
    fetchImpl,
    timeoutMs: site.timeoutMs || config.timeoutMs,
    retries: site.retries ?? config.retries,
    headers: {
      accept: 'text/html,application/xhtml+xml',
      'user-agent': config.userAgent || DEFAULT_USER_AGENT,
    },
  });
  if (!response.ok) throw new Error(`${site.name} respondeu ${response.status}`);
  const html = await responseText(response, site.encoding);
  return parser(html, site, since).map((item) => ({
    ...item,
    scraper: site.adapter,
    previewOnly: config.publish !== true,
  }));
}

export async function fetchWebScrapers(config, since, fetchImpl = fetch) {
  if (!config?.enabled || !config.sites?.length) {
    return { items: [], diagnostics: [], ok: true };
  }
  const activeSites = config.sites.filter((site) => site.enabled !== false);
  const settled = await Promise.allSettled(
    activeSites.map((site) => fetchSite(site, since, config, fetchImpl)),
  );
  const items = [];
  const diagnostics = config.sites
    .filter((site) => site.enabled === false)
    .map((site) => ({
      name: site.name,
      adapter: site.adapter,
      status: 'disabled',
      itemCount: 0,
      message: site.fallback ? `cobertura alternativa: ${site.fallback}` : 'coletor desativado',
    }));
  let successfulSites = 0;
  settled.forEach((result, index) => {
    const site = activeSites[index];
    if (result.status === 'fulfilled') {
      successfulSites += 1;
      items.push(...result.value);
      diagnostics.push({
        name: site.name,
        adapter: site.adapter,
        status: 'ok',
        itemCount: result.value.length,
      });
      console.log(`[fonte:scraper:${site.name}] ${result.value.length} item(ns)`);
    } else {
      diagnostics.push({
        name: site.name,
        adapter: site.adapter,
        status: 'error',
        itemCount: 0,
        message: result.reason.message,
      });
      console.warn(`[fonte:scraper:${site.name}] ${result.reason.message}`);
    }
  });
  return { items, diagnostics, ok: !activeSites.length || successfulSites > 0 };
}

export { parseBrazilianDate };
