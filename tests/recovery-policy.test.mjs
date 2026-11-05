import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryDue, recoveryDelayMs, recoveryAttempt, attachRecoveredText, isRecoveryLead,pdfRecoveryDue,
  checkpointRecoveryFailure,restoreRecoveryFailures } from '../src/lib/recovery-policy.mjs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {loadState,saveState} from '../src/lib/dedupe.mjs';
import { fetchWithRetry } from '../src/lib/http.mjs';
import { enrichArticle, enrichArticles, isChallengePage } from '../src/lib/article-enrichment.mjs';
import { redactPublicText } from '../src/lib/article-text-store.mjs';
const now = '2026-10-16T16:00:00.000Z';

test('falha real sobrevive à rejeição do catálogo sem mexer em fila, decisões ou recibos e sem duplicar tentativa',async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'radar-recovery-checkpoint-'));
  t.after(()=>rm(directory,{recursive:true,force:true}));
  const state={version:4,pending:{a:{status:'approved'}},seen:{b:{sentAt:now}},weekly:{c:{sentAt:now}},decisions:{a:{status:'descartado'}}};
  const before=JSON.stringify(state),row={id:'documento',url:'https://fonte.gov.br/noticia',article_attempts:1,
    article_attempted_at:now,decisao_base:'processando',triagem_automatica:{version:4,status:'processando'}};
  const failure=recoveryAttempt(row,{now:'2026-11-01T21:12:43.546Z',reason:'http_403',resolvedUrl:row.url});
  assert.equal(checkpointRecoveryFailure(state,failure,{runId:'fixture-run'}),true);
  assert.equal(checkpointRecoveryFailure(state,failure),false);
  assert.equal(checkpointRecoveryFailure(state,recoveryAttempt(row,{now:'2026-11-02T01:00:00Z'})),false,'Não declarar texto recuperado sem preservar o corpo');
  const file=path.join(directory,'state.json');await saveState(file,state);
  const restored=await loadState(file),records=new Map([[row.id,row]]);
  restoreRecoveryFailures(records,restored);restoreRecoveryFailures(records,restored);
  assert.equal(records.get(row.id).article_attempts,2);
  assert.equal(records.get(row.id).article_next_attempt_at,'2026-11-02T01:12:43.546Z');
  assert.equal(records.get(row.id).decisao_base,'processando');
  assert.equal(recoveryDue(records.get(row.id),{now:Date.parse('2026-11-01T23:00:00Z')}),false);
  const {recoveryFailures,...other}=JSON.parse(await readFile(file,'utf8'));
  assert.equal(JSON.stringify(other),before);
  const newer={...records.get(row.id),article_attempted_at:'2026-11-02T03:00:00Z',article_recovery_reason:'',article_text_sha256:'valid-text'};
  records.set(row.id,newer);restoreRecoveryFailures(records,restored);assert.deepEqual(records.get(row.id),newer);
});

test('PDF pendente e endpoint sem extensão chegam ao leitor PDF; escolha explícita não inclui outras fontes',()=>{
  const row={id:'salto',url:'https://data.queridodiario.ok.org.br/salto/edicao.pdf',triagem_automatica:{status:'processando'}};
  assert.equal(pdfRecoveryDue(row),true);
  assert.equal(pdfRecoveryDue(row,{requestedIds:['outro']}),false);
  assert.equal(pdfRecoveryDue(row,{requestedIds:['salto'],hasText:true}),false);
  assert.equal(pdfRecoveryDue(row,{requestedIds:['salto'],reviewed:true}),false);
  const chamber={id:'camara',url:'https://www.camara.leg.br/mostrarintegra?codteor=123',article_recovery_reason:'destino_nao_html'};
  assert.equal(pdfRecoveryDue(chamber,{requestedIds:['camara']}),true);
  assert.equal(pdfRecoveryDue({...chamber,article_recovery_reason:'destino_pdf'}),true,'PDF comprovado sem extensão entra automaticamente, sem escolha manual');
  assert.equal(pdfRecoveryDue({...chamber,article_recovery_reason:'http_403'},{requestedIds:['camara']}),false);
  const previous={tentado_em:now,tentativas:4,situacao:'falha: http_403'};
  assert.equal(pdfRecoveryDue(row,{previous,retryFailed:true,now:Date.parse(now)+1000}),false);
  assert.equal(pdfRecoveryDue(row,{previous,retryFailed:true,now:Date.parse(now)+24*3600000}),true);
});

test('orçamento esgotado não marca itens não tentados como falha ou sucesso', async () => {
  let calls = 0;
  const items = [{ title: 'Consórcio', url: 'https://example.org/a' }];
  const result = await enrichArticles(items, { maxDurationMs: 0,
    onAttempt: () => { calls++; }, fetchImpl: async () => { throw new Error('não deveria executar'); } });
  assert.equal(calls, 0); assert.equal(result.attempted, 0);
  assert.equal(result.enriched, 0); assert.equal(result.failed, 0);
  assert.deepEqual(result.items, items);
});

test('CPF quebrado em linha no PDF é omitido, sem apagar CNPJ institucional', () => {
  assert.equal(redactPublicText('123. 456.789-\n00 / 12.345.678/0001-90'), '[CPF omitido] / 12.345.678/0001-90');
});

test('lei já tentada não desaparece da fila porque o título não contém consórcio', () => {
  assert.equal(isRecoveryLead({ titulo: 'Lei Nº 3.108, de 6 de dezembro de 2022', article_attempts: 3 }), true);
  assert.equal(isRecoveryLead({ titulo: 'Notícia genérica sem relação' }), false);
});

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
