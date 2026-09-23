import { load } from 'cheerio';
import { normalizeForMatch, normalizeWhitespace } from './text.mjs';

const clippedTitle = /(?:\.\.\.|…)(?:\s+-\s+[^-]+)?\s*$/;
const newShortLink = /^https:\/\/spoo\.me\/[A-Za-z0-9_-]+$/;

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
  // Older CleanURI/is.gd entries are deliberately ignored after the provider change.
  if (newShortLink.test(cache[target] || '')) return cache[target];
  try {
    const response = await fetchImpl('https://spoo.me/api/v1/shorten', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ long_url: target }), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const { short_url: short, long_url: destination } = await response.json();
    if (!newShortLink.test(short || '') || destination !== target) throw new Error('Resposta inesperada');
    const check = await fetchImpl(short, {
      method: 'HEAD', redirect: 'manual', signal: AbortSignal.timeout(8000),
    });
    if (![301, 302, 303, 307, 308].includes(check.status) || check.headers.get('location') !== target) {
      throw new Error('Redirecionamento divergente');
    }
    cache[target] = short;
    return short;
  } catch (error) {
    console.warn(`[link] Spoo.me indisponível ou redirecionamento inválido; endereço original mantido (${error.message}).`);
    return target;
  }
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
  const target = /^(?:https:\/\/cleanuri\.com\/|https:\/\/is\.gd\/)/.test(presented.displayUrl || '')
    ? item.url : presented.displayUrl || item.url;
  presented.displayUrl = await shortenLongUrl(target, cache, fetchImpl, 100);
  return presented;
}
