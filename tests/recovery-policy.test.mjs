import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryDue, recoveryDelayMs, recoveryAttempt, attachRecoveredText } from '../src/lib/recovery-policy.mjs';
import { fetchWithRetry } from '../src/lib/http.mjs';
import { enrichArticle, isChallengePage } from '../src/lib/article-enrichment.mjs';
const now = '2026-10-16T16:00:00.000Z';

test('Semana 7: JS passivo de segurança no rodapé não apaga uma notícia acessível', async () => {
  const text = 'O CISGA viabilizou procedimentos oftalmológicos para 100 pacientes. '.repeat(15);
  const html = `<html><title>Consórcio de Saúde | Semana 7</title><body><article>${text}</article>` +
    `<script>var a=document.createElement('script');a.src='/cdn-cgi/challenge-platform/scripts/jsd/main.js';</script></body></html>`;
  assert.equal(isChallengePage(html), false);
  const item = await enrichArticle({ title: 'Consórcio de Saúde', url: 'https://example.org/a' }, {
    fetchImpl: async () => new Response(html, { headers: { 'content-type': 'text/html' } }),
    readability: () => text, trafilatura: async () => text,
  });
  assert.equal(item.contentProvenance, 'pagina_original');
});

test('tela real de desafio e página quase vazia continuam bloqueadas', () => {
  assert.equal(isChallengePage('<title>Just a moment...</title><body>' + 'Aguarde '.repeat(100) + '</body>'), true);
  assert.equal(isChallengePage('<title>Portal</title><body><form id="challenge-form">Verifique seu navegador</form></body>'), true);
  assert.equal(isChallengePage('<title>Portal</title><body>Verificando<script src="/cdn-cgi/challenge-platform/a.js"></script></body>'), true);
});

test('recuperação não abandona após três falhas; espera até sete dias e volta à fila', () => {
  assert.equal(recoveryDelayMs(1), 12 * 3600000);
  assert.equal(recoveryDelayMs(99), 168 * 3600000);
  const row = { article_attempted_at: '2026-10-01T00:00:00Z', article_attempts: 50 };
  assert.equal(recoveryDue(row, { now: Date.parse(now) }), true);
  assert.equal(recoveryDue({ ...row, article_next_attempt_at: '2026-10-20T00:00:00Z' }, { now: Date.parse(now) }), false);
});

test('documento revisado/enviado pode receber corpo sem mudar ID, prova, decisão ou envio', () => {
  const row = { id: 'abc', trecho: 'Prova lacrada', etapa: 'etapa revisada',
    tipo_evento: 'GERAL', situacao_analise: 'duplicata', enviado_em: '2026-10-01', decisao_alerta: 'historico' };
  assert.equal(recoveryDue(row), true);
  const result = attachRecoveredText(recoveryAttempt(row, { now }), {
    url_artigo: 'https://example.org/a', texto_sha256: 'hash', leitor: 'readability',
  });
  for (const key of Object.keys(row)) assert.deepEqual(result[key], row[key]);
  assert.equal(result.article_recovery_status, 'recuperado');
  assert.equal(result.article_next_attempt_at, '');
});

test('falha agenda recuperação futura e preserva endereço resolvido e decisão', () => {
  const result = recoveryAttempt({ id: 'id', tipo_evento: 'PROTOCOLO' }, {
    now, reason: 'http_403', resolvedUrl: 'https://example.org/lei',
  });
  assert.equal(result.article_next_attempt_at, '2026-10-17T04:00:00.000Z');
  assert.equal(result.article_resolved_url, 'https://example.org/lei');
  assert.equal(result.tipo_evento, 'PROTOCOLO');
  assert.equal(recoveryDue(result, { now: Date.parse(now) }), false);
});

test('destino PDF não é retentado como HTML e forçar exige escolha externa explícita', () => {
  assert.equal(recoveryDue({ article_recovery_reason: 'destino_pdf' }), false);
  assert.equal(recoveryDue({ article_recovery_reason: 'destino_pdf' }, { force: true }), true);
});

test('Retry-After longo não é encurtado nem provoca nova requisição precoce', async () => {
  let calls = 0;
  const response = await fetchWithRetry('https://example.org', { fetchImpl: async () => {
    calls++; return new Response('', { status: 429, headers: { 'retry-after': '120' } });
  } });
  assert.equal(response.status, 429); assert.equal(calls, 1);
});

test('Retry-After em data é respeitado sem bloquear a rodada por minutos', async () => {
  let calls = 0;
  await fetchWithRetry('https://example.org', { fetchImpl: async () => {
    calls++; return new Response('', { status: 503, headers: { 'retry-after': new Date(Date.now() + 600000).toUTCString() } });
  } });
  assert.equal(calls, 1);
});

test('artigo repete erro transitório uma vez e mantém a URL original', async () => {
  let calls = 0;
  const body = 'O consórcio realizou atendimento especializado aos municípios participantes. '.repeat(10);
  const item = { title: 'Consórcio presta atendimento', url: 'https://example.org/a' };
  const result = await enrichArticle(item, { fetchImpl: async () => {
    if (++calls === 1) throw new Error('ECONNRESET');
    return new Response('<article>Corpo</article>', { headers: { 'content-type': 'text/html' } });
  }, readability: () => body, trafilatura: async () => body });
  assert.equal(calls, 2); assert.equal(result.rawText, body.trim()); assert.equal(result.url, item.url);
});

test('403 não é repetido nem contornado e URL resolvida é registrada', async () => {
  let calls = 0; let resolved = '';
  const item = { title: 'Consórcio', url: 'https://news.google.com/rss/articles/x' };
  const result = await enrichArticle(item, {
    decode: async () => ({ status: true, decoded_url: 'https://example.org/lei' }),
    onResolved: (_, url) => { resolved = url; },
    fetchImpl: async () => { calls++; return new Response('', { status: 403 }); },
  });
  assert.equal(result, item); assert.equal(calls, 1); assert.equal(resolved, 'https://example.org/lei');
});
