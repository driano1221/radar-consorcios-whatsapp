// Public search forms and individual HTML acts. No QD dependency, login or CAPTCHA bypass.
import { load } from 'cheerio';
import { fileURLToPath } from 'node:url';
import { fetchWithRetry } from '../http.mjs';
import { normalizeWhitespace } from '../text.mjs';
import { reuseArticleTexts } from '../article-text-store.mjs';

const HOST = 'www.diariomunicipal.com.br';
const PORTALS = { 'amm-mg': 'MG', ama: 'AL', amp: 'PR', femurn: 'RN' };
const clean = value => normalizeWhitespace(value || '');
let nextRequestAt = 0;
const day = date => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo',
  year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);

export function sigpubDate(value) {
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return '';
  const [, d, m, y] = match;
  const iso = `${y}-${m}-${d}`;
  const date = new Date(`${iso}T12:00:00-03:00`);
  return Number.isFinite(date.getTime()) && day(date) === iso ? date.toISOString() : '';
}

function portalFor(site) {
  const url = new URL(site.url);
  const portal = url.pathname.match(/^\/([a-z-]+)\/pesquisar\/?$/)?.[1];
  if (url.protocol !== 'https:' || url.hostname !== HOST || !PORTALS[portal] ||
      site.stateCode !== PORTALS[portal]) throw new Error('SIGPub: portal/UF fora da configuração validada');
  return portal;
}

function safeUrl(value, site, suffix) {
  const url = new URL(value || '', site.url);
  const portal = portalFor(site);
  if (url.protocol !== 'https:' || url.hostname !== HOST ||
      !new RegExp(`^/${portal}/${suffix}$`).test(url.pathname)) throw new Error('SIGPub: URL fora do portal');
  url.hash = ''; url.search = '';
  return url.href;
}

export function sigpubSearchUrl(site, since, now = new Date(), page = 1) {
  portalFor(site);
  const url = new URL(site.url);
  for (const [key, value] of Object.entries({ texto: site.query || 'consórcio', dataInicio: day(since),
    dataFim: day(now), ordenacao: 'recente', pagina: String(page) })) {
    url.searchParams.set(`busca_avancada[${key}]`, value);
  }
  return url;
}

export function parseSigpubIndex(html, site, since, now = new Date()) {
  const portal = portalFor(site);
  const $ = load(html);
  const input = $('input[name="busca_avancada[texto]"]');
  if (!input.length || input.attr('value') !== (site.query || 'consórcio')) {
    throw new Error('SIGPub: busca pública não reconhecida ou filtro não aplicado');
  }
  const cards = $('.materia-card');
  // Zero only counts as success with the site's explicit empty-result message.
  if (!cards.length && !/nenhuma mat[eé]ria|nenhum resultado|n[aã]o foram encontrad/i.test($('.busca-avancada,main').text())) {
    throw new Error('SIGPub: resultados ausentes, sem confirmação de busca vazia');
  }
  const seen = new Set();
  const items = cards.map((_, el) => {
    const card = $(el);
    const title = clean(card.find('.materia-card__titulo a').text());
    const url = safeUrl(card.find('.materia-card__titulo a').attr('href'), site, 'materia/[A-Fa-f0-9]{8}');
    const fields = Object.fromEntries(card.find('dl > div').map((_, d) =>
      [[clean($(d).find('dt').text()), clean($(d).find('dd').text())]]).get());
    const publishedAt = sigpubDate(fields['Circulação']);
    const code = fields['Código identificador'];
    if (!title || !publishedAt || url.split('/').at(-1).toUpperCase() !== code?.toUpperCase()) {
      throw new Error('SIGPub: título, data ou código da matéria inválido');
    }
    if (seen.has(url) || new Date(publishedAt) < new Date(`${day(since)}T00:00:00-03:00`) ||
        day(new Date(publishedAt)) > day(now)) return null;
    seen.add(url);
    const publisher = clean(card.find('.materia-card__entidade').text());
    const municipality = publisher.match(/^(?:Prefeitura|C[aâ]mara) Municipal (?:de |do |da )(.+?)(?:\/[A-Z]{2}| - [A-Z]{2})?$/i)?.[1] || '';
    return { kind: 'gazette', title, url, articleUrl: url, publishedAt, sourcePublishedAt: publishedAt,
      source: site.name, sourceUrl: site.url, stateCode: PORTALS[portal], territoryName: municipality,
      gazetteCode: code, gazetteEdition: fields['Edição'] || '', gazettePublisher: publisher,
      scraper: 'sigpub', summary: clean(card.find('.materia-card__trecho').text()), rawText: '',
      contentProvenance: 'resumo_listagem', previewOnly: true };
  }).get().filter(Boolean);
  const next = $('a[href]').filter((_, el) => /pr[oó]xima/i.test($(el).text())).first().attr('href');
  let hasNext = false;
  if (next) {
    const target = new URL(next, site.url);
    if (target.origin !== `https://${HOST}` || target.pathname !== `/${portal}/pesquisar`) {
      throw new Error('SIGPub: paginação fora do portal');
    }
    hasNext = true;
  }
  return { items, hasNext, listed: cards.length };
}

export function parseSigpubArticle(html, item, site) {
  safeUrl(item.url, site, 'materia/[A-Fa-f0-9]{8}');
  const $ = load(html);
  const code = clean($('.verificacao__codigo').text());
  const fields = {};
  $('.verificacao__dados dt').each((_, el) => { fields[clean($(el).text())] = clean($(el).next('dd').text()); });
  const publishedAt = sigpubDate(fields['Publicada em']);
  if (code.toUpperCase() !== item.gazetteCode.toUpperCase() || publishedAt !== item.publishedAt) {
    throw new Error('SIGPub: código/data da íntegra divergem da listagem');
  }
  const body = $('#materia').clone();
  body.find('script,style,nav,footer,form,aside,[align="right"]').remove();
  body.find('p,li,h1,h2,h3,h4,br,tr').append(' ');
  const text = clean(body.text());
  if (text.length < 100) throw new Error('SIGPub: corpo integral ausente ou curto');
  return { ...item, rawText: text, summary: text.slice(0, 1800),
    contentProvenance: 'pagina_original', articleReader: 'sigpub_materia_original',
    previewOnly: site.publish !== true };
}

async function request(url, config, fetchImpl) {
  // All four portals share one host: space starts across collectors, not just per state.
  if (config.requestDelayMs !== 0) {
    const wait = Math.max(0, nextRequestAt - Date.now());
    nextRequestAt = Math.max(nextRequestAt, Date.now()) + 350;
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  }
  const response = await fetchWithRetry(url, { fetchImpl, timeoutMs: config.timeoutMs || 20000,
    retries: config.retries ?? 1, redirect: 'error', headers: {
      'user-agent': config.userAgent || 'RadarConsorciosIPEA/0.3 (+pesquisa academica)',
      accept: 'text/html,application/xhtml+xml',
    } });
  if (!response.ok) throw new Error(`SIGPub HTTP ${response.status}`);
  if (!/text\/html/i.test(response.headers.get('content-type') || '')) throw new Error('SIGPub: resposta não HTML');
  let size = 0; const chunks = [];
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > 8_000_000) throw new Error('SIGPub: HTML excede 8 MB');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8');
}

export async function fetchDirectGazette(site, since, config = {}, fetchImpl = fetch) {
  const now = config.now || new Date();
  const started = Date.now();
  const budget = site.maxDurationMs || 90000;
  const maxPages = Math.min(site.maxPages || 2, 4);
  const maxDocuments = Math.min(site.maxDocuments || 40, 100);
  const byUrl = new Map();
  let hasNext = false; let pages = 0; let failures = 0; let reads = 0;
  const errors = [];
  const options = { ...config, timeoutMs: site.timeoutMs || config.timeoutMs };
  for (let page = 1; page <= maxPages; page++) {
    if (Date.now() - started >= budget) { hasNext = true; break; }
    try {
      const parsed = parseSigpubIndex(await request(sigpubSearchUrl(site, since, now, page), options, fetchImpl), site, since, now);
      for (const item of parsed.items) byUrl.set(item.url, item);
      pages++; hasNext = parsed.hasNext;
      if (!hasNext) break;
    } catch (error) {
      if (!pages) throw error;
      hasNext = true; errors.push(`Página ${page}: ${error.message}`); break;
    }
  }
  let rows = [...byUrl.values()];
  if (config.reuseCache !== false) {
    rows = (await reuseArticleTexts(fileURLToPath(new URL('../../../data/catalogo/', import.meta.url)), rows,
      { includeGazettes: true })).items;
  }
  // Structural acts get their full reading first; all remaining index entries stay explicit previews.
  rows.sort((a, b) => Number(/rateio|protocolo|estatuto|ratifica|assembleia|ingresso|ades[aã]o|extin[cç][aã]o/i.test(b.title)) -
    Number(/rateio|protocolo|estatuto|ratifica|assembleia|ingresso|ades[aã]o|extin[cç][aã]o/i.test(a.title)));
  const items = [];
  for (const row of rows) {
    if (row.contentProvenance === 'pagina_original') {
      items.push({ ...row, previewOnly: site.publish !== true }); continue;
    }
    if (reads >= maxDocuments || Date.now() - started >= budget) {
      failures++; items.push({ ...row, extractionError: 'Íntegra adiada pelo limite de leitura da rodada' }); continue;
    }
    reads++;
    try { items.push(parseSigpubArticle(await request(row.url, options, fetchImpl), row, site)); }
    catch (error) { failures++; items.push({ ...row, extractionError: error.message }); }
    if (config.requestDelayMs !== 0) await new Promise(resolve => setTimeout(resolve, config.requestDelayMs ?? 350));
  }
  const degraded = hasNext || failures > 0 || errors.length > 0;
  return { items, diagnostic: { name: site.name, adapter: 'sigpub', status: degraded ? 'degraded' : 'ok',
    itemCount: items.length, pages, fullTextCount: items.filter(i => i.contentProvenance === 'pagina_original').length,
    partialTextCount: failures, truncated: hasNext, durationMs: Date.now() - started,
    message: `${pages} página(s); ${reads} leitura(s); ${failures} íntegra(s) pendente(s).` +
      (hasNext ? ' Há mais páginas: cobertura limitada nesta rodada.' : '') + (errors.length ? ` ${errors.join('; ')}` : '') } };
}
