import { fetchWithRetry } from '../http.mjs';
import { normalizeWhitespace } from '../text.mjs';

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function queryGroups(config) {
  if (config.queryGroups?.length) return config.queryGroups;
  return config.queryTerms?.length ? [config.queryTerms] : [];
}

async function fetchGroup(terms, config, since, fetchImpl) {
  const querystring = terms.map((term) => `"${term}"`).join(' | ');
  const params = new URLSearchParams({
    querystring,
    published_since: isoDate(since),
    excerpt_size: String(config.excerptSize || 900),
    number_of_excerpts: String(config.numberOfExcerpts || 3),
    size: String(config.pageSize || 100),
    sort_by: 'descending_date',
  });
  const url = `https://api.queridodiario.ok.org.br/gazettes?${params}`;
  const response = await fetchWithRetry(url, {
    fetchImpl,
    timeoutMs: config.timeoutMs || 15000,
    retries: config.retries ?? 1,
    headers: { 'user-agent': 'RadarConsorciosIPEA/0.2 (+pesquisa acadêmica)' },
  });
  if (!response.ok) throw new Error(`Querido Diário respondeu ${response.status}`);
  const payload = await response.json();
  return payload.gazettes || [];
}

function mergeGazettes(groups) {
  const merged = new Map();
  for (const gazette of groups.flat()) {
    const key = `${gazette.url}|${gazette.territory_id}|${gazette.date}`;
    const excerpts = (gazette.excerpts || []).map(normalizeWhitespace).filter(Boolean);
    const current = merged.get(key);
    if (!current) merged.set(key, { ...gazette, excerpts: [...new Set(excerpts)] });
    else current.excerpts = [...new Set([...current.excerpts, ...excerpts])];
  }
  return [...merged.values()];
}

export async function fetchQueridoDiario(config, since, fetchImpl = fetch) {
  if (!config.enabled) return [];
  const groups = queryGroups(config);
  const settled = await Promise.allSettled(
    groups.map((terms) => fetchGroup(terms, config, since, fetchImpl)),
  );
  const results = [];
  let successfulGroups = 0;
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successfulGroups += 1;
      results.push(result.value);
    } else {
      console.warn(`[fonte:querido-diario:${index + 1}] ${result.reason.message}`);
    }
  });
  if (!successfulGroups) throw new Error('Todas as consultas ao Querido Diário falharam.');

  return mergeGazettes(results).map((gazette) => {
    const excerpts = (gazette.excerpts || []).map(normalizeWhitespace).filter(Boolean);
    return {
      kind: 'gazette',
      title: `Diário Oficial de ${gazette.territory_name} (${gazette.state_code})`,
      url: gazette.url,
      publishedAt: `${gazette.date}T12:00:00-03:00`,
      source: 'Querido Diário',
      summary: excerpts.join(' '),
      rawText: excerpts.join(' '),
      territoryId: gazette.territory_id,
      territoryName: gazette.territory_name,
      stateCode: gazette.state_code,
      edition: gazette.edition,
    };
  });
}

export { mergeGazettes };
