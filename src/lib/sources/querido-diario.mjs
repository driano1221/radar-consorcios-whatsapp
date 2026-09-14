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
  const url = `${config.baseUrl || 'https://queridodiario.ok.org.br/api'}/gazettes?${params}`;
  const response = await fetchWithRetry(url, {
    fetchImpl,
    timeoutMs: config.timeoutMs || 15000,
    retries: config.retries ?? 1,
    headers: { 'user-agent': 'RadarConsorciosIPEA/0.2 (+pesquisa acadêmica)' },
  });
  if (!response.ok) throw new Error(`Querido Diário respondeu ${response.status}`);
  const payload = await response.json();
  if (!Array.isArray(payload.gazettes)) throw new Error('Querido Diário: formato inesperado (gazettes ausente)');
  return { gazettes: payload.gazettes, truncated: payload.gazettes.length >= (config.pageSize || 100) };
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
  const diagnostics = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successfulGroups += 1;
      results.push(result.value.gazettes);
      diagnostics.push({ name: `Querido Diário — consulta ${index + 1}`, status: result.value.truncated ? 'degraded' : 'ok',
        itemCount: result.value.gazettes.length,
        ...(result.value.truncated ? { message: 'Página cheia; pode haver resultados adicionais fora do limite' } : {}) });
    } else {
      console.warn(`[fonte:querido-diario:${index + 1}] ${result.reason.message}`);
      diagnostics.push({ name: `Querido Diário — consulta ${index + 1}`, status: 'error', itemCount: 0, message: result.reason.message });
    }
  });
  const items = mergeGazettes(results).map((gazette) => {
    const excerpts = (gazette.excerpts || []).map(normalizeWhitespace).filter(Boolean);
    return {
      kind: 'gazette',
      title: `Diário Oficial de ${gazette.territory_name} (${gazette.state_code})`,
      url: gazette.url,
      publishedAt: `${gazette.date}T12:00:00-03:00`,
      source: 'Querido Diário',
      summary: excerpts.join(' '),
      rawText: excerpts.join(' '),
      excerpts,
      territoryId: gazette.territory_id,
      territoryName: gazette.territory_name,
      stateCode: gazette.state_code,
      edition: gazette.edition,
    };
  });
  return { items, diagnostics, ok: successfulGroups > 0, degraded: diagnostics.some((d) => d.status !== 'ok') };
}

export { mergeGazettes };
