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
  return item.title && /^https?:\/\//i.test(item.url) && item.publishedAt && new Date(item.publishedAt) >= since && new Date(item.publishedAt) <= new Date();
}

export function parseTceSp(html, site, since) {
  const $ = load(html);
  const cards = $('.listagem-noticia');
  if (!cards.length) throw new Error('TCE-SP: listagem de notícias não encontrada');
  return cards.map((_, el) => {
    const card = $(el);
    const anchor = card.find('h2 a').first();
    const summary = normalizeWhitespace(card.children('.field--item').last().text());
    return { kind: 'news', title: normalizeWhitespace(anchor.text()),
      url: absoluteUrl(anchor.attr('href'), site.url), publishedAt: parseBrazilianDate(summary),
      source: site.name, sourceUrl: site.url, stateCode: 'SP', summary, rawText: summary };
  }).get().filter((item) => withinWindow(item, since));
}

export function parseCisamapi(html, site, since) {
  const $ = load(html);
  const cards = $('.news-post-txt');
  if (!cards.length) throw new Error('CISAMAPI: cards de notícias não encontrados');
  return cards.map((_, el) => {
    const a = $(el).find('h2 a').first();
    const date = a.attr('href')?.match(/\/(\d{2})-(\d{2})-(\d{4})\//);
    const title = normalizeWhitespace(a.text());
    return { kind: 'news', title, url: absoluteUrl(a.attr('href'), site.url),
      publishedAt: date ? parseBrazilianDate(`${date[1]}/${date[2]}/${date[3]}`) : null,
      source: site.name, sourceUrl: site.url, stateCode: 'MG', summary: '', rawText: '' };
  }).get().filter((item) => withinWindow(item, since));
}

// Conteúdo apenas da notícia, sem menus/rodapés que produziriam falsos positivos.
export async function enrichArticles(items, site, config, fetchImpl) {
  if (!site.articleSelector) return items;
  const enriched = [];
  for (const item of items.slice(0, site.maxArticles || 12)) {
    try {
      if (new URL(item.url).hostname !== new URL(site.url).hostname) throw new Error('Domínio inesperado');
      const r = await fetchWithRetry(item.url, { fetchImpl, timeoutMs: config.timeoutMs, retries: 0 });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const $ = load(await responseText(r, site.encoding));
      const body = $(site.articleSelector).first().clone();
      body.find('script,style,nav,footer,form').remove();
      body.find('p,li,h1,h2,h3,h4,br').append(' ');
      const text = normalizeWhitespace(body.text());
      if (text.length < 80) throw new Error('Texto da notícia não encontrado');
      enriched.push({ ...item, summary: text.slice(0, 4000), rawText: text.slice(0, 4000) });
    } catch (error) {
      console.warn(`[artigo:${site.name}] ${error.message}`);
      enriched.push({ ...item, previewOnly: true, extractionError: error.message });
    }
  }
  return [...enriched, ...items.slice(site.maxArticles || 12)];
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
  'tce-sp': parseTceSp,
  cisamapi: parseCisamapi,
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
  const items = await enrichArticles(parser(html, site, since), site, config, fetchImpl);
  return items.map((item) => ({
    ...item,
    scraper: site.adapter,
    entityName: site.entityName,
    entityAlias: site.entityAlias,
    // A ativação é por fonte: assim um portal homologado pode publicar sem
    // liberar automaticamente todos os demais scrapers ainda em prévia.
    previewOnly: item.previewOnly || site.publish !== true,
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
        status: result.value.some((item) => item.extractionError) ? 'degraded' : 'ok',
        ...(result.value.some((item) => item.extractionError) ? { message: 'Falha ao extrair texto de uma ou mais notícias; itens mantidos em prévia' } : {}),
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
  return { items, diagnostics, ok: !activeSites.length || successfulSites > 0, degraded: successfulSites < activeSites.length };
}

export { parseBrazilianDate };
