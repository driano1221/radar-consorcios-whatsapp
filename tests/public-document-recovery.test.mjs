import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { compareAlternative, downloadGuanhaesPdf, findAlternativeTexts, completePdfText,
  searchAlternatives, isSemana7, alternativeSourceKey, parsePublicWordpressPosts, digest } from '../src/lib/public-document-recovery.mjs';
import { recoverPublicDocuments } from '../scripts/recover-public-documents.mjs';

const original = { id: 'original', titulo: 'Consórcio de Saúde viabiliza procedimentos oftalmológicos para 100 pacientes do Araguaia - SEMANA 7',
  fonte: 'SEMANA 7', url: 'https://www.semana7.com.br/saude/um/1', data_noticia_original: '2026-10-13' };
const candidate = { id: 'alternate', titulo: 'Consórcio de Saúde Garças/Araguaia viabiliza procedimentos oftalmológicos para mais 100 pacientes da região - Araguaia Notícia',
  url: 'https://araguaianoticia.com.br/noticia/exemplo', data_noticia_original: '2026-10-13', fonte: 'Araguaia Notícia' };
const text = 'Consórcio viabiliza procedimentos oftalmológicos para 100 pacientes. Fonte: Semana 7. ' + 'Prova de atendimento. '.repeat(40);
const read = async item => ({ ...item, articleUrl: item.url, rawText: text,
  contentProvenance: 'pagina_original', sourcePublishedAt: '2026-10-13', articleReader: 'test_reader' });
const pdfUrl = 'https://s3.amazonaws.com/el.com.br/portal/uploads/3177/arquivos/example.pdf';
const pdf = { url: pdfUrl, completo: true, pdf_sha256: 'hash', paginas_pendentes: [], ocr_paginas: 0,
  paginas: [{ pagina: 1, situacao: 'texto', texto: 'Texto oficial. '.repeat(30) }] };

test('comparação propõe fonte, não confirma evento nem identidade', () => {
  const result = compareAlternative(original, candidate);
  assert.equal(result.eligible, true);
  assert.equal(result.dateVerified, true);
  assert.equal(result.equivalenceConfirmed, false);
  assert.equal(isSemana7({ fonte: 'SEMANA 7', url: 'https://news.google.com/rss/articles/id' }), true);
});
test('não aceita números, negação, datas ou assuntos incompatíveis', () => {
  for (const other of [
    { ...candidate, titulo: candidate.titulo.replace('100', '200') },
    { ...candidate, titulo: 'Não ' + candidate.titulo },
    { ...candidate, data_noticia_original: '2025-01-01' },
    { ...candidate, titulo: 'Consórcio realiza reunião da diretoria' },
  ]) assert.equal(compareAlternative(original, other).eligible, false);
  const unknownDate = compareAlternative({ ...original, data_noticia_original: '' }, candidate);
  assert.equal(unknownDate.dateVerified, false);
  assert.equal(unknownDate.equivalenceConfirmed, false);
});
test('busca externa é usada quando o acervo não tem candidato e corpo é preservado com origem', async () => {
  let searches = 0;
  const result = await findAlternativeTexts(original, [], { search: async () => { searches++; return [candidate]; }, read });
  assert.equal(searches, 1);
  assert.equal(result.alternatives.length, 1);
  const alt = result.alternatives[0];
  assert.equal(alt.url_original_bloqueada, original.url);
  assert.equal(alt.url_fonte, candidate.url);
  assert.equal(alt.equivalencia_confirmada, false);
  assert.match(alt.independencia, /não é confirmação independente/);
  assert.equal(alt.origem_descoberta, 'busca_web');
});
test('acervo é prioridade e mesmo link alternativo não é lido duas vezes', async () => {
  let reads = 0;
  const result = await findAlternativeTexts(original, [candidate, { ...candidate }], {
    search: async () => { throw new Error('Não deveria pesquisar'); },
    read: async item => { reads++; return read(item); } });
  assert.equal(reads, 1);
  assert.equal(result.alternatives.length, 1);
});
test('desktop e AMP da mesma matéria são uma fonte; IDs distintos não são fundidos', async () => {
  const desktop = 'https://araguaianoticia.com.br/noticia/79550/titulo';
  assert.equal(alternativeSourceKey(desktop), alternativeSourceKey(desktop + '/amp'));
  assert.notEqual(alternativeSourceKey(desktop), alternativeSourceKey(desktop.replace('79550', '79551')));
  const result = await findAlternativeTexts(original, [{ ...candidate, url: desktop },
    { ...candidate, url: desktop + '/amp' }], { read });
  assert.equal(result.alternatives.length, 1);
});
test('URL do acervo bloqueada permite procurar outra fonte na web', async () => {
  let searches = 0;
  const result = await findAlternativeTexts(original, [candidate], {
    search: async () => { searches++; return [{ ...candidate, url: 'https://prefeitura.example/noticia' }]; },
    read: async item => item.url === candidate.url ? item : read(item) });
  assert.equal(searches, 1);
  assert.equal(result.alternatives.length, 1);
});
test('título semelhante não basta: bloqueio, corpo alheio ou retorno ao Semana 7 não são prova', async () => {
  for (const reader of [async item => item,
    async item => ({ ...await read(item), rawText: 'Cardápio e futebol. '.repeat(100) }),
    async item => ({ ...await read(item), articleUrl: original.url }),
    async item => ({ ...await read(item), sourcePublishedAt: '2025-01-01' })]) {
    const result = await findAlternativeTexts(original, [candidate], { read: reader, search: async () => [] });
    assert.equal(result.alternatives.length, 0);
  }
});
test('RSS de busca inválido e HTTP 403 são falhas, não zero resultados', async () => {
  await assert.rejects(() => searchAlternatives(original, async () => new Response('Forbidden', { status: 403 })), /403/);
  await assert.rejects(() => searchAlternatives(original, async () => new Response('<html>challenge</html>')), /nao_rss/);
});
test('API pública só aceita posts publicados do domínio certo e preserva conteúdo e UTC', () => {
  const post = { id: 42, status: 'publish', type: 'post', link: 'https://rededanoticia.com.br/exemplo/',
    title: { rendered: candidate.titulo }, content: { rendered: `<p>${text}</p>` }, date_gmt: '2026-10-13T12:00:00' };
  const parsed = parsePublicWordpressPosts([post, { ...post, status: 'draft' },
    { ...post, link: 'http://localhost/secret' }, { ...post, content: { rendered: text, protected: true } }]);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].data_noticia_original, '2026-10-13T12:00:00Z');
  assert.equal(parsed[0].apiReading.articleReader, 'wordpress_api_publica');
  assert.ok(parsed[0].apiReading.rawText.length > 500);
});
test('falha de um provedor fica explícita e não derruba o outro', async () => {
  const results = await searchAlternatives(original, async url => url.startsWith('https://news.google.com')
    ? new Response('Forbidden', { status: 403 }) : new Response('[]'));
  assert.equal(results.length, 0);
  assert.equal(results.diagnostics[0].status, 'erro');
  assert.equal(results.diagnostics[1].status, 'ok');
});
test('cache integral exige hash e URL corretos, mantendo data da leitura preservada', async () => {
  const cached = { documento_id: candidate.id, texto: text, texto_sha256: digest(text),
    url_artigo: candidate.url, leitor: 'readability', recuperado_em: '2026-10-15T00:00:00Z' };
  let reads = 0;
  const result = await findAlternativeTexts(original, [candidate], { storedTexts: new Map([[candidate.id, cached]]),
    read: async () => { reads++; throw new Error('Não deveria ler'); } });
  assert.equal(reads, 0);
  assert.equal(result.alternatives[0].leitura_preservada_em, cached.recuperado_em);
  const invalid = await findAlternativeTexts(original, [candidate], { storedTexts: new Map([[candidate.id, { ...cached, texto_sha256: 'invalid' }]]),
    read: async item => item, search: async () => [] });
  assert.equal(invalid.alternatives.length, 0);
});
test('download PDF exige origem observada, assinatura e não segue redirecionamento', async () => {
  await assert.rejects(() => downloadGuanhaesPdf('https://example.com/a.pdf'), /fora/);
  await assert.rejects(() => downloadGuanhaesPdf(pdfUrl, async () => new Response('HTML')), /nao_pdf/);
  await assert.rejects(() => downloadGuanhaesPdf(pdfUrl, async () => new Response('', { status: 302, headers: { location: 'http://localhost' } })), /302/);
  assert.equal((await downloadGuanhaesPdf(pdfUrl, async () => new Response('%PDF-1.7\n'))).subarray(0, 5).toString(), '%PDF-');
});
test('PDF parcial nunca é salvo como íntegra; páginas e anonimização são preservadas', () => {
  assert.equal(completePdfText({ id: 'p', url: pdfUrl }, { ...pdf, completo: false }), null);
  assert.equal(completePdfText({ id: 'p', url: pdfUrl }, { ...pdf, paginas_pendentes: [1] }), null);
  const stored = completePdfText({ id: 'p', url: pdfUrl }, { ...pdf,
    paginas: [{ pagina: 1, texto: '123.456.789-10 ' + text }] });
  assert.match(stored.texto, /\[Página 1\]/);
  assert.match(stored.texto, /CPF omitido/);
  assert.equal(stored.url_original, pdfUrl);
});
test('duas recuperações preservam IDs, decisão, prova e envios; fonte alternativa fica separada', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'radar-public-test-'));
  try {
    const record = { id: 'pdf', url: pdfUrl, titulo: 'Decreto consórcio', decisao_base: 'descartado',
      trecho: 'prova revisada', enviado_em: '2026-10-01', etapa: 'histórico' };
    const file = path.join(directory, 'arquivo-coletas.ndjson');
    await writeFile(file, [record, original].map(JSON.stringify).join('\n') + '\n');
    let calls = 0;
    const options = { directory, apply: true, readPdf: async () => { calls++; return pdf; },
      alternatives: async row => findAlternativeTexts(row, [candidate], { read }) };
    assert.deepEqual(await recoverPublicDocuments(options), { attempted: 2, completePdfs: 1, alternativeTexts: 1, apply: true });
    assert.equal((await recoverPublicDocuments(options)).attempted, 0);
    assert.equal(calls, 1);
    const after = (await readFile(file, 'utf8')).trim().split('\n').map(JSON.parse);
    for (const key of ['id', 'url', 'decisao_base', 'trecho', 'enviado_em', 'etapa']) assert.equal(after[0][key], record[key]);
    assert.equal(after.length, 2);
    const stored = (await readFile(path.join(directory, 'textos-artigos.ndjson'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(stored.length, 1); assert.equal(stored[0].documento_id, 'pdf');
    assert.deepEqual(after[1], original);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('falha/sem alternativa entra em backoff e não transforma ausência de texto em descarte', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'radar-public-test-'));
  try {
    const file = path.join(directory, 'arquivo-coletas.ndjson');
    await writeFile(file, JSON.stringify(original) + '\n');
    const options = { directory, apply: true, alternatives: async () => { throw new Error('timeout'); } };
    await recoverPublicDocuments(options);
    assert.equal((await recoverPublicDocuments(options)).attempted, 0);
    assert.deepEqual(JSON.parse((await readFile(file, 'utf8')).trim()), original);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
