import { load } from 'cheerio';
import { normalizeForMatch, normalizeWhitespace } from './text.mjs';

const clippedTitle = /(?:\.\.\.|…)(?:\s+-\s+[^-]+)?\s*$/;
let lastCleanUriAttempt = 0;

function fallbackTitle(item) {
  const title = normalizeWhitespace(item.title || '');
  if (!clippedTitle.test(title)) return title;
  const prefix = title.replace(/(?:\.\.\.|…).*$/, '').replace(/^Legislação\s*-\s*/i, '').trim();
  const entrance = prefix.match(/autoriza o ingresso do Munic[ií]pio de (.+?) no Cons[oó]rcio/i);
  if (entrance) return `${entrance[1]} autoriza ingresso em consórcio intermunicipal`;
  const meeting = prefix.match(/^(Cons[oó]rcio\s+\S+) participa de Encontro/i);
  if (meeting) return `${meeting[1]} participa de encontro`;
  const label = item.classification?.category || 'CONSÓRCIOS';
  return `Publicação sobre ${label.toLocaleLowerCase('pt-BR')} — ${normalizeWhitespace(item.source || 'fonte consultada')}`;
}

function officialTitle(ementa) {
  const entrance = ementa.match(/autoriza o ingresso do Munic[ií]pio de (.+?) no Cons[oó]rcio[^()]*\(([A-Z][A-Z0-9]{2,12})\)/i);
  if (entrance) return `${entrance[1]} autoriza ingresso no ${entrance[2]}`;
  return ementa.length <= 170 ? ementa : null;
}

export async function findOfficialLegislation(item, fetchImpl = fetch) {
  let base;
  try { base = new URL(item.sourceUrl); } catch { return null; }
  if (!/\.leg\.br$/i.test(base.hostname) || !/^Legislação\s*-/i.test(item.title || '') || !clippedTitle.test(item.title || '')) return null;
  const prefix = normalizeForMatch(item.title.replace(/^Legislação\s*-\s*/i, '').replace(/(?:\.\.\.|…).*/, '').trim());
  if (prefix.length < 35) return null;
  const listing = new URL('/legislacao', base);
  const response = await fetchImpl(listing, { signal: AbortSignal.timeout(9000) });
  if (!response.ok) return null;
  const $ = load(await response.text());
  let match = null;
  $('tr').each((_, row) => {
    const ementa = normalizeWhitespace($(row).find('td').eq(1).text());
    const link = $(row).find('a[href]').first().attr('href');
    if (!match && ementa && link && normalizeForMatch(ementa).startsWith(prefix)) {
      const target = new URL(link, listing);
      if (target.hostname === base.hostname && target.protocol === 'https:') match = { ementa, url: target.href };
    }
  });
  if (!match) return null;
  const detail = new URL(match.url);
  const compact = detail.pathname.match(/^(\/legislacao\/detalhe\/\d+)\//);
  if (compact) {
    const candidate = new URL(compact[1], detail);
    try {
      const check = await fetchImpl(candidate, { signal: AbortSignal.timeout(9000) });
      if (check.ok && normalizeForMatch(await check.text()).includes(normalizeForMatch(match.ementa.slice(0,65)))) {
        match.url = candidate.href;
      }
    } catch { /* A URL completa já foi obtida da página oficial. */ }
  }
  return match;
}

export async function shortenLongUrl(target, cache = {}, fetchImpl = fetch, maxLength = 180) {
  if (target.length <= maxLength) return target;
  if (cache[target]) return cache[target];
  const failures = [];
  try {
    const waitMs = Math.max(0, 550 - (Date.now() - lastCleanUriAttempt));
    if (waitMs) await new Promise((resolve) => setTimeout(resolve, waitMs));
    lastCleanUriAttempt = Date.now();
    const response = await fetchImpl('https://cleanuri.com/api/v1/shorten', {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ url: target }), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { result_url: short } = await response.json();
    if (!/^https:\/\/cleanuri\.com\/[A-Za-z0-9]+$/.test(short || '')) throw new Error('Resposta inesperada');
    cache[target] = short;
    return short;
  } catch (error) {
    failures.push(`CleanURI: ${error.message}`);
  }
  try {
    const endpoint = new URL('https://is.gd/create.php');
    endpoint.searchParams.set('format', 'json');
    endpoint.searchParams.set('url', target);
    const response = await fetchImpl(endpoint, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { shorturl: short } = await response.json();
    if (!/^https:\/\/is\.gd\/[A-Za-z0-9]+$/.test(short || '')) throw new Error('Resposta inesperada');
    cache[target] = short;
    return short;
  } catch (error) {
    failures.push(`is.gd: ${error.message}`);
  }
  console.warn(`[link] Encurtadores indisponíveis; endereço original mantido (${failures.join('; ')}).`);
  return target;
}

export async function presentItem(item, cache = {}, fetchImpl = fetch) {
  if (item.kind === 'gazette') return item;
  const presented = { ...item };
  if (clippedTitle.test(item.title || '')) {
    presented.presentationTitle = fallbackTitle(item);
    try {
      const official = await findOfficialLegislation(item, fetchImpl);
      if (official) {
        presented.presentationTitle = officialTitle(official.ementa) || official.ementa;
        presented.verifiedSummary = official.ementa;
        presented.displayUrl = official.url;
        presented.officialLegislation = true;
      }
    } catch (error) {
      console.warn(`[título] Fonte oficial indisponível; título editorial usado: ${error.message}`);
    }
  }
  presented.displayUrl = await shortenLongUrl(presented.displayUrl || item.url, cache, fetchImpl, 50);
  return presented;
}
