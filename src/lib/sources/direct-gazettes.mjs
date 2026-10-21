// Public search forms and individual HTML acts. No QD dependency, login or CAPTCHA bypass.
import { load } from 'cheerio';
import { fileURLToPath } from 'node:url';
import { fetchWithRetry } from '../http.mjs';
import { normalizeWhitespace } from '../text.mjs';
import { reuseArticleTexts } from '../article-text-store.mjs';

const HOST = 'www.diariomunicipal.com.br';
const PORTALS = { 'amm-mg': 'MG', ama: 'AL', amp: 'PR', femurn: 'RN', aprece: 'CE', famup: 'PB', amupe: 'PE' };
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
  if (Date.now() >= config.deadline) throw new Error('SIGPub: orçamento do portal esgotado');
  // The portals share one host: space starts across collectors, not just per state.
  if (config.requestDelayMs !== 0) {
    const wait = Math.max(0, nextRequestAt - Date.now());
    nextRequestAt = Math.max(nextRequestAt, Date.now()) + 350;
    if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  }
  const remaining = config.deadline - Date.now();
  if (remaining <= 0) throw new Error('SIGPub: orçamento do portal esgotado');
  const timeoutMs = Math.min(config.timeoutMs || 20000, remaining);
  let response;
  try { response = await fetchWithRetry(url, { fetchImpl, timeoutMs,
    retries: remaining >= timeoutMs * 2 + 1000 ? Math.min(config.retries ?? 1, 1) : 0,
    maxRetryWaitMs: Math.max(0, Math.min(5000, remaining - timeoutMs * 2)),
    redirect: 'error', headers: {
      'user-agent': config.userAgent || 'RadarConsorciosIPEA/0.3 (+pesquisa academica)',
      accept: 'text/html,application/xhtml+xml',
    } });
  } catch (error) { throw new Error(`SIGPub: cabeçalhos HTTP: ${error.message}`, { cause: error }); }
  if (!response.ok) throw new Error(`SIGPub HTTP ${response.status}`);
  if (!/text\/html/i.test(response.headers.get('content-type') || '')) throw new Error('SIGPub: resposta não HTML');
  let size = 0; const chunks = [];
  try {
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 8_000_000) throw new Error('SIGPub: HTML excede 8 MB');
      chunks.push(Buffer.from(chunk));
    }
  } catch (error) {
    // A resposta pode interromper após HTTP 200; reinicie sem os fragmentos anteriores.
    const transient = ['TimeoutError', 'AbortError'].includes(error.name) ||
      ['ECONNRESET', 'UND_ERR_SOCKET'].includes(error.cause?.code || error.code);
    if (transient && (config.retries ?? 1) > 0 && config.deadline - Date.now() > 500) {
      console.warn(`[diário:${new URL(url).pathname.split('/')[1]}] corpo HTTP interrompido; uma nova leitura.`);
      await new Promise(resolve => setTimeout(resolve, 500));
      return request(url, { ...config, retries: 0 }, fetchImpl);
    }
    throw new Error(`SIGPub: corpo HTTP: ${error.message}`, { cause: error });
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function resumedPages(site, since, now, config, fetchImpl, started, budget, maxPages) {
  const query = site.query || 'consórcio';
  const current = { from: day(since), to: day(now) };
  const validDay = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') &&
    Number.isFinite(Date.parse(`${value}T12:00:00-03:00`)) && day(new Date(`${value}T12:00:00-03:00`)) === value;
  let saved = config.gazetteState?.gazetteCursors?.[site.url];
  if (saved && saved.query !== query) saved = null;
  if (saved && (!validDay(saved.from) || !validDay(saved.to) ||
      saved.from > saved.to || saved.to > current.to || !Number.isSafeInteger(saved.nextPage) || saved.nextPage < 1 ||
      typeof saved.complete !== 'boolean' || !Array.isArray(saved.pending))) throw new Error('SIGPub: marcador de paginação inválido');
  let checkpoint = saved ? { ...saved } : { query, ...current, nextPage: 1, complete: false, pending: [] };
  if (checkpoint.complete && checkpoint.to < current.to) {
    checkpoint = { ...checkpoint, from: checkpoint.to > current.from ? checkpoint.to : current.from,
      to: current.to, nextPage: 1, complete: false };
  }
  const known = new Set(Object.values(config.gazetteState?.observations || {})
    .map(o => o.item).filter(i => i?.sourceUrl === site.url).map(i => i.url));
  if (Array.isArray(checkpoint.headUrls)) { known.clear(); for (const url of checkpoint.headUrls) known.add(url); }
  const byUrl = new Map(), pageByUrl = new Map(), fetched = new Map();
  const errors = [], freshPages = [], resumePages = [];
  let pages = 0, freshIncomplete = false, freshError = false, headUrls = [];
  const startPage = checkpoint.nextPage;
  const sameWindow = current.from === checkpoint.from && current.to === checkpoint.to;
  const loadPage = async (window, page, fresh) => {
    const key = `${window.from}:${window.to}:${page}`;
    if (fetched.has(key)) return fetched.get(key);
    pages++; (fresh ? freshPages : resumePages).push(page);
    const parsed = parseSigpubIndex(await request(sigpubSearchUrl(site, new Date(`${window.from}T00:00:00-03:00`),
      new Date(`${window.to}T12:00:00-03:00`), page), config, fetchImpl), site,
    new Date(`${window.from}T00:00:00-03:00`), new Date(`${window.to}T12:00:00-03:00`));
    fetched.set(key, parsed);
    for (const item of parsed.items) {
      byUrl.set(item.url, item);
      if (!fresh || sameWindow && page >= startPage) pageByUrl.set(item.url, page);
    }
    console.log(`[diário:${site.stateCode}] ${fresh ? 'novidades' : 'retomada'} página ${page}: ${parsed.listed} matérias.`);
    return parsed;
  };
  // Refresh until a known result, then spend the remaining page budget on the saved window.
  for (let page = 1; pages < maxPages && Date.now() - started < budget; page++) {
    try {
      const parsed = await loadPage(current, page, true);
      if (page === 1) headUrls = parsed.items.map(i => i.url);
      if (sameWindow && page === checkpoint.nextPage) checkpoint.nextPage++;
      if (!parsed.hasNext) {
        if (sameWindow) checkpoint.complete = true;
        freshIncomplete = false; break;
      }
      freshIncomplete = !parsed.items.some(i => known.has(i.url));
      if (!freshIncomplete) break;
      if (sameWindow && checkpoint.complete) { checkpoint.complete = false; checkpoint.nextPage = page + 1; }
    } catch (error) {
      if (!fetched.size) throw error;
      errors.push(`Novidades página ${page}: ${error.message}`); freshIncomplete = true; freshError = true; break;
    }
  }
  if (!fetched.size) throw new Error('SIGPub: orçamento esgotado antes de consultar uma página');
  checkpoint.headUrls = freshError ? [...known] : headUrls;
  // shortcut: o portal pagina por posição; adotar cursor estável se o publicador oferecer.
  while (!checkpoint.complete && pages < maxPages && Date.now() - started < budget) {
    const page = checkpoint.nextPage;
    try {
      const parsed = await loadPage(checkpoint, page, false);
      checkpoint.nextPage = page + 1; checkpoint.complete = !parsed.hasNext;
    } catch (error) { errors.push(`Retomada página ${page}: ${error.message}`); break; }
  }
  for (const item of checkpoint.pending) {
    safeUrl(item.url, site, 'materia/[A-Fa-f0-9]{8}');
    if (!byUrl.has(item.url)) byUrl.set(item.url, { ...item, rawText: '', previewOnly: true,
      contentProvenance: 'resumo_listagem', extractionError: undefined });
  }
  return { byUrl, pageByUrl, pages, errors, checkpoint, freshPages, resumePages,
    hasNext: !checkpoint.complete || freshIncomplete };
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
  const options = { ...config, timeoutMs: site.timeoutMs ?? config.timeoutMs,
    retries: site.retries ?? config.retries, deadline: started + budget };
  const pagination = site.resumePagination === true ? await resumedPages(site, since, now, options, fetchImpl, started, budget, maxPages) : null;
  if (pagination) {
    for (const [url, item] of pagination.byUrl) byUrl.set(url, item);
    pages = pagination.pages; hasNext = pagination.hasNext; errors.push(...pagination.errors);
  }
  for (let page = 1; !pagination && page <= maxPages; page++) {
    if (Date.now() - started >= budget) { hasNext = true; break; }
    try {
      const parsed = parseSigpubIndex(await request(sigpubSearchUrl(site, since, now, page), options, fetchImpl), site, since, now);
      console.log(`[diário:${site.stateCode}] página ${page}: ${parsed.listed} matérias; próxima página: ${parsed.hasNext ? 'sim' : 'não'}.`);
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
  const items = new Array(rows.length); let nextRow = 0;
  // Overlap two responses while request() still spaces every start on the shared host.
  const readNext = async () => {
    while (nextRow < rows.length) {
      const index = nextRow++; const row = rows[index];
      if (row.contentProvenance === 'pagina_original') {
        items[index] = { ...row, previewOnly: site.publish !== true }; continue;
      }
      if (reads >= maxDocuments || Date.now() - started >= budget) {
        failures++; items[index] = { ...row, extractionError: 'Íntegra adiada pelo limite de leitura da rodada' }; continue;
      }
      reads++;
      try { items[index] = parseSigpubArticle(await request(row.url, options, fetchImpl), row, site); }
      catch (error) { failures++; items[index] = { ...row, extractionError: error.message }; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(2, rows.length) }, readNext));
  if (pagination) {
    pagination.checkpoint.pending = items.filter(i => i.extractionError).map(i => ({ ...i, rawText: '', summary: '' }));
    const failedPages = items.filter(i => i.extractionError).map(i => pagination.pageByUrl.get(i.url)).filter(Boolean);
    if (failedPages.length) {
      pagination.checkpoint.nextPage = Math.min(pagination.checkpoint.nextPage, ...failedPages);
      pagination.checkpoint.complete = false; hasNext = true;
    }
  }
  const degraded = hasNext || failures > 0 || errors.length > 0;
  return { items, ...(pagination ? { checkpoint: pagination.checkpoint } : {}),
    diagnostic: { name: site.name, adapter: 'sigpub', status: degraded ? 'degraded' : 'ok',
    limited: hasNext && failures === 0 && errors.length === 0,
    itemCount: items.length, pages, fullTextCount: items.filter(i => i.contentProvenance === 'pagina_original').length,
    partialTextCount: failures, truncated: hasNext, durationMs: Date.now() - started,
    timeoutMs: options.timeoutMs || 20000,
    ...(pagination ? { freshPages: pagination.freshPages, resumePages: pagination.resumePages,
      nextPage: pagination.checkpoint.nextPage, cycleComplete: pagination.checkpoint.complete,
      window: { from: pagination.checkpoint.from, to: pagination.checkpoint.to } } : {}),
    message: `${pages} página(s); ${reads} leitura(s); ${failures} íntegra(s) pendente(s).` +
      (hasNext ? ' Há mais páginas: cobertura limitada nesta rodada.' : '') + (errors.length ? ` ${errors.join('; ')}` : '') } };
}
