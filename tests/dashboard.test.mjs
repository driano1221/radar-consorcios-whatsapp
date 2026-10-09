import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { buildDashboardData, buildPublicDashboardData, contentQuality, dashboardSourceCatalog, makeBaseTable } from '../scripts/build-dashboard.mjs';

test('versão pública preserva decisões e tabelas, mas não republica texto integral nem identificadores pessoais', () => {
  const input = { generatedAt: '2026-10-09T12:00:00Z', items: [{ id: '1', title: 'Ato publicado',
    evidence: 'Consórcio ratificou o protocolo.', fullText: 'Texto integral extenso.',
    reason: 'Contato exemplo@site.org; CPF 123.456.789-09' }],
  baseTables: [{ id: 'eventos', columns: [{ key: 'titulo' }], rows: [{ titulo: 'Ato publicado' }] }] };
  const publicData = buildPublicDashboardData(input);
  assert.equal(input.items[0].fullText, 'Texto integral extenso.');
  assert.equal(publicData.public, true);
  assert.equal(publicData.items[0].fullText, '');
  assert.equal(publicData.items[0].hasFullText, true);
  assert.equal(publicData.items[0].evidence, 'Consórcio ratificou o protocolo.');
  assert.match(publicData.items[0].reason, /e-mail omitido/);
  assert.match(publicData.items[0].reason, /CPF omitido/);
  assert.equal(publicData.baseTables[0].rows[0].titulo, 'Ato publicado');
});

test('painel usa registro com decisão e evidência visíveis, sem janela XP ou navegação por cartas', async () => {
  const html = await readFile(new URL('../dashboard/src/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../dashboard/src/app.js', import.meta.url), 'utf8');
  assert.match(html, /registry\.css/);
  assert.doesNotMatch(html, /xp\.css|window-controls|deck-prev|deck-next/);
  assert.match(html, /id="overview-detail"/);
  assert.match(script, /renderOverviewDetail\(/);
  assert.match(script, /Nenhum trecho de prova foi recuperado/);
});

test('base expõe todas as colunas, até em tabela vazia, com explicação e ordem legível', () => {
  const empty = makeBaseTable('participacoes', [], ['consorcio', 'municipio', 'ano_ingresso']);
  assert.equal(empty.rows.length, 0);
  assert.deepEqual(empty.columns.map((column) => column.key), ['consorcio', 'municipio', 'ano_ingresso']);
  assert.ok(empty.columns.every((column) => column.description.length > 20));
  const events = makeBaseTable('eventos', [{ id: '1', titulo: 'Lei municipal', decisao_base: 'confirmado' }],
    ['id', 'decisao_base', 'titulo']);
  assert.deepEqual(events.columns.map((column) => column.key), ['titulo', 'decisao_base', 'id']);
  assert.equal(events.rows[0].id, '1');
});

test('painel distingue ausência de texto de um trecho disponível', () => {
  assert.equal(contentQuality('Consórcio abre concurso - Portal', 'Consórcio abre concurso Portal'), 'apenas_titulo');
  assert.equal(contentQuality('Consórcio abre concurso', ''), 'sem_trecho');
  assert.equal(contentQuality('Consórcio abre concurso', 'O edital do concurso prevê onze vagas e inscrições até outubro.'), 'trecho_disponivel');
});

test('painel mostra fato confirmado na base, mas histórico para alerta', () => {
  const row = { id: 'historico', titulo: 'Lei autoriza ingresso', fonte: 'Câmara',
    url: 'https://example.org/lei', data_publicacao: '2026-10-08T00:00:00Z',
    data_fato: '2026-06-23T12:00:00Z', decisao_base: 'confirmado',
    decisao_alerta: 'historico', motivo_alerta: 'Lei de junho reindexada em outubro.',
    primeira_coleta: '2026-10-08T00:00:00Z', ultima_coleta: '2026-10-09T00:00:00Z',
    tipo_evento: 'ADESÃO AUTORIZADA', situacao_analise: 'confirmado por revisão editorial' };
  const result = buildDashboardData({ archive: [row], events: [row], consortia: [], links: [], pendingIdentity: [] });
  assert.equal(result.items[0].baseDecision, 'confirmado');
  assert.equal(result.items[0].alertDecision, 'historico');
  assert.equal(result.items[0].eventAt, '2026-06-23T12:00:00Z');
  assert.match(result.items[0].alertReason, /reindexada/);
});

test('painel expõe falhas da última coleta sem confundir fonte desativada com erro', () => {
  const row = { id: 'titulo', titulo: 'Consórcio abre concurso - Portal', trecho: 'Consórcio abre concurso Portal',
    fonte: 'Portal', url: 'https://example.org', ultima_coleta: '2026-10-05T13:00:00Z' };
  const result = buildDashboardData({ archive: [row], events: [], consortia: [], links: [], pendingIdentity: [],
    sourceHealth: { Portal: { name: 'Portal', status: 'error', checkedAt: '2026-10-05T13:00:00Z', message: 'Timeout' },
      Outra: { name: 'Outra', status: 'disabled', checkedAt: '2026-10-05T13:00:00Z' } } });
  assert.equal(result.stats.insufficientContent, 1);
  assert.equal(result.stats.insufficientRaw, 1);
  assert.equal(result.items[0].contentQuality, 'apenas_titulo');
  assert.equal(result.collectionHealth[0].message, 'Timeout');
  assert.equal(result.collectionHealth[1].status, 'disabled');
  assert.equal(result.stats.titleOnlyUnverified, 1);
});

test('painel preserva texto integral separadamente e mostra cinco vínculos para uma portaria multi-consórcio', () => {
  const row = { id: 'paici', titulo: 'Portaria PAICI', trecho: 'Portaria PAICI',
    url: 'https://example.org/portaria', fonte: 'IOMAT', article_recovery_reason: '',
    ultima_coleta: '2026-10-09T12:00:00Z' };
  const links = Array.from({ length: 5 }, (_, index) => ({ documento_id: row.id,
    consorcio_id: `c${index}`, nome_mencionado: `Consórcio ${index}`,
    evidencia: `Bloco ${index} da portaria`, url_evidencia: row.url }));
  const result = buildDashboardData({ archive: [row], events: [], consortia: [], links,
    pendingIdentity: [], articleTexts: [{ documento_id: row.id, texto: 'Texto completo da portaria', leitor: 'ocr' }] });
  assert.equal(result.items[0].links.length, 5);
  assert.equal(result.items[0].fullText, 'Texto completo da portaria');
  assert.equal(result.stats.titleOnlyUnverified, 0);
});

test('painel separa arquivo bruto, evento candidato e ato antigo reindexado', () => {
  const makeRow = (id, title) => ({ id, titulo: title, fonte: 'Câmara', url: `https://example.org/${id}`,
    primeira_coleta: '2026-10-05T12:00:00Z', ultima_coleta: '2026-10-05T13:00:00Z',
    data_publicacao: '2026-10-05T11:00:00Z', tipo_evento: 'PROTOCOLO',
    situacao_analise: 'candidato', etapa: 'ato publicado', pontuacao: 10, trecho: 'Evidência' });
  const recent = makeRow('recent', 'Lei 100/2026 ratifica protocolo de intenções');
  const stale = makeRow('stale', '14/03/2022 - LEI Nº559-2022 Ratifica protocolo de intenções');
  const raw = { ...makeRow('raw', 'Notícia geral'), tipo_evento: 'GERAL' };
  const result = buildDashboardData({ archive: [recent, stale, raw], events: [recent, stale],
    consortia: [{ id: 'c1', nome: 'Consórcio X', documentos_vinculados: '1' }],
    links: [{ documento_id: 'recent', consorcio_id: 'c1', nome_mencionado: 'Consórcio X' }],
    pendingIdentity: [{ documento_id: 'recent', motivo: 'sigla ambígua' }], decisions: {} });
  assert.equal(result.stats.documents, 3);
  assert.equal(result.stats.missingSourceCandidates, 0);
  assert.equal(result.stats.eventCandidates, 1);
  assert.equal(result.items.find((row) => row.id === 'recent').baseStatus, 'evento_candidato');
  assert.equal(result.items.find((row) => row.id === 'stale').baseStatus, 'arquivo_bruto');
  assert.match(result.items.find((row) => row.id === 'stale').reason, /Ato antigo/);
  assert.equal(result.items.find((row) => row.id === 'recent').identityPending, 'sigla ambígua');
});

test('painel usa a categoria e etapa corrigidas pela revisão editorial', () => {
  const raw = { id: 'valinhos', titulo: 'Diário Oficial de Valinhos', fonte: 'Querido Diário',
    url: 'https://example.org/valinhos', data_publicacao: '2026-09-29T00:00:00Z',
    primeira_coleta: '2026-10-01T00:00:00Z', ultima_coleta: '2026-10-02T00:00:00Z',
    tipo_evento: 'ADESÃO', etapa: 'ato publicado', situacao_analise: 'candidato' };
  const curated = { ...raw, tipo_evento: 'PROPOSTA DE ADESÃO',
    etapa: 'proposta aprovada no Conselho — ingresso não comprovado',
    situacao_analise: 'categoria corrigida por revisão editorial — proposta, não adesão efetiva' };
  const result = buildDashboardData({ archive: [raw], events: [curated], consortia: [],
    links: [], pendingIdentity: [], decisions: {} });
  assert.equal(result.items[0].category, 'PROPOSTA DE ADESÃO');
  assert.match(result.items[0].reason, /não adesão efetiva/);
  assert.match(result.items[0].stage, /ingresso não comprovado/);
});

test('revisão editorial de falso evento explica por que não entrou na base', () => {
  const row = { id: 'falso', titulo: 'Notícia ambígua', fonte: 'Portal',
    url: 'https://example.org/falso', data_publicacao: '2026-10-04T00:00:00Z',
    primeira_coleta: '2026-10-04T00:00:00Z', ultima_coleta: '2026-10-05T00:00:00Z',
    tipo_evento: 'CRIAÇÃO', situacao_analise: 'candidato', trecho: 'Cria agenda, não um consórcio' };
  const review = { documento_id: row.id, decisao: 'nao_evento', motivo: 'agenda de entidade já existente',
    trecho_sha256: createHash('sha256').update(row.trecho).digest('hex') };
  const result = buildDashboardData({ archive: [row], events: [], consortia: [], links: [],
    pendingIdentity: [], editorialReviews: [review], decisions: {} });
  assert.equal(result.items[0].baseStatus, 'arquivo_bruto');
  assert.match(result.items[0].reason, /agenda de entidade já existente/);
  assert.equal(result.items[0].score, '');
});

test('painel mostra data original conferida em vez da data de indexação do Google', () => {
  const row = { id: 'antiga', titulo: 'Assembleia do consórcio', fonte: 'Câmara',
    url: 'https://example.org/antiga', data_publicacao: '2026-10-02T00:00:00Z',
    primeira_coleta: '2026-10-03T00:00:00Z', ultima_coleta: '2026-10-08T00:00:00Z',
    tipo_evento: 'GERAL', trecho: 'Assembleia do consórcio' };
  const review = { documento_id: row.id, decisao: 'nao_evento', motivo: 'notícia antiga reindexada',
    evidencia: 'Publicada em 02/12/2021', fatos: { data_publicacao_original: '2021-12-02' },
    trecho_sha256: createHash('sha256').update(row.trecho).digest('hex') };
  const result = buildDashboardData({ archive: [row], events: [], consortia: [], links: [],
    pendingIdentity: [], editorialReviews: [review] });
  assert.equal(result.items[0].publishedAt, '2021-12-02T12:00:00Z');
  assert.equal(result.items[0].publishedDateSource, 'revisao_editorial');
  assert.equal(result.stats.insufficientRaw, 0);
});

test('painel mostra aceitação editorial, fatos e consórcio já identificado sem pendência falsa', () => {
  const row = { id: 'confirmado', titulo: 'Contrato de rateio 055/2026', fonte: 'Diário oficial',
    url: 'https://example.org/ato', data_publicacao: '2026-10-05T00:00:00Z',
    primeira_coleta: '2026-10-05T00:00:00Z', ultima_coleta: '2026-10-05T12:00:00Z',
    tipo_evento: 'RATEIO', trecho: 'Resolvem celebrar o presente contrato de rateio.' };
  const review = { documento_id: row.id, decisao: 'confirmar_evento', categoria: 'RATEIO',
    motivo: 'contrato efetivamente celebrado', evidencia: row.trecho,
    fatos: { municipio: 'Alto Paraguai/MT', consorcio: 'CISCN', valor: 'R$ 200.010,82' },
    trecho_sha256: createHash('sha256').update(row.trecho).digest('hex') };
  const result = buildDashboardData({ archive: [row], events: [row], consortia: [], links: [],
    pendingIdentity: [{ documento_id: row.id, motivo: 'identidade ainda não extraída automaticamente' }],
    editorialReviews: [review] });
  assert.equal(result.stats.confirmed, 1);
  assert.equal(result.stats.pendingReview, 0);
  assert.equal(result.stats.pendingIdentity, 0);
  assert.equal(result.items[0].editorialReview.facts.valor, 'R$ 200.010,82');
  assert.equal(result.items[0].identityPending, '');
});

test('confirmação editorial prevalece sobre descarte automático antigo no painel', () => {
  const row = { id: 'proposta', titulo: 'Diário Oficial de Valinhos', fonte: 'Querido Diário',
    url: 'https://example.org/proposta', data_publicacao: '2026-09-29T00:00:00Z',
    primeira_coleta: '2026-10-01T00:00:00Z', ultima_coleta: '2026-10-02T00:00:00Z',
    tipo_evento: 'ADESÃO', situacao_analise: 'candidato', trecho: 'Proposta de ingresso aprovada pelo Conselho.' };
  const review = { documento_id: row.id, decisao: 'confirmar_evento', categoria: 'PROPOSTA DE ADESÃO',
    etapa: 'proposta aprovada; ingresso não comprovado', motivo: 'deliberação confirmada',
    evidencia: 'Conselho aprovou proposta',
    trecho_sha256: createHash('sha256').update(row.trecho).digest('hex') };
  const result = buildDashboardData({ archive: [row], events: [{ ...row, tipo_evento: review.categoria }],
    consortia: [], links: [], pendingIdentity: [], editorialReviews: [review],
    decisions: { proposta: { status: 'descartado', reason: 'regra automática antiga' } } });
  assert.equal(result.items[0].decisionStatus, 'confirmado');
  assert.equal(result.items[0].pendingReview, false);
  assert.equal(result.items[0].stage, review.etapa);
});

test('painel separa pendências reais de aceitos, correções intermediárias e duplicatas', () => {
  const make = (id) => ({ id, titulo: `Ato ${id} sobre consórcio`, fonte: 'Diário',
    url: `https://example.org/${id}`, trecho: `Consórcio público: ato ${id}.`,
    tipo_evento: 'CONTROLE', situacao_analise: 'candidato', ultima_coleta: '2026-10-08T12:00:00Z' });
  const rows = ['novo', 'aceito', 'corrigido', 'duplicado'].map(make);
  const review = (row, decisao) => ({ documento_id: row.id, decisao,
    motivo: 'revisão com fonte original', evidencia: row.trecho, categoria: 'CONTROLE',
    documento_relacionado: decisao === 'duplicata' ? 'aceito' : undefined,
    trecho_sha256: createHash('sha256').update(row.trecho).digest('hex') });
  const result = buildDashboardData({ archive: rows, events: rows.slice(0, 3),
    editorialReviews: [review(rows[1], 'confirmar_evento'), review(rows[2], 'corrigir_categoria'),
      review(rows[3], 'duplicata')], consortia: [], links: [], pendingIdentity: [] });
  assert.equal(result.stats.pendingReview, 2);
  assert.equal(result.stats.confirmed, 1);
  assert.equal(result.stats.duplicates, 1);
  assert.equal(result.items.find((row) => row.id === 'duplicado').editorialReview.relatedDocumentId, 'aceito');
});

test('painel expõe ano de ingresso distinto do ano da última evidência', () => {
  const participation = { consorcio_id: 'cidespa', municipio: 'Marcelândia/MT', ano_ingresso: '',
    ano_ultima_evidencia_participacao: '2026', fonte_ultima_evidencia: 'https://example.org/lei' };
  const data = buildDashboardData({ archive: [], events: [], links: [], pendingIdentity: [],
    consortia: [{ id: 'cidespa', nome: 'CIDESPA', documentos_vinculados: '1' }],
    participations: [participation] });
  assert.deepEqual(data.consortia[0].participations, [participation]);
});

test('painel mostra a página da prova recuperada de um PDF sem afirmar validação do evento', () => {
  const row = { id: 'pdf1', titulo: 'Diário Oficial de Dracena (SP)', fonte: 'Querido Diário',
    url: 'https://example.org/diario.pdf', trecho: 'Lei altera protocolo de intenções.',
    ultima_coleta: '2026-10-08T12:00:00Z' };
  const data = buildDashboardData({ archive: [row], events: [], links: [], pendingIdentity: [], consortia: [],
    pdfRecovery: [{ documento_id: 'pdf1', url: row.url, situacao: 'texto recuperado',
      trechos: [{ pagina: 2, coluna: 'direita', texto: 'Lei 5.302 ratifica alterações do protocolo do CISNAP.' }] }] });
  assert.equal(data.items[0].baseStatus, 'arquivo_bruto');
  assert.deepEqual(data.items[0].pdfEvidence, [{ page: 2, column: 'direita',
    text: 'Lei 5.302 ratifica alterações do protocolo do CISNAP.' }]);
  assert.equal(data.items[0].pdfEvidenceUrl, row.url);
});

test('data de edição do Querido Diário preenche a publicação quando o legado não guardou data', () => {
  const row = { id: 'antigo', titulo: 'Diário Oficial de Recife (PE)',
    url: 'https://data.queridodiario.ok.org.br/2611606/2026-08-20/edicao.pdf',
    data_publicacao: '', ultima_coleta: '2026-08-21T13:10:00Z', trecho: '' };
  const data = buildDashboardData({ archive: [row], events: [], links: [],
    pendingIdentity: [], consortia: [] });
  assert.equal(data.items[0].publishedAt, '2026-08-20T12:00:00Z');
});

test('revisão de legado prevalece sobre rótulo antigo e prioriza todas as páginas da prova', () => {
  const row = { id: 'recife', titulo: 'Diário Oficial do Recife', fonte: 'Querido Diário',
    url: 'https://example.org/recife.pdf', trecho: '', tipo_evento: 'ADESÃO',
    etapa: 'adesão concluída', situacao_analise: 'legado sem texto',
    ultima_coleta: '2026-10-08T12:00:00Z' };
  const review = { documento_id: row.id, decisao: 'confirmar_evento',
    categoria: 'ADESÃO EM TRAMITAÇÃO', etapa: 'PL aprovado; sanção não comprovada',
    motivo: 'segunda votação comprovada', evidencia: 'Ata da Câmara, pp. 45-46',
    fonte_evidencia: row.url, fatos: { paginas_pdf: [45, 46] },
    trecho_sha256: createHash('sha256').update('').digest('hex') };
  const snippets = [38, 45, 45, 45, 45, 46].map((pagina, index) =>
    ({ pagina, texto: `Menção distinta ${index}: consórcio intermunicipal.` }));
  const data = buildDashboardData({ archive: [row], events: [row], editorialReviews: [review],
    pdfRecovery: [{ documento_id: row.id, url: row.url, trechos: snippets }],
    links: [], pendingIdentity: [], consortia: [] });
  assert.equal(data.stats.legacyUnverifiedRecords, 0);
  assert.equal(data.items[0].category, 'ADESÃO EM TRAMITAÇÃO');
  assert.equal(data.items[0].stage, review.etapa);
  assert.deepEqual(data.items[0].pdfEvidence.slice(0, 2).map((snippet) => snippet.page), [45, 46]);
  assert.equal(data.items[0].editorialReview.evidenceUrl, row.url);
});

test('painel separa resultados brutos de documentos novos na última rodada', () => {
  const before = '2026-10-08T16:28:18.840Z';
  const after = '2026-10-08T22:04:12.553Z';
  const old = { id: 'old', titulo: 'Notícia antiga', primeira_coleta: '2026-10-08T12:00:00Z',
    ultima_coleta: after, trecho: 'Evento antigo' };
  const recent = { id: 'recent', titulo: 'Lei recente', primeira_coleta: '2026-10-08T20:00:00Z',
    ultima_coleta: after, trecho: 'Lei autoriza ingresso em consórcio.' };
  const data = buildDashboardData({ archive: [old, recent], events: [recent], consortia: [],
    links: [], pendingIdentity: [], runs: {
      earlier: { at: before, collected: 137, health: [] },
      latest: { at: after, collected: 133, health: [
        { name: 'Google News', itemCount: 27 }, { name: 'Querido Diário', itemCount: 37 },
        { name: 'Feeds RSS', itemCount: 19 }, { name: 'Scrapers web', itemCount: 50 },
      ] },
    } });
  assert.equal(data.collection.rawCollected, 133);
  assert.equal(data.collection.newDocuments, 1);
  assert.equal(data.collection.newCandidates, 1);
  assert.equal(data.collection.today.newDocuments, 2);
  assert.equal(data.collection.today.runs, 2);
  assert.equal(data.collection.today.day, '2026-10-08');
  assert.equal(data.collection.sources.reduce((sum, row) => sum + row.count, 0), 133);
  assert.ok(data.collection.sources.some((row) => row.name === 'SAPL'));
  assert.equal(data.lastCollectionAt, after);
});

test('catálogo de fontes distingue coleta ativa, prévia e fonte desativada', () => {
  const rows = dashboardSourceCatalog({
    rssFeeds: { enabled: true, feeds: [{ name: 'CIGA', url: 'https://example.org/feed', enabled: false }] },
    webScrapers: { enabled: true, publish: false, sites: [
      { name: 'TCE-MG', url: 'https://example.org/tce', publish: true },
      { name: 'AMM-MT', url: 'https://example.org/amm', publish: false },
    ] },
  });
  assert.equal(rows.find((row) => row.family === 'Feeds RSS').name, 'CIGA (feed RSS antigo)');
  assert.equal(rows.find((row) => row.name === 'TCE-MG').mode, 'Coleta ativa');
  assert.equal(rows.find((row) => row.name === 'AMM-MT').mode, 'Coleta em prévia');
  assert.equal(rows.filter((row) => row.enabled).length, 2);
});

test('rejeitados e legados sem texto não inflam possíveis achados nem novidade da rodada', () => {
  const before = '2026-10-08T16:00:00Z';
  const after = '2026-10-08T22:00:00Z';
  const make = (id, analysis) => ({ id, titulo: `Ato ${id}`, fonte: 'Diário',
    url: `https://example.org/${id}`, tipo_evento: 'ADESÃO', situacao_analise: analysis,
    primeira_coleta: '2026-10-08T20:00:00Z', ultima_coleta: after });
  const accepted = make('active', 'candidato — requer revisão');
  const rejected = make('rejected', 'rejeitado pela revisão automática');
  const legacy = make('legacy', 'legado sem texto — publicação antiga, requer conferência');
  const data = buildDashboardData({ archive: [accepted, rejected, legacy],
    events: [accepted, rejected, legacy], consortia: [], links: [], pendingIdentity: [],
    runs: { prior: { at: before }, last: { at: after, collected: 9 } } });
  assert.equal(data.stats.eventRecords, 3);
  assert.equal(data.stats.eventCandidates, 1);
  assert.equal(data.stats.rejectedEventRecords, 1);
  assert.equal(data.stats.legacyUnverifiedRecords, 1);
  assert.equal(data.collection.newCandidates, 1);
  assert.equal(data.collection.newDocuments, 3);
});

test('releitura do PDF corrige adesão confundida com alteração de protocolo e evita trechos duplicados', () => {
  const row = { id: 'dracena', titulo: 'Diário Oficial de Dracena (SP)', fonte: 'Querido Diário',
    url: 'https://example.org/diario.pdf', trecho: '', tipo_evento: 'ADESÃO',
    ultima_coleta: '2026-10-08T12:00:00Z' };
  const original = 'Ratifica as alterações realizadas no Protocolo de Intenções do Consórcio Intermunicipal de Serviços da Nova Alta Paulista - CISNAP, firmado entre este Município e o Consórcio Público.';
  const data = buildDashboardData({ archive: [row], events: [row], links: [],
    pendingIdentity: [], consortia: [], pdfRecovery: [{ documento_id: row.id, url: row.url,
      trechos: [{ pagina: 2, texto: original }, { pagina: 2, texto: `${original} Art. 2º A alteração integra o contrato.` }] }] });
  assert.equal(data.items[0].category, 'GOVERNANÇA');
  assert.equal(data.items[0].decisionStatus, 'revisao');
  assert.equal(data.items[0].pdfReassessment, true);
  assert.equal(data.items[0].pdfEvidence.length, 1);
  assert.match(data.items[0].reason, /não comprova nova adesão/);
});
