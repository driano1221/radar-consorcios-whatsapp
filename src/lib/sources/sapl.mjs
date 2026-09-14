import { fetchWithRetry } from '../http.mjs';
import { normalizeWhitespace } from '../text.mjs';

export function parseSaplNorm(row, site, since, now = new Date()) {
  const date = row.data_publicacao || row.data;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return null;
  const publishedAt = `${date}T12:00:00-03:00`;
  if (new Date(publishedAt) < since || new Date(publishedAt) > now || !row.id || !row.ementa) return null;
  return { kind: 'legislation', title: `${normalizeWhitespace(row.__str__ || `Norma ${row.numero}/${row.ano}`)} — ${site.municipality}`,
    url: new URL(`/norma/${row.id}`, site.url).href, source: site.name, sourceUrl: site.url,
    publishedAt, actDate: row.data, dateBasis: row.data_publicacao ? 'publication' : 'act',
    summary: normalizeWhitespace(row.ementa), rawText: normalizeWhitespace(row.ementa),
    territoryName: site.municipality, stateCode: site.stateCode, previewOnly: site.publish !== true };
}

export async function fetchSapl(config, since, fetchImpl = fetch) {
  if (!config?.enabled) return { items: [], diagnostics: [], ok: true };
  const sites = config.sites.filter((s) => s.enabled !== false);
  const results = await Promise.allSettled(sites.map(async (site) => {
    const items = [];
    let truncated = false;
    // Janela maior por data do ato; filtragem final usa a publicação quando disponível.
    const lower = new Date(since.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    for (let page = 1; page <= (config.maxPages || 3); page += 1) {
      const params = new URLSearchParams({ data__gte: lower, ementa__icontains: 'cons', page_size: '100', page: String(page) });
      const response = await fetchWithRetry(new URL(`/api/norma/normajuridica/?${params}`, site.url), {
        fetchImpl, timeoutMs: config.timeoutMs || 12000, retries: 0,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.results)) throw new Error('SAPL: results ausente');
      items.push(...data.results.map((row) => parseSaplNorm(row, site, since)).filter(Boolean));
      const next = data.pagination?.next_page || data.next || data.pagination?.links?.next;
      if (!next) { truncated = false; break; }
      truncated = true;
    }
    return { items, truncated };
  }));
  const items = [];
  const diagnostics = results.map((r, index) => {
    if (r.status === 'fulfilled') {
      items.push(...r.value.items);
      return { name: sites[index].name, status: r.value.truncated ? 'degraded' : 'ok', itemCount: r.value.items.length,
        ...(r.value.truncated ? { message: 'Limite de paginação atingido; cobertura parcial' } : {}) };
    }
    return { name: sites[index].name, status: 'error', itemCount: 0, message: r.reason.message };
  });
  return { items, diagnostics, ok: diagnostics.some((d) => d.status !== 'error'), degraded: diagnostics.some((d) => d.status !== 'ok') };
}
