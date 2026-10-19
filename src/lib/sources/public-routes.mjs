// Public, documented export/feed routes. No CAPTCHA sessions or private APIs.
import { load } from 'cheerio';
import { XMLParser } from 'fast-xml-parser';
import { readFile } from 'node:fs/promises';
import { fetchWithRetry } from '../http.mjs';
import { canonicalUrl } from '../dedupe.mjs';
import { normalizeWhitespace } from '../text.mjs';

const asArray = value => value == null ? [] : Array.isArray(value) ? value : [value];
const text = value => normalizeWhitespace(typeof value === 'string' ? load(value).text() : '');
const relevant = value => /cons[oó]rcio/i.test(value);

export async function readKnownPublicUrls(file) {
  // Fail closed on damaged history; don't create a second archive on read failure.
  const rows = (await readFile(file, 'utf8')).split('\n').filter(x => x.trim()).map(JSON.parse);
  return new Set(rows.flatMap(row => [row.url, row.article_url, row.article_resolved_url])
    .filter(Boolean).map(canonicalUrl));
}

export function selectNewPublicItems(items, site, since, known = new Set(), now = new Date()) {
  const seen = new Set(known);
  const cutoff = new Date(site.discoverFrom);
  if (!Number.isFinite(cutoff.getTime())) throw new Error('Rota pública sem marco inicial válido');
  return items.filter(item => {
    const date = new Date(item.publishedAt);
    const url = canonicalUrl(item.url || '');
    if (!item.publishedAt || !Number.isFinite(date.getTime()) || date < since || date < cutoff || date > now ||
        !/^https:\/\//.test(url) || !relevant(`${item.title} ${item.rawText}`) || seen.has(url)) return false;
    seen.add(url); item.url = url;
    return true;
  }).map(item => ({ ...item, source: site.name, sourceUrl: site.url,
    scraper: site.adapter, previewOnly: true, discoveryOnly: true,
    reviewReason: 'Rota de descoberta: título/ementa não substitui leitura integral e prova do fato.' }));
}

export function parseSemana7Rss(xml) {
  const data = new XMLParser({ processEntities: true }).parse(xml);
  if (!data.rss?.channel) throw new Error('Semana 7: resposta não é RSS válido');
  return asArray(data.rss.channel.item).map(row => {
    const url = typeof row.link === 'string' ? row.link : '';
    if (!url.startsWith('https://www.semana7.com.br/')) return null;
    const date = new Date(row.pubDate);
    return { kind: 'news', title: text(row.title), url,
      publishedAt: Number.isFinite(date.getTime()) ? date.toISOString() : '',
      summary: text(row.description), rawText: text(row.description) };
  }).filter(Boolean);
}

export function parsePortalTpRows(rows) {
  if (!Array.isArray(rows) || rows.some(row => typeof row.link_documento !== 'string')) {
    throw new Error('PortalTP: exportação não é uma lista válida de documentos');
  }
  return rows.filter(row => /^https:\/\/s3\.amazonaws\.com\/el\.com\.br\/portal\/uploads\/3177\/[^?#]+\.pdf$/i.test(row.link_documento))
    .map(row => ({ kind: 'gazette', title: text(row.descricao), url: row.link_documento,
      // Portal timestamp is upload/publication, NOT date of enactment. Never infer eventAt.
      publishedAt: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(row.publicado_em || '')
        ? `${row.publicado_em.slice(0, 19)}-03:00` : '',
      stateCode: 'MG', territoryName: 'Guanhães',
      summary: text(row.descricao), rawText: text(row.descricao) }));
}

async function request(url, config, fetchImpl, options = {}) {
  const r = await fetchWithRetry(url, { fetchImpl, timeoutMs: config.timeoutMs || 20000,
    retries: Math.min(1, config.retries ?? 1), ...options,
    headers: { 'user-agent': config.userAgent || 'RadarConsorciosIPEA/0.3 (+pesquisa academica)' } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  let size = 0; const chunks = [];
  for await (const chunk of r.body) {
    size += chunk.length;
    if (size > 5_000_000) throw new Error('Resposta excedeu 5 MB');
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/, '');
}

export async function fetchPublicRoute(site, since, config, fetchImpl = fetch) {
  const known = config.knownPublicUrls || await readKnownPublicUrls(
    new URL('../../../data/catalogo/arquivo-coletas.ndjson', import.meta.url));
  const html = await request(site.url, config, fetchImpl);
  let rows;
  if (site.adapter === 'semana7-rss') rows = parseSemana7Rss(html);
  else if (site.adapter === 'guanhaes-portaltp') {
    const $ = load(html);
    const form = $('form').first();
    if (new URL(form.attr('action') || '', site.url).href !== site.url ||
        !form.find('select[name="ctl00$containerCorpo$cbxFormato"] option[value="JSON"]').length) {
      throw new Error('PortalTP: formulário público de exportação não encontrado');
    }
    const body = new URLSearchParams();
    form.find('input[type="hidden"][name]').each((_, e) => body.set($(e).attr('name'), $(e).attr('value') || ''));
    body.set('ctl00$containerCorpo$cbxFormato', 'JSON');
    body.set('ctl00$containerCorpo$btnAplicFiltro', '');
    rows = parsePortalTpRows(JSON.parse(await request(site.url, config, fetchImpl, { method: 'POST', body })));
  } else throw new Error('Adaptador público desconhecido');
  const items = selectNewPublicItems(rows, site, since, known);
  console.log(`[rota:${site.name}] ${rows.length} entradas na rota; ${items.length} documentos novos sobre consórcios; somente descoberta.`);
  return items;
}
