import { resolveGeography } from './geography-model.mjs';
const ZONE = 'America/Sao_Paulo';
const localParts = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

function localDay(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const parts = Object.fromEntries(localParts.formatToParts(parsed).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function exactDay(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/);
  return match && !Number.isNaN(Date.parse(`${match[1]}T12:00:00Z`)) ? match[1] : '';
}

function dayNumber(day) { return day ? Date.parse(`${day}T12:00:00Z`) / 86400000 : NaN; }
function dateRange(day, days) {
  const end = dayNumber(day);
  return { start: days === Infinity ? -Infinity : end - days + 1, end };
}
function inRange(day, range) {
  const value = dayNumber(day);
  return Number.isFinite(value) && value >= range.start && value <= range.end;
}
function dateAt(dayNumberValue) { return new Date(dayNumberValue * 86400000).toISOString().slice(0, 10); }

function occurrence(row) {
  if (exactDay(row.data_fato)) return { day: exactDay(row.data_fato), basis: 'fato' };
  if (/^\d{4}-\d{2}$/.test(row.mes_fato || '')) return { month: row.mes_fato, basis: 'mês do fato' };
  if (exactDay(row.data_noticia_original)) return { day: exactDay(row.data_noticia_original), basis: 'publicação original' };
  return { day: '', basis: 'sem data segura' };
}

function groupCount(rows, getValues) {
  const counts = new Map();
  for (const row of rows) {
    for (const value of new Set(getValues(row))) {
      const label = String(value || '').trim() || 'Não informado';
      counts.set(label, (counts.get(label) || 0) + 1);
    }
  }
  return [...counts].map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pt-BR'));
}

function consortiumFirstSeen(data) {
  const first = new Map();
  for (const item of data.items || []) {
    const day = localDay(item.firstSeenAt);
    for (const link of item.links || []) {
      if (day && (!first.has(link.consortiumId) || day < first.get(link.consortiumId))) first.set(link.consortiumId, day);
    }
  }
  return first;
}

function timeline(rows, { period, mode, today, range }) {
  const monthly = period === 'all';
  const dated = rows.map((row) => mode === 'discovery'
    ? { day: localDay(row.primeira_coleta) } : occurrence(row));
  const known = dated.map((entry) => entry.month || entry.day).filter(Boolean);
  const first = monthly ? (known.sort()[0] || today.slice(0, 7)) : dateAt(range.start);
  const keys = [];
  if (monthly) {
    let [year, month] = first.split('-').map(Number);
    const end = today.slice(0, 7);
    while (`${year}-${String(month).padStart(2, '0')}` <= end && keys.length < 240) {
      keys.push(`${year}-${String(month).padStart(2, '0')}`);
      month += 1;
      if (month === 13) { year += 1; month = 1; }
    }
  } else {
    for (let day = range.start; day <= range.end; day += 1) keys.push(dateAt(day));
  }
  const counts = new Map(keys.map((key) => [key, 0]));
  let undated = 0;
  for (const entry of dated) {
    const key = monthly ? (entry.month || entry.day?.slice(0, 7)) : entry.day;
    if (!key || !counts.has(key)) { undated += 1; continue; }
    counts.set(key, counts.get(key) + 1);
  }
  return { buckets: keys.map((key) => ({ key, count: counts.get(key) })), undated, monthly };
}

export function buildResults(data, { period = 'all', mode = 'discovery' } = {}) {
  if (!['all', '30d', '7d'].includes(period)) throw new Error('Período inválido');
  if (!['discovery', 'occurrence'].includes(mode)) throw new Error('Linha do tempo inválida');
  const today = localDay(data.lastCollectionAt || data.generatedAt);
  const range = dateRange(today, period === '7d' ? 7 : period === '30d' ? 30 : Infinity);
  const events = data.baseTables?.find((table) => table.id === 'eventos')?.rows || [];
  const confirmed = events.filter((row) => row.decisao_base === 'confirmado');
  const selected = confirmed.filter((row) => {
    if (period === 'all') return true;
    if (mode === 'discovery') return inRange(localDay(row.primeira_coleta), range);
    const when = occurrence(row);
    return inRange(when.day, range);
  });
  const missingOccurrenceDate = confirmed.filter((row) => {
    if (period !== 'all' && !inRange(localDay(row.primeira_coleta), range)) return false;
    const when = occurrence(row);
    return !when.day && (period !== 'all' || !when.month);
  }).length;
  const firstSeen = consortiumFirstSeen(data);
  const consortia = (data.consortia || []).filter((row) => period === 'all' || inRange(firstSeen.get(row.id), range));
  const cnpj = consortia.filter((row) => /^\d{14}$/.test(String(row.cnpj || '').replace(/\D/g, '')));
  const participationRows = data.baseTables?.find((table) => table.id === 'participacoes')?.rows || [];
  const itemById = new Map((data.items || []).map((item) => [item.id, item]));
  const participations = participationRows.filter((row) => period === 'all'
    || inRange(localDay(itemById.get(row.documento_id)?.firstSeenAt), range));
  const municipalityCount = new Set(participations.map((row) => row.municipio).filter(Boolean)).size;
  const consortiumNames = new Map((data.consortia || []).map((row) => [row.id, row.alias || row.name]));
  const timelineData = timeline(selected, { period, mode, today, range });
  return {
    today, period, mode, confirmedCount: selected.length, consortiaCount: consortia.length,
    cnpjCount: cnpj.length, municipalityCount, missingOccurrenceDate,
    ...timelineData,
    breakdowns: {
      categories: groupCount(selected, (row) => [row.tipo_evento]),
      states: groupCount(selected, (row) => {
        const geography = resolveGeography(row, itemById.get(row.id) || {}, data.geographyReviews?.[row.id]);
        return geography.ufs.length ? geography.ufs : ['Não identificado'];
      }),
      sources: groupCount(selected, (row) => [row.fonte || itemById.get(row.id)?.source]),
      consortia: groupCount(selected, (row) => {
        const linked = (itemById.get(row.id)?.links || []).map((link) => consortiumNames.get(link.consortiumId) || link.name).filter(Boolean);
        return linked.length ? linked : [itemById.get(row.id)?.editorialReview?.facts?.consorcio || row.consorcio || 'Não identificado'];
      }),
    },
  };
}
