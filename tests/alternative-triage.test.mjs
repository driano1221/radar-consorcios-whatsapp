import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { sha, originalFingerprint, originalContext, alternativeInput, eligibleAlternativeOriginal,
  validateAlternativeAnswer, validAlternativeDecision, applyAlternativeGuard, readAlternativeRows,
  reviewAlternative, alternativeUrlKey } from '../src/lib/alternative-triage.mjs';
import { decideWithAlternatives, triageAlternativeTexts } from '../scripts/triage-alternative-texts.mjs';
import { saveCatalog, mergeStateIntoCatalog } from '../src/lib/catalog.mjs';
import { isNotifiable } from '../src/lib/publication-gate.mjs';
import { loadEditorialGuard, applyEditorialGuard } from '../src/lib/editorial-guard.mjs';
import { buildDashboardData, buildPublicDashboardData } from '../scripts/build-dashboard.mjs';
import { recoveredSourcesView } from '../dashboard/src/recovery-view.mjs';
import { JSDOM } from 'jsdom';
import { compareAlternative } from '../src/lib/alternative-match.mjs';

const originals = await readAlternativeRows('data/catalogo', 'arquivo-coletas.ndjson');
// Freeze this fixture to CISGA's two sources; unrelated recovered records are not
// extra evidence for this episode and must not change the test's source count.
const saved = (await readAlternativeRows('data/catalogo', 'fontes-alternativas.ndjson'))
  .filter(s => s.documento_id === '0783e43a286fe81821ff9ad5e33526f40fbe35e930c9b89eb251277777fb2b64');
assert.equal(saved.length, 2);
const historical = originals.find(r => r.id === saved[0].documento_id);
const row = { ...historical, id: 'fixture-original', primeira_coleta: '2026-10-16T18:00:00Z', enviado_em: '' };
const sources = saved.map((s, i) => ({ ...s, id: `fixture-source-${i}`, documento_id: row.id }));
const source = sources[0];
const answerFor = (r, s, accepted = true) => ({ mesmo_episodio: true,
  evidencia_original: r.titulo, evidencia_correspondencia: s.texto.slice(0, 180),
  evidencia_decisao: s.texto.slice(0, 240), motivo_correspondencia: 'Mesmo consórcio, procedimento e 100 pacientes do Araguaia.',
  relevante: accepted, categoria: accepted ? alternativeInput(r, s).rule.category : 'IRRELEVANTE',
  justificativa: accepted ? 'O consórcio viabilizou atendimento oftalmológico efetivamente realizado.' : 'A publicação descreve apenas um contrato rotineiro com fornecedor.' });
const mockReview = async input => ({ model: 'mock', answer: answerFor(row, sources.find(s => s.url_fonte === input.alternativa.url)), usage: { prompt_tokens: 100, completion_tokens: 50 } });
const now = new Date('2026-10-16T18:10:00Z');
async function fixture(t, rows = [row], alternatives = [source], reviews = []) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'radar-alt-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  for (const [name, values] of [['arquivo-coletas', rows], ['fontes-alternativas', alternatives], ['revisoes-eventos', reviews]])
    await writeFile(path.join(directory, `${name}.ndjson`), values.map(JSON.stringify).join('\n') + '\n');
  return directory;
}

test('somente registros novos, nunca enviados nem revisados, entram na integração', () => {
  assert.equal(eligibleAlternativeOriginal(row), true);
  for (const r of [historical, { ...row, primeira_coleta: '' }, { ...row, enviado_em: '2026-10-16' }, { ...row, documento_pai_id: 'parent' }])
    assert.equal(eligibleAlternativeOriginal(r), false);
  assert.equal(eligibleAlternativeOriginal(row, new Set([row.id])), false);
});
test('duas fontes reais concordantes aceitam atuação sem alterar original', async () => {
  const before = structuredClone(row);
  const d = await decideWithAlternatives(row, sources, { review: mockReview });
  assert.equal(d.status, 'aceito'); assert.equal(d.category, 'ATUAÇÃO'); assert.equal(d.calls, 2);
  assert.equal(validAlternativeDecision(row, d, sources), true); assert.deepEqual(row, before);
});
test('entrada não trunca corpo; exige integridade, vínculo e correspondência', () => {
  assert.equal(alternativeInput(row, source).input.alternativa.texto, source.texto);
  for (const s of [{ ...source, texto: 'x' }, { ...source, documento_id: 'outro' },
    { ...source, url_fonte: 'javascript:alert(1)' }, { ...source, texto: 'a'.repeat(24001), texto_sha256: sha('a'.repeat(24001)) },
    { ...source, comparacao: { eligible: false } }, ...['numberConflict', 'dateConflict', 'statusConflict'].map(k => ({ ...source, comparacao: { eligible: true, [k]: true } }))])
    assert.ok(alternativeInput(row, s).error);
  assert.ok(alternativeInput({ ...row, data_noticia_original: '2025-01-01' }, source).error);
});
test('IA não inventa citações, correspondência nem consenso', () => {
  const rule = alternativeInput(row, source).rule, good = answerFor(row, source);
  for (const change of [{ mesmo_episodio: false }, { mesmo_episodio: 'incerto' }, { evidencia_original: 'Inventou uma frase ausente do original' },
    { evidencia_decisao: 'Inventou uma frase ausente da alternativa' }, { evidencia_correspondencia: 'não consta na fonte' },
    { relevante: false, categoria: 'IRRELEVANTE' }, { categoria: 'CRIAÇÃO' }, { justificativa: '' }])
    assert.equal(validateAlternativeAnswer(row, source, rule, { ...good, ...change }).status, 'pendente');
});
test('descarte também exige regra, IA e prova literal, não erro de acesso', async () => {
  const title = 'CISVARC publica termo de credenciamento com laboratório para exames';
  const text = 'O Consórcio Intermunicipal de Saúde CISVARC celebrou termo de credenciamento com laboratório para exames. Contrato rotineiro com fornecedor para prestação de serviços assistenciais. ' +
    'O instrumento contém cláusulas de penalidade em caso de descumprimento, sem notícia de aplicação de sanções. '.repeat(5);
  const r = { ...row, titulo: title, trecho: title };
  const s = { ...source, titulo_fonte: title, texto: text, texto_sha256: sha(text) };
  assert.equal(alternativeInput(r, s).rule.category, 'GERAL');
  const d = await decideWithAlternatives(r, [s], { review: async () => ({ answer: answerFor(r, s, false) }) });
  assert.equal(d.status, 'descartado');
  assert.equal(validAlternativeDecision(r, d, [s]), true);
  const failed = await decideWithAlternatives(r, [s], { review: async () => { throw new Error('HTTP 403'); } });
  assert.equal(failed.status, 'pendente');
});
test('uma fonte divergente impede decisão automática; não há votação', async () => {
  let i = 0;
  const d = await decideWithAlternatives(row, sources, { review: async () => ({ answer: { ...answerFor(row, sources[i]), mesmo_episodio: i++ === 0 } }) });
  assert.equal(d.status, 'pendente');
});
test('trava determinística impede IA de inventar erro de digitação em número conflitante', async () => {
  for (const count of ['900', '9000']) {
    const wrong = { ...row, titulo: row.titulo.replace('100', count), trecho: row.trecho.replace('100', count) };
    const d = await decideWithAlternatives(wrong, [source], { review: () => { throw new Error('não consultar IA com conflito conhecido'); } });
    assert.equal(d.status, 'pendente'); assert.equal(d.calls, 0);
  }
  const changed = source.texto.replaceAll('100 pacientes', '900 pacientes');
  assert.ok(alternativeInput(row, { ...source, texto: changed, texto_sha256: sha(changed) }).error);
});
test('autorização versus ingresso efetivado não é diferença de estilo do título', () => {
  const a = { titulo: 'Lei autoriza ingresso de Caratinga no Consórcio de Saúde União' };
  const b = { titulo: 'Caratinga ingressou no Consórcio de Saúde União por lei' };
  assert.equal(compareAlternative(a, b).statusConflict, true);
});
test('hash, original, data e decisão humana invalidam cache inadequado', async () => {
  const d = await decideWithAlternatives(row, [source], { review: mockReview });
  assert.equal(validAlternativeDecision({ ...row, trecho: row.trecho + ' alterado' }, d, [source]), false);
  assert.equal(validAlternativeDecision({ ...row, data_noticia_original: '2026-10-01' }, d, [source]), false);
  assert.equal(validAlternativeDecision(row, d, [{ ...source, texto: 'alterado' }]), false);
  assert.equal(validAlternativeDecision(row, { ...d, sourceId: 'other' }, [source]), false);
  assert.equal(validAlternativeDecision(row, d, [source], new Set([row.id])), false);
  assert.notEqual(originalFingerprint(row), originalFingerprint(historical));
});
test('fonte já aceita é duplicata; fonte não revisada não vira segundo fato', async () => {
  const other = { id: 'owner', titulo: source.titulo_fonte, url: source.url_fonte, decisao_base: 'confirmado' };
  const d = await decideWithAlternatives(row, [source], { review: mockReview, archive: [other] });
  assert.equal(d.status, 'duplicata'); assert.equal(d.relatedDocumentId, 'owner');
  const pending = await decideWithAlternatives(row, [source], { review: mockReview, archive: [{ ...other, decisao_base: 'candidato' }] });
  assert.equal(pending.status, 'pendente');
  assert.equal(alternativeUrlKey('https://araguaianoticia.com.br/amp/noticia/79550/abc'), alternativeUrlKey(saved[1].url_fonte));
});
test('segunda original com mesma fonte comprovada não duplica o episódio', async () => {
  const owner = await decideWithAlternatives(row, [source], { review: mockReview });
  const r = { ...row, id: 'second' }, s = { ...source, id: 'source-second', documento_id: r.id };
  const d = await decideWithAlternatives(r, [s], { review: async () => ({ answer: answerFor(r, s) }), priorDecisions: [owner] });
  assert.equal(d.status, 'duplicata'); assert.equal(d.relatedDocumentId, row.id);
});
test('execução aplicada é idempotente, sem reescrever arquivo nem revisão', async t => {
  const directory = await fixture(t, [row], [source, source]);
  const before = await readFile(path.join(directory, 'arquivo-coletas.ndjson'), 'utf8');
  const first = await triageAlternativeTexts({ directory, apply: true, apiKey: 'mock', now, review: mockReview });
  assert.equal(first.calls, 1); assert.equal(first.results[0].status, 'aceito');
  const second = await triageAlternativeTexts({ directory, apply: true, apiKey: 'mock', now, review: () => { throw new Error('não chamar'); } });
  assert.equal(second.calls, 0); assert.equal(second.attempted, 0);
  assert.equal(await readFile(path.join(directory, 'arquivo-coletas.ndjson'), 'utf8'), before);
});
test('limite parcial nunca conclui com uma das duas fontes; retry tem intervalo', async t => {
  const directory = await fixture(t, [row], sources);
  const a = await triageAlternativeTexts({ directory, apply: true, apiKey: 'mock', now, review: mockReview, maxCallsRun: 1 });
  assert.equal(a.calls, 1); assert.equal(a.results[0].status, 'pendente');
  const b = await triageAlternativeTexts({ directory, apiKey: 'mock', now, review: mockReview });
  assert.equal(b.calls, 0);
  const c = await triageAlternativeTexts({ directory, apiKey: 'mock', now: new Date('2026-10-17T19:00:00Z'), review: mockReview });
  assert.equal(c.results[0].status, 'aceito');
});
test('cota diária e ausência de chave não fazem chamadas nem decisões', async t => {
  const directory = await fixture(t);
  assert.equal((await triageAlternativeTexts({ directory, now, apiKey: '', review: mockReview })).calls, 0);
  assert.equal((await triageAlternativeTexts({ directory, now, apiKey: 'mock', maxCallsDay: 0, review: mockReview })).calls, 0);
});
test('versões conflitantes de uma fonte não selecionam silenciosamente a antiga', async t => {
  const newerText = source.texto + ' Atualização do texto publicado.';
  const directory = await fixture(t, [row], [source, { ...source, texto: newerText, texto_sha256: sha(newerText) }]);
  const result = await triageAlternativeTexts({ directory, now, apiKey: 'mock', review: mockReview });
  assert.equal(result.calls, 0); assert.equal(result.results[0].status, 'pendente');
  assert.match(result.results[0].reason, /Versões conflitantes/);
});
test('mudança de metadados da alternativa invalida cache e refaz verificação', async t => {
  const directory = await fixture(t);
  await triageAlternativeTexts({ directory, apply: true, apiKey: 'mock', now, review: mockReview });
  await writeFile(path.join(directory, 'fontes-alternativas.ndjson'), JSON.stringify({ ...source, data_fonte: '2025-01-01', titulo_fonte: source.titulo_fonte.replace('100', '900') }) + '\n');
  const again = await triageAlternativeTexts({ directory, now, apiKey: 'mock', review: mockReview });
  assert.equal(again.calls, 0); assert.equal(again.results[0].status, 'pendente');
});
test('histórico real é inelegível; não chamar IA nem alterar decisões antigas', async () => {
  const d = await triageAlternativeTexts({ apiKey: 'mock', now, review: () => { throw new Error('Proibido revisar históricos'); } });
  assert.equal(d.calls, 0); assert.equal(d.attempted, 0);
});
test('catálogo e guarda de envio consomem decisão sem reescrever o texto original', async t => {
  const directory = await fixture(t);
  await triageAlternativeTexts({ directory, apply: true, now, apiKey: 'mock', review: mockReview });
  await saveCatalog(directory, new Map([[row.id, row]]), { now });
  const csv = await readFile(path.join(directory, 'eventos.csv'), 'utf8');
  assert.match(csv, /confirmado/); assert.match(csv, /fonte_evidencia_triagem/); assert.ok(csv.includes(source.url_fonte));
  const archive = await readAlternativeRows(directory, 'arquivo-coletas.ndjson');
  assert.deepEqual(archive, [row]);
  const guard = await loadEditorialGuard(directory);
  const item = applyEditorialGuard({ url: row.url, classification: { category: 'ATUAÇÃO', score: 10 } }, guard);
  assert.equal(item.publicationDecision, 'historico'); assert.equal(item.catalogDecision, 'confirmado');
  assert.equal(item.editorialDecision, undefined);
  assert.equal(isNotifiable(item), false);
  const future = new Map([[row.id, row]]);
  mergeStateIntoCatalog(future, { observations: { x: { item, firstSeenAt: row.primeira_coleta, lastSeenAt: '2026-10-17T00:00:00Z' } }, pending: { x: { item } } });
  assert.equal(future.size, 1);
  assert.equal(future.get(row.id).trecho, row.trecho);
  assert.equal(future.get(row.id).tipo_evento, row.tipo_evento);
  assert.equal(originalFingerprint(future.get(row.id)), originalFingerprint(row));
});
test('painel mostra prova, motivo e URL alternativa, nunca revisão humana fictícia', async () => {
  const d = await decideWithAlternatives(row, [source], { review: mockReview });
  const local = buildDashboardData({ archive: [row], events: [], consortia: [], links: [], pendingIdentity: [], alternativeTexts: [source], alternativeDecisions: [d] });
  const item = buildPublicDashboardData(local).items[0];
  assert.equal(item.baseDecision, 'confirmado'); assert.equal(item.automaticAlternativeReview.sourceUrl, source.url_fonte);
  assert.match(item.analysis, /Triagem automática por regras e IA/);
  assert.equal(item.evidence, d.evidence); assert.equal(item.editorialReview, null);
  assert.equal(item.alternativeSources[0].decisionUse, 'automatic'); assert.equal(item.alternativeSources[0].fullText, '');
  assert.equal(item.fullText, '');
  const document = new JSDOM('<body></body>').window.document;
  document.body.append(recoveredSourcesView(item, { document, date: String }));
  assert.match(document.body.textContent, /Usada na decisão automática por regras e IA/);
  assert.match(document.body.textContent, /não é revisão humana/);
});
test('requisição manda corpo integral e trata falhas da API explicitamente', async () => {
  const input = alternativeInput(row, source).input;
  await reviewAlternative(input, { apiKey: 'mock', fetchImpl: async (url, init) => {
    const sent = JSON.parse(JSON.parse(init.body).messages[1].content);
    assert.equal(sent.alternativa.texto, source.texto);
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(answerFor(row, source)) } }] }) };
  } });
  await assert.rejects(reviewAlternative(input, { apiKey: 'mock', fetchImpl: async () => ({ ok: false, status: 429 }) }), /HTTP 429/);
  assert.equal(applyAlternativeGuard({}, { status: 'descartado', reason: 'Rotina' }).publicationDecision, 'historico');
});
