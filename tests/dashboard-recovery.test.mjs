import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { JSDOM } from 'jsdom';
import { dashboardAlternatives } from '../scripts/dashboard-recovery.mjs';
import { buildDashboardData, buildPublicDashboardData } from '../scripts/build-dashboard.mjs';
import { recoveredSourcesView } from '../dashboard/src/recovery-view.mjs';

const hash = text => createHash('sha256').update(text).digest('hex');
const body = 'Relato da fonte alternativa sobre o consórcio e seus atendimentos. '.repeat(20);
const source = { id: 'aux', documento_id: 'original', fonte: 'Outro portal',
  titulo_fonte: 'Atendimentos do consórcio', url_fonte: 'https://example.org/alternativa',
  texto: body, texto_sha256: hash(body), recuperado_em: '2026-10-16T16:10:00Z',
  leitura_preservada_em: '2026-10-14T15:12:55Z', leitor: 'readability',
  independencia: 'cita Semana 7; não é confirmação independente',
  comparacao: { shared: ['atendimentos', 'consórcio'], dateVerified: false } };
const row = { id: 'original', titulo: 'Título original', fonte: 'Semana 7',
  trecho: 'Texto original resumido', url: 'https://example.org/original',
  primeira_coleta: '2026-10-14', tipo_evento: 'GERAL' };
const review = { documento_id: row.id, decisao: 'duplicata', motivo: 'Mesmo episódio já registrado.',
  evidencia: row.trecho, fonte_evidencia: row.url, trecho_sha256: hash(row.trecho) };
const input = { archive: [row], events: [], consortia: [], links: [], pendingIdentity: [], editorialReviews: [review] };
const dom = () => new JSDOM('<!doctype html><body></body>');
const render = (item, compact = false) => {
  const document = dom().window.document;
  const view = recoveredSourcesView(item, { document, compact, date: value => value || 'Não informada' });
  if (view) document.body.append(view);
  return { document, view };
};

test('alternativa não altera original, decisão, contagens ou histórico de envio', () => {
  const before = buildDashboardData(input);
  const after = buildDashboardData({ ...input, alternativeTexts: [source] });
  assert.deepEqual(after.stats, before.stats);
  const { alternativeSources, ...rest } = after.items[0];
  const { alternativeSources: unused, ...old } = before.items[0];
  assert.deepEqual(rest, old);
  assert.equal(after.items[0].baseDecision, 'descartado');
  assert.equal(after.items[0].fullText, '');
  assert.equal(alternativeSources[0].decisionUse, 'not_cited');
  assert.equal(alternativeSources[0].fullText, body);
});

test('ignora hash inválido, URL insegura, outro documento e deduplica por fonte', () => {
  const sources = dashboardAlternatives('original', [source, source,
    { ...source, texto: 'alterado', url_fonte: 'https://example.org/alterada' },
    { ...source, url_fonte: 'javascript:alert(1)' }, { ...source, documento_id: 'outro' }], review);
  assert.equal(sources.length, 1);
});

test('fonte só é marcada como citada quando a revisão válida aponta para ela', () => {
  const cited = { ...review, fonte_evidencia: source.url_fonte };
  const valid = buildDashboardData({ ...input, editorialReviews: [cited], alternativeTexts: [source] });
  assert.equal(valid.items[0].alternativeSources[0].decisionUse, 'cited');
  const invalid = buildDashboardData({ ...input, editorialReviews: [{ ...cited, trecho_sha256: 'inválido' }], alternativeTexts: [source] });
  assert.equal(invalid.items[0].alternativeSources[0].decisionUse, 'not_cited');
});

test('modo público remove íntegra alternativa, preserva trecho limitado e omite dados pessoais', () => {
  const text = 'Contato teste@example.org CPF 123.456.789-09. ' + body;
  const local = buildDashboardData({ ...input, alternativeTexts: [{ ...source, texto: text, texto_sha256: hash(text) }] });
  const publicData = buildPublicDashboardData(local);
  const alt = publicData.items[0].alternativeSources[0];
  assert.equal(alt.fullText, '');
  assert.equal(alt.hasFullText, true);
  assert.ok(alt.excerpt.length < 550);
  assert.match(alt.excerpt, /CPF omitido/);
  assert.doesNotMatch(JSON.stringify(publicData), /teste@example.org|123\.456\.789-09/);
  assert.equal(local.items[0].alternativeSources[0].fullText, text);
});

test('ficha distingue original, alternativa, trecho público, cache e uso na decisão', () => {
  const data = buildPublicDashboardData(buildDashboardData({ ...input, alternativeTexts: [source] }));
  const { document } = render(data.items[0]);
  const text = document.body.textContent;
  assert.match(text, /Publicação original · Semana 7/);
  assert.match(text, /OUTRA FONTE · NÃO É O ORIGINAL/);
  assert.match(text, /Não citada na decisão atual/);
  assert.match(text, /não é confirmação independente/);
  assert.match(text, /não é uma nova abertura do site/);
  assert.match(text, /Sem texto integral original guardado/);
  assert.doesNotMatch(text, /Ler texto integral desta fonte alternativa/);
  assert.deepEqual([...document.querySelectorAll('a')].map(a => a.href), [row.url, source.url_fonte]);
});

test('texto local é acessível por details e conteúdo recuperado nunca vira HTML', () => {
  const danger = '<img src=x onerror=alert(1)><script>alert(1)</script>';
  const sources = dashboardAlternatives(row.id, [{ ...source, texto: danger, texto_sha256: hash(danger), titulo_fonte: danger }], review);
  const { document, view } = render({ ...row, source: row.fonte, url: 'javascript:alert(1)', alternativeSources: sources }, true);
  assert.equal(view.tagName, 'DETAILS');
  assert.ok(document.body.textContent.includes(danger));
  assert.equal(document.querySelectorAll('img,script,[onerror],a[href^="javascript:"]').length, 0);
  assert.match(document.body.textContent, /Ler texto integral desta fonte alternativa/);
});

test('PDF é documento original, com página preservada, não fonte alternativa', () => {
  const { document } = render({ source: 'Guanhães', url: 'https://example.org/original.pdf',
    fullText: '[Página 1]\nDecreto com texto lido por OCR.',
    originalReading: { pdf: true, reader: 'pdf_paginas_ocr_seletivo', url: 'https://example.org/original.pdf' } });
  assert.match(document.body.textContent, /Leitura do documento original/);
  assert.match(document.body.textContent, /PDF original, com OCR/);
  assert.match(document.body.textContent, /\[Página 1\]/);
  assert.equal(document.querySelectorAll('.recovery-source').length, 0);
});

test('sem leitura auxiliar, a ficha anterior continua sem uma seção vazia', () => {
  assert.equal(render({}).view, null);
});
