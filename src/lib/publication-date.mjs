import * as cheerio from 'cheerio';

function validDate(value, now = new Date()) {
  if (!value || typeof value !== 'string') return '';
  const raw = value.trim();
  const brazilian = /^(\d{1,2})\/(\d{1,2})\/(20\d{2})(?:\s+\d{1,2}:\d{2})?$/.exec(raw);
  const parsed = brazilian
    ? new Date(Date.UTC(Number(brazilian[3]), Number(brazilian[2]) - 1, Number(brazilian[1])))
    : new Date(raw);
  if (Number.isNaN(parsed.getTime()) || parsed.getUTCFullYear() < 2000 ||
    parsed.getTime() > now.getTime() + 86400000) return '';
  if (brazilian && (parsed.getUTCDate() !== Number(brazilian[1]) ||
    parsed.getUTCMonth() !== Number(brazilian[2]) - 1)) return '';
  return parsed.toISOString();
}

function jsonLdDates(value) {
  if (Array.isArray(value)) return value.flatMap(jsonLdDates);
  if (!value || typeof value !== 'object') return [];
  const types = [value['@type']].flat().map(String);
  const own = types.some((type) => /(?:NewsArticle|Article|BlogPosting|ReportageNewsArticle)$/i.test(type))
    ? [value.datePublished] : [];
  return [...own, ...jsonLdDates(value['@graph'])];
}

// O RSS informa quando o Google exibiu o item; estes campos vêm da página
// original e não usam dateModified, que pode ser atualizado sem fato novo.
export function sourcePublicationDate(html, now = new Date()) {
  const $ = cheerio.load(html);
  const metadata = [
    'meta[property="article:published_time"]',
    'meta[name="article:published_time"]',
    'meta[itemprop="datePublished"]',
    'meta[name="datePublished"]',
    'meta[name="pubdate"]',
  ];
  for (const selector of metadata) {
    const date = validDate($(selector).first().attr('content'), now);
    if (date) return { date, source: selector };
  }
  for (const node of $('script[type="application/ld+json"]').toArray()) {
    try {
      const parsed = JSON.parse($(node).html() || '');
      for (const candidate of jsonLdDates(parsed)) {
        const date = validDate(candidate, now);
        if (date) return { date, source: 'jsonld.datePublished' };
      }
    } catch { /* JSON-LD de terceiros pode estar inválido. */ }
  }
  const articleTime = $('article time[datetime], [itemprop="articleBody"] time[datetime]').first().attr('datetime');
  const date = validDate(articleTime, now);
  return date ? { date, source: 'article.time' } : null;
}

const MONTHS = new Map(Object.entries({ janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5,
  junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12 }));

// Apenas títulos de atos formais: datas soltas no corpo de uma notícia podem
// ser contexto histórico e não a data do acontecimento principal.
export function formalActDate(item, now = new Date()) {
  const title = String(item.title || item.titulo || '').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (!/^(?:\d{1,2}\/\d{1,2}\/20\d{2}\s*[-–]\s*)?(?:lei|resolucao|decreto|portaria|contrato(?: de rateio)?|instrucao normativa)\b/.test(title)) return '';
  const named = /\b(?:de|em)\s+(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(20\d{2})\b/.exec(title);
  if (named) {
    const month = MONTHS.get(named[2]);
    if (month) return validDate(`${named[1]}/${month}/${named[3]}`, now);
  }
  const numeric = /\b(\d{1,2})\/(\d{1,2})\/(20\d{2})\b/.exec(title);
  return numeric ? validDate(`${numeric[1]}/${numeric[2]}/${numeric[3]}`, now) : '';
}

export function eventMonthEnd(value) {
  const match = /^(20\d{2})-(0[1-9]|1[0-2])$/.exec(String(value || ''));
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]), 0, 23, 59, 59)).toISOString() : '';
}

export { validDate };
