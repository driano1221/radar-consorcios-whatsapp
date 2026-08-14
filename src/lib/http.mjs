const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function retryDelay(response, attempt) {
  const retryAfter = Number.parseInt(response?.headers?.get('retry-after') || '', 10);
  if (Number.isFinite(retryAfter)) return Math.min(retryAfter * 1000, 5000);
  return Math.min(500 * 2 ** attempt, 3000);
}

export async function fetchWithRetry(
  url,
  { fetchImpl = fetch, timeoutMs = 12000, retries = 1, ...options } = {},
) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        ...options,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!RETRYABLE_STATUS.has(response.status) || attempt === retries) return response;
      await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
    } catch (error) {
      lastError = error;
      if (attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelay(null, attempt)));
    }
  }
  throw lastError || new Error(`Falha ao acessar ${url}`);
}
