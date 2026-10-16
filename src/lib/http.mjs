const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function retryDelay(response, attempt) {
  const raw = response?.headers?.get('retry-after') || '';
  if (/^\d+$/.test(raw)) return Number(raw) * 1000;
  const date = raw ? Date.parse(raw) : NaN;
  if (Number.isFinite(date)) return Math.max(0, date - Date.now());
  return Math.min(500 * 2 ** attempt, 3000);
}

export async function fetchWithRetry(
  url,
  { fetchImpl = fetch, timeoutMs = 12000, retries = 1, maxRetryWaitMs = 5000, ...options } = {},
) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        ...options,
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!RETRYABLE_STATUS.has(response.status) || attempt === retries) return response;
      const wait = retryDelay(response, attempt);
      // Defer to a later run instead of retrying earlier than the server allows.
      if (wait > maxRetryWaitMs) return response;
      await new Promise((resolve) => setTimeout(resolve, wait));
    } catch (error) {
      lastError = error;
      if (attempt === retries) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelay(null, attempt)));
    }
  }
  throw lastError || new Error(`Falha ao acessar ${url}`);
}
