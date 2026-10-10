import * as cheerio from 'cheerio';
import googleNewsDecoder from 'google-news-url-decoder';
import { fetchWithRetry } from './http.mjs';
import { normalizeWhitespace } from './text.mjs';
import { classifyItem } from './classifier.mjs';
import { readWithReadability, readWithTrafilatura } from './article-readers.mjs';
import { sourcePublicationDate } from './publication-date.mjs';

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
  if (item.contentProvenance === 'pagina_original' && summary.length >= 100) return false;
  return !summary || (summary.length >= 25 && title.includes(summary)) || summary.length < 1600;
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

function canonicalArticleUrl(raw) {
  const url = publicHttpUrl(raw);
  if (!url) return '';
  const parsed = new URL(url);
  const tceId = parsed.hostname === 'www.tce.mg.gov.br' &&
    parsed.pathname.match(/\/(?:Noticia|noticia\/Detalhe)\/(\d+)$/i)?.[1];
  return tceId ? `https://www.tce.mg.gov.br/noticia/Detalhe/${tceId}` : url;
}

function extractTceMgText(html) {
  const $ = cheerio.load(html);
  const body = $('.conteudo').first().clone();
  body.find('script, style, nav, footer, aside, form, .breadcrumb').remove();
  return normalizeWhitespace(body.text());
}

async function readHtmlResponse(response) {
  const charset = response.headers.get('content-type')?.match(/charset\s*=\s*['"]?([^;'"\s]+)/i)?.[1];
  if (!charset || /^utf-?8$/i.test(charset)) return response.text();
  return new TextDecoder(charset).decode(await response.arrayBuffer());
}

export function extractArticleText(html) {
  const $ = cheerio.load(html);
  $('script, style, nav, footer, aside, header, form, noscript, .related, .comments, .advertisement').remove();
  const selectors = ['[itemprop="articleBody"]', 'article', '.entry-content', '.post-content', 'main'];
  for (const selector of selectors) {
    const text = normalizeWhitespace($(selector).first().text());
    if (text.length >= 250) return text;
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

export async function enrichArticle(item, { fetchImpl = fetch, decode = (url) => decoder.decode(url),
  readability = readWithReadability, trafilatura = readWithTrafilatura, onFailure = () => {} } = {}) {
  if (!lacksArticleText(item) || item.kind === 'gazette') return item;
  let articleUrl = canonicalArticleUrl(item.url);
  if (!articleUrl) { onFailure(item, 'url_invalida'); return item; }
  if (new URL(articleUrl).hostname === 'news.google.com') {
    const result = await bounded(decode(articleUrl), 12000);
    articleUrl = canonicalArticleUrl(result?.decoded_url);
    if (!result?.status || !articleUrl) { onFailure(item, 'google_news_nao_resolvido'); return item; }
  }
  if (/\.pdf(?:$|\?)/i.test(articleUrl)) { onFailure(item, 'destino_pdf'); return item; }
  const response = await fetchPublicHtml(articleUrl, fetchImpl);
  if (!response?.ok) { onFailure(item, `http_${response?.status || 'sem_resposta'}`); return item; }
  if (!/text\/html/i.test(response.headers.get('content-type') || '')) { onFailure(item, 'destino_nao_html'); return item; }
  const length = Number(response.headers.get('content-length') || 0);
  if (length > 2_000_000) { onFailure(item, 'pagina_grande_demais'); return item; }
  const html = await readHtmlResponse(response);
  if (html.length > 2_000_000) { onFailure(item, 'pagina_grande_demais'); return item; }
  // Alguns portais devolvem HTTP 200 para uma tela de desafio, não para a notícia.
  // Não a tratar como extração vazia nem tentar contornar a verificação.
  if (/<title>\s*(?:just a moment|attention required|verifica[cç][aã]o de seguran[cç]a)/i.test(html) ||
    /(?:cf-chl-|challenge-platform|checking your browser before accessing)/i.test(html)) {
    onFailure(item, 'bloqueio_antibot'); return item;
  }
  const publication = sourcePublicationDate(html);
  const tceText = new URL(articleUrl).hostname === 'www.tce.mg.gov.br' ? extractTceMgText(html) : '';
  const [readerResult, trafilaturaResult] = await Promise.allSettled([
    Promise.resolve().then(() => readability(html, articleUrl)),
    Promise.resolve().then(() => trafilatura(html)),
  ]);
  const readerText = readerResult.status === 'fulfilled' ? normalizeWhitespace(readerResult.value) : '';
  const trafilaturaText = trafilaturaResult.status === 'fulfilled' ? normalizeWhitespace(trafilaturaResult.value) : '';
  const validReader = readerText.length >= 100 && SIGNAL.test(readerText);
  const validTrafilatura = trafilaturaText.length >= 100 && SIGNAL.test(trafilaturaText);
  const text = tceText.length >= 100 && SIGNAL.test(tceText) ? tceText
    : validReader ? readerText : validTrafilatura ? trafilaturaText : extractArticleText(html);
  if (text.length < 100 || !SIGNAL.test(text)) { onFailure(item, 'texto_ausente_ou_sem_consorcio'); return item; }
  const readerCategory = validReader ? classifyItem({ ...item, summary: readerText.slice(0, 1800), rawText: readerText }).category : '';
  const trafilaturaCategory = validTrafilatura
    ? classifyItem({ ...item, summary: trafilaturaText.slice(0, 1800), rawText: trafilaturaText }).category : '';
  const incompleteComparison = !validReader || !validTrafilatura;
  const disagreement = !incompleteComparison && readerCategory !== trafilaturaCategory;
  return { ...item, articleUrl, summary: text.slice(0, 1800), rawText: text,
    sourcePublishedAt: publication?.date || item.sourcePublishedAt || '',
    sourceDateEvidence: publication?.source || item.sourceDateEvidence || '',
    contentProvenance: 'pagina_original', articleReader: text === tceText ? 'tce_mg_corpo'
      : validReader ? 'readability' : validTrafilatura ? 'trafilatura' : 'seletor_original',
    extractionCategories: { readability: readerCategory, trafilatura: trafilaturaCategory },
    extractionDisagreement: disagreement,
    previewOnly: Boolean(item.previewOnly || incompleteComparison || disagreement),
    reviewReason: disagreement ? 'Readability e Trafilatura discordaram da categoria; conferência humana necessária.'
      : incompleteComparison ? 'Um dos leitores não recuperou texto suficiente; conferência humana necessária.' : item.reviewReason || '' };
}

export async function enrichArticles(items, { limit = 12, concurrency = 3, includeUnsignaled = false, ...deps } = {}) {
  const selected = items.map((item, index) => ({ item, index }))
    .filter(({ item }) => item.kind !== 'gazette' && lacksArticleText(item) &&
      (includeUnsignaled || SIGNAL.test(item.title || '')))
    .sort((a, b) => Number(/ades[aã]o|ingresso|ratifica|cria[cç][aã]o|retirada|desligamento/i.test(b.item.title)) -
      Number(/ades[aã]o|ingresso|ratifica|cria[cç][aã]o|retirada|desligamento/i.test(a.item.title)))
    .slice(0, limit);
  const output = [...items];
  let next = 0; let enriched = 0; let failed = 0;
  const missingText = [];
  await Promise.all(Array.from({ length: Math.min(concurrency, selected.length) }, async () => {
    while (next < selected.length) {
      const { item, index } = selected[next++];
      const recordMissing = (source, reason) => {
        missingText.push({ index, source: source.source || '', title: source.title || '',
          url: source.url || '', reason });
        deps.onFailure?.(source, reason);
      };
      try {
        output[index] = await enrichArticle(item, { ...deps, onFailure: recordMissing });
        if (output[index] !== item) enriched += 1;
      } catch (error) { failed += 1; recordMissing(item, `erro: ${error.message}`); console.warn(`[texto] ${item.source}: ${error.message}`); }
    }
  }));
  missingText.sort((left, right) => left.index - right.index);
  return { items: output, attempted: selected.length, enriched, failed,
    missingText: missingText.map(({ index, ...entry }) => entry) };
}

export function classifyEnrichedItem(item, original) {
  const classification = classifyItem(item);
  const before = original === item ? classification : classifyItem(original);
  const categoryChanged = item.contentProvenance === 'pagina_original' &&
    classification.category !== 'GERAL' && classification.category !== before.category;
  return { ...item, classification, previewOnly: Boolean(item.previewOnly || categoryChanged || item.extractionDisagreement) };
}
