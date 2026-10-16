import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { classifyItem } from '../src/lib/classifier.mjs';
import { recoveredSuggestion } from '../src/lib/recovered-suggestion.mjs';
import { routineSupplierContract } from '../src/lib/contract-context.mjs';
import { sourcePublicationDate } from '../src/lib/publication-date.mjs';
import { decidePublication, isNotifiable } from '../src/lib/publication-gate.mjs';
import { applyAiReview, AI_PROMPT_VERSION } from '../src/lib/ai-review.mjs';
import { loadEditorialGuard, applyEditorialGuard } from '../src/lib/editorial-guard.mjs';
import { mergeStateIntoCatalog, catalogRecord } from '../src/lib/catalog.mjs';

const directory = new URL('../data/catalogo/', import.meta.url);
const read = async name => (await readFile(new URL(`${name}.ndjson`, directory), 'utf8'))
  .trim().split('\n').filter(Boolean).map(JSON.parse);
const archive = await read('arquivo-coletas');
const texts = await read('textos-artigos');
const reviews = await read('revisoes-eventos');
const cases = [
  ['c24a8dce', 'RATEIO'], ['46665ce6', 'GERAL'], ['7114cd79', 'GERAL'], ['a854767c', 'GERAL'],
  ['d532ca4a', 'GERAL'], ['8c7dbb9e', 'ATUAÇÃO'], ['14401a42', 'PROTOCOLO'],
  ['1370f1e1', 'RATEIO'], ['4739a940', 'GOVERNANÇA'], ['ac59dad5', 'ADESÃO AUTORIZADA'],
  ['d3c65b15', 'FINANÇAS'], ['204bf17d', 'CONTROLE'],
];

for (const [prefix, expected] of cases) test(`lote 16/10: ${prefix} classifica o texto integral, não apenas a decisão manual`, () => {
  const row = archive.find(r => r.id.startsWith(prefix));
  assert.ok(row);
  const stored = texts.find(r => r.documento_id === row.id);
  assert.ok(stored?.texto.length > 400);
  const result = classifyItem({ kind: 'news', title: row.titulo, rawText: stored.texto,
    url: row.url, articleUrl: stored.url_artigo });
  assert.equal(result.category, expected);
  assert.ok(expected === 'GERAL' ? result.score <= 0 : result.score >= 5);
  const review = reviews.find(r => r.documento_id === row.id);
  assert.equal(review.decisao, expected === 'GERAL' ? 'nao_evento' : 'confirmar_evento');
  assert.equal(review.trecho_sha256, createHash('sha256').update(row.trecho || '').digest('hex'));
  assert.equal(recoveredSuggestion(row, stored, { reviewed: true }).candidate, false);
});

test('contratos com nomes e números diferentes não ressuscitam como crise na recuperação', () => {
  const original = texts.find(r => r.documento_id.startsWith('7114cd79'));
  const texto = original.texto.replaceAll('126/2026', '912/2027').replaceAll('Vale do Rio Cuiabá', 'Região da Serra');
  const row = { tipo_evento: 'GERAL', titulo: '912-2027 - Termo de Inex 7.2027', url: 'https://example.org/novo' };
  const { candidate, classification, fields } = recoveredSuggestion(row, { texto });
  assert.equal(candidate, false);
  assert.equal(classification.category, 'GERAL');
  assert.equal(fields.article_suggested_category, '');
  const item = { ...row, classification };
  assert.equal(applyAiReview(item, { status: 'approved', category: 'CRISE', promptVersion: AI_PROMPT_VERSION }).classification.category, 'GERAL');
});

test('notícia nova do mesmo credenciamento também fica fora, sem bloquear entrega ou sanção real', () => {
  const row = archive.find(r => r.id.startsWith('f49d49e3'));
  const stored = texts.find(r => r.documento_id === row.id);
  const item = { title: row.titulo, rawText: stored.texto };
  assert.equal(classifyItem(item).category, 'GERAL');
  assert.equal(classifyItem({ ...item, rawText: stored.texto.replaceAll('Cisvarc', 'CISREGIONAL').replaceAll('6.400', '3.200') }).category, 'GERAL');
  assert.notEqual(classifyItem({ title: 'Consórcio realizou entrega de próteses', rawText: `O Consórcio Intermunicipal Regional entregou 200 próteses aos pacientes. ${stored.texto}` }).category, 'GERAL');
  assert.equal(routineSupplierContract({ ...item, rawText: `O Tribunal de Contas aplicou multas ao presidente do consórcio. ${stored.texto}` }), null);
});

test('hipóteses de falência e retirada de ordens não são acontecimentos do consórcio', () => {
  for (const text of [
    'O consórcio intermunicipal poderá rescindir o contrato no caso de falência da empresa credenciada.',
    'No caso de falência da empresa contratada, o consórcio intermunicipal poderá aplicar sanções.',
    'O consórcio intermunicipal aguarda retirada da Ordem de serviços pela contratada.',
    'O consórcio intermunicipal poderá aplicar suspensão à contratada em caso de descumprimento do contrato.',
  ]) assert.equal(classifyItem({ title: 'Condições do contrato', rawText: text }).category, 'GERAL', text);
});

test('crise, saída e controle efetivos continuam passando', () => {
  for (const [category, rawText] of [
    ['CRISE', 'Foi decretada a dissolução do Consórcio Intermunicipal Regional.'],
    ['CRISE', 'O Consórcio Intermunicipal Regional está sem recursos e encerra atividades.'],
    ['SAÍDA', 'O Município de Aurora formalizou sua retirada do Consórcio Intermunicipal Regional.'],
    ['CONTROLE', 'O Tribunal de Contas determinou a suspensão da licitação do Consórcio Intermunicipal Regional.'],
  ]) assert.equal(classifyItem({ title: 'Ato publicado', rawText }).category, category);
});

test('cláusula hipotética não oculta crise real distante no mesmo texto', () => {
  const rawText = 'No caso de falência da empresa credenciada, o consórcio intermunicipal poderá rescindir o contrato. ' +
    'Contexto sem acontecimentos. '.repeat(150) + 'Foi decretada a dissolução do Consórcio Intermunicipal da Serra.';
  assert.equal(classifyItem({ title: 'Atos oficiais', rawText }).category, 'CRISE');
});

test('rateio entre município e consórcio não é contrato rotineiro com fornecedor', () => {
  const rawText = 'Primeiro Aditivo ao Contrato de Rateio n.º 12/2027, que celebram o Consórcio Intermunicipal da Serra e o Município de Aurora. As partes firmam o termo.';
  const result = classifyItem({ title: 'Primeiro aditivo ao rateio', rawText });
  assert.equal(result.category, 'RATEIO');
  assert.match(result.stage, /aditivo/);
});

test('votação aprovada de projeto não é lei sancionada; requerimento continua descartado', () => {
  const row = archive.find(r => r.id.startsWith('14401a42'));
  const stored = texts.find(r => r.documento_id === row.id);
  const item = { title: row.titulo, url: stored.url_artigo, rawText: stored.texto };
  assert.match(classifyItem(item).stage, /sanção e constituição não provadas/);
  assert.equal(applyAiReview({ ...item, classification: classifyItem(item) }, {
    promptVersion: AI_PROMPT_VERSION, status: 'approved', category: 'CRIAÇÃO',
  }).classification.category, 'PROTOCOLO');
  item.rawText = stored.texto.replace('Projeto de Lei EM nº 23', 'Requerimento nº 23').replace('Ratifica o Protocolo', 'Solicita informações sobre o Protocolo');
  assert.equal(classifyItem(item).category, 'GERAL');
});

test('índice real do CONIAPE não vira evento ao conter notícia de assembleia realizada', () => {
  const row = archive.find(r => r.id.startsWith('2b258a3e'));
  const stored = texts.find(r => r.documento_id === row.id);
  const result = recoveredSuggestion(row, stored);
  assert.equal(result.candidate, false);
  assert.equal(result.classification.category, 'GERAL');
  assert.match(result.classification.stage, /índice de notícias/);
});

test('TCE-PR usa data no cabeçalho, nunca atualização do rodapé, e bloqueia alerta antigo', () => {
  const html = '<span class="detailed_news_default--header--super_card--footer-date">26 de\n maio de\n2016 - 10:00</span><footer>Atualizado em 16/10/2026</footer>';
  const now = new Date('2026-10-16T15:00:00Z');
  const date = sourcePublicationDate(html, now);
  assert.equal(date.date, '2016-05-26T00:00:00.000Z');
  assert.equal(sourcePublicationDate('<footer>26 de maio de 2016 - 10:00</footer>', now), null);
  const item = decidePublication({ title: 'Notícia', sourcePublishedAt: date.date, publishedAt: now.toISOString(),
    classification: { category: 'CONTROLE', score: 10 } }, { now });
  assert.equal(item.publicationDecision, 'historico');
  assert.equal(isNotifiable(item), false);
});

test('todas as decisões do lote se reaplicam sem liberar alertas ou reenvios', async () => {
  const { fileURLToPath } = await import('node:url');
  const guard = await loadEditorialGuard(fileURLToPath(directory));
  for (const [prefix] of cases) {
    const row = archive.find(r => r.id.startsWith(prefix));
    const item = applyEditorialGuard({ url: row.url, classification: { category: 'CRISE', score: 20, reasons: [] } }, guard);
    assert.equal(isNotifiable(item), false, prefix);
    assert.ok(['historico', 'descartado'].includes(item.publicationDecision), prefix);
  }
});

test('atualizar prompt não ressuscita rejeição histórica ao reconstruir catálogo repetidamente', () => {
  const item = { kind: 'news', title: 'Consórcio intermunicipal anuncia projeto', url: 'https://example.org/projeto',
    summary: 'O Consórcio Intermunicipal da Serra lança projeto de cooperação.',
    classification: { category: 'ATUAÇÃO', score: 10 },
    aiReview: { status: 'rejected', promptVersion: AI_PROMPT_VERSION - 1, category: 'IRRELEVANTE' } };
  const at = '2026-10-16T10:00:00Z';
  const row = catalogRecord(item, at, at);
  const records = new Map([[row.id, row]]);
  const state = { observations: { x: { item, firstSeenAt: at, lastSeenAt: at } } };
  mergeStateIntoCatalog(records, state);
  const first = JSON.stringify([...records]);
  mergeStateIntoCatalog(records, state);
  assert.equal(JSON.stringify([...records]), first);
  assert.equal(records.get(row.id).tipo_evento, 'GERAL');
  assert.equal(applyAiReview(item, item.aiReview).classification.category, 'ATUAÇÃO', 'fila ainda exige revisão do prompt atual');
});
