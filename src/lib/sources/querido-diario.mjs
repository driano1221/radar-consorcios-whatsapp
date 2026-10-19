import { fetchWithRetry } from '../http.mjs';
import { normalizeWhitespace } from '../text.mjs';

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function queryGroups(config) {
  if (config.queryGroups?.length) return config.queryGroups;
  return config.queryTerms?.length ? [config.queryTerms] : [];
}

async function fetchGroup(terms, config, since, fetchImpl, timeoutMs = config.timeoutMs || 15000, retries = config.retries ?? 1) {
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
    timeoutMs,
    retries,
    headers: { 'user-agent': 'RadarConsorciosIPEA/0.2 (+pesquisa acadêmica)' },
  });
  if (!response.ok) {
    const message = (await response.text()).slice(0, 200);
    const error = new Error(`Querido Diário respondeu ${response.status}`);
    error.serviceUnavailable = response.status === 503 && /no available server|service unavailable/i.test(message);
    throw error;
  }
  const payload = await response.json();
  if (!Array.isArray(payload.gazettes)) throw new Error('Querido Diário: formato inesperado (gazettes ausente)');
  return { gazettes: payload.gazettes, truncated: payload.gazettes.length >= (config.pageSize || 100) };
}

function timedOut(error) {
  return /timeout|timed? out|abort/i.test(`${error?.name || ''} ${error?.message || ''}`);
}

async function fetchGroupWithFallback(terms, config, since, fetchImpl) {
  try {
    return await fetchGroup(terms, config, since, fetchImpl);
  } catch (error) {
    // O índice às vezes demora com OR. Consultas simples recuperam parte da
    // cobertura sem transformar uma resposta incompleta em sucesso silencioso.
    if (!timedOut(error) || terms.length < 2) throw error;
    const fallbackConfig = { ...config, pageSize: Math.min(config.pageSize || 100, 50) };
    const attempts = await Promise.allSettled(terms.map((term) => fetchGroup([term], fallbackConfig, since, fetchImpl,
      config.fallbackTimeoutMs || 16000, 0)));
    const recovered = attempts.filter((result) => result.status === 'fulfilled').map((result) => result.value);
    if (!recovered.length) throw error;
    return { gazettes: mergeGazettes(recovered.map((result) => result.gazettes)),
      truncated: recovered.some((result) => result.truncated),
      partial: recovered.length < terms.length,
      fallback: true };
  }
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
  const endpoints = [...new Set([config.baseUrl || 'https://queridodiario.ok.org.br/api',
    ...(config.fallbackBaseUrls || ['https://api.queridodiario.ok.org.br'])])];
  let workingEndpoint = '', outage = '';
  const startedAt = Date.now();
  const request = async (terms) => {
    const errors = [];
    for (const baseUrl of workingEndpoint ? [workingEndpoint] : endpoints) {
      const remaining = (config.maxDurationMs || 65000) - (Date.now() - startedAt);
      if (remaining < 500) throw new Error('Querido Diário: orçamento de tempo da rodada esgotado');
      try {
        const result = await fetchGroupWithFallback(terms, { ...config, baseUrl,
          timeoutMs: Math.floor(Math.min(config.timeoutMs || 15000, Math.max(250, remaining / 4))),
          fallbackTimeoutMs: Math.floor(Math.min(config.fallbackTimeoutMs || 16000, Math.max(250, remaining / 4))) }, since, fetchImpl);
        workingEndpoint = baseUrl;
        return { ...result, endpoint: baseUrl };
      } catch (error) { errors.push({ baseUrl, error }); }
    }
    const message = errors.map(({ baseUrl, error }) => `${baseUrl}: ${error.message}${error.cause?.code ? ` (${error.cause.code})` : ''}`).join('; ');
    const error = new Error(message);
    error.serviceUnavailable = errors.length === endpoints.length && errors.every(({ error: e }) =>
      e.serviceUnavailable || /TLS|SSL|ECONNREFUSED|ENOTFOUND/i.test(e.cause?.code || e.code || ''));
    throw error;
  };
  // Consultas longas ao índice podem ficar lentas. Limitar simultaneidade
  // reduz a carga na API pública sem deixar uma falha bloquear os outros grupos.
  const settled = new Array(groups.length);
  let nextGroup = 0;
  const worker = async () => {
    while (nextGroup < groups.length) {
      const index = nextGroup++;
      if (outage) {
        settled[index] = { status: 'rejected', reason: new Error(`Consulta adiada: ${outage}`) };
        continue;
      }
      try {
        settled[index] = { status: 'fulfilled', value: await request(groups[index]) };
      } catch (reason) {
        settled[index] = { status: 'rejected', reason };
        if (reason.serviceUnavailable && !workingEndpoint) outage = reason.message;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(Math.max(1, config.maxConcurrent || 2), groups.length) }, worker));
  const results = [];
  let successfulGroups = 0;
  const diagnostics = [];
  settled.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successfulGroups += 1;
      results.push(result.value.gazettes);
      diagnostics.push({ name: `Querido Diário — consulta ${index + 1}`, status: result.value.truncated || result.value.partial ? 'degraded' : 'ok',
        itemCount: result.value.gazettes.length,
        endpoint: result.value.endpoint,
        ...(result.value.truncated || result.value.partial || result.value.fallback ? {
          message: [result.value.fallback ? 'Consulta OR expirou; busca simples de recuperação usada' : '',
            result.value.partial ? 'cobertura parcial' : '',
            result.value.truncated ? 'página cheia; resultados adicionais possíveis' : ''].filter(Boolean).join('; '),
        } : {}) });
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
