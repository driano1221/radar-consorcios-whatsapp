import test from 'node:test';
import assert from 'node:assert/strict';
import { readHtmlResponse, parseCimceroArticle, enrichArticle } from '../src/lib/article-enrichment.mjs';
import { findIdentityMentions } from '../src/lib/consortium-identity.mjs';

test('GCM do local visitado não é sigla do Consórcio ABC', () => {
  const mentions = findIdentityMentions({ tipo_evento: 'ATUAÇÃO',
    trecho: 'O Consórcio Intermunicipal Grande ABC realizou, na quinta (24), visita técnica ao Centro de Formação da Guarda Civil Municipal (GCM) de Santo André.',
    curatedMentions: [{ nome: 'Consórcio Intermunicipal Grande ABC', sigla: '', fonte_evidencia: 'https://folhadoabc.com.br/noticia' }] });
  assert.equal(mentions.length, 1);
  assert.equal(mentions[0].name, 'Consórcio Intermunicipal Grande ABC');
  assert.equal(mentions[0].acronym, '');
});

test('charset HTTP inválido respeita declaração UTF-8 do HTML, sem abortar por sidebar quebrada', async () => {
  const bytes = Buffer.concat([Buffer.from('<meta http-equiv="Content-Type" content="text/html;charset=utf-8"><article>Consórcio e cooperação técnica</article>'), Buffer.from([0xff])]);
  const text = await readHtmlResponse(new Response(bytes, { headers: { 'content-type': 'text/html; charset=iso-utf-8' } }));
  assert.match(text, /Consórcio e cooperação técnica/);
});

test('charset inválido sem meta só aceita UTF-8 válido; Windows-1252 válido é preservado', async () => {
  const response = bytes => new Response(bytes, { headers: { 'content-type': 'text/html; charset=iso-utf-8' } });
  assert.equal(await readHtmlResponse(response(Buffer.from('Municípios'))), 'Municípios');
  await assert.rejects(readHtmlResponse(response(Buffer.from([0xff]))));
  assert.equal(await readHtmlResponse(new Response(Buffer.from([0x61, 0xe7, 0xe3, 0x6f]), {
    headers: { 'content-type': 'text/html; charset=windows-1252' } })), 'ação');
});

const title = 'CIMCERO convoca 121ª Assembleia Geral Ordinária';
const body = 'O CIMCERO convoca os municípios para a assembleia que será realizada em setembro de 2026. A pauta inclui a proposta de orçamento, para posterior apreciação e aprovação.';
const fixture = html => ({ response: true, data: { noticia: { id: '202', title, body: html, data: '2026-09-10 14:12:52' },
  relacionadas: [{ title: 'Consórcio aprova orçamento e adesão', body: 'NÃO EXTRAIR TEXTO RELACIONADO' }] } });

test('CIMCERO lê só corpo da notícia, com HTML escapado ou direto, nunca notícias relacionadas', () => {
  for (const html of [`&lt;p&gt;${body}&lt;/p&gt;`, `<p>${body}</p><script>IGNORE</script>`]) {
    const parsed = parseCimceroArticle(fixture(html), '202', `${title} - CIMCERO`);
    assert.equal(parsed.text, body);
    assert.equal(parsed.date, '2026-09-10');
    assert.doesNotMatch(parsed.text, /RELACIONADO|IGNORE/);
  }
});

test('CIMCERO rejeita id, título e corpo incompatíveis', () => {
  const data = fixture(body);
  assert.equal(parseCimceroArticle(data, '203', title), null);
  assert.equal(parseCimceroArticle(data, '202', 'Outra matéria sobre aprovação'), null);
  assert.equal(parseCimceroArticle(fixture('texto curto'), '202', title), null);
  data.data.noticia.title = '';
  assert.equal(parseCimceroArticle(data, '202', title), null);
});

test('CIMCERO usa API pública com id exato e não usa texto genérico institucional como fallback', async () => {
  const item = { kind: 'news', url: 'https://consorciopublico.ro.gov.br/noticias/202', title, summary: '' };
  let calls = 0;
  const result = await enrichArticle(item, { fetchImpl: async url => {
    calls++; assert.equal(url, 'https://cdn.consorciopublico.ro.gov.br/api/getnoticia?id=202');
    return Response.json(fixture(body));
  } });
  assert.equal(calls, 1); assert.equal(result.rawText, body); assert.equal(result.articleReader, 'cimcero_api_publica');
  assert.equal(result.url, item.url);
  let failure;
  const invalid = fixture(body); invalid.data.noticia.id = '999';
  const untouched = await enrichArticle(item, { fetchImpl: async () => Response.json(invalid), onFailure: (_, reason) => { failure = reason; } });
  assert.equal(untouched.rawText, undefined);
  assert.equal(failure, 'cimcero_api_corpo_invalido');
});
