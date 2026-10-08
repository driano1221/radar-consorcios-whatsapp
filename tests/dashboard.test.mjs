import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { buildDashboardData, contentQuality } from '../scripts/build-dashboard.mjs';

test('painel distingue ausência de texto de um trecho disponível', () => {
  assert.equal(contentQuality('Consórcio abre concurso - Portal', 'Consórcio abre concurso Portal'), 'apenas_titulo');
  assert.equal(contentQuality('Consórcio abre concurso', ''), 'sem_trecho');
  assert.equal(contentQuality('Consórcio abre concurso', 'O edital do concurso prevê onze vagas e inscrições até outubro.'), 'trecho_disponivel');
});

test('painel expõe falhas da última coleta sem confundir fonte desativada com erro', () => {
  const row = { id: 'titulo', titulo: 'Consórcio abre concurso - Portal', trecho: 'Consórcio abre concurso Portal',
    fonte: 'Portal', url: 'https://example.org', ultima_coleta: '2026-10-05T13:00:00Z' };
  const result = buildDashboardData({ archive: [row], events: [], consortia: [], links: [], pendingIdentity: [],
    sourceHealth: { Portal: { name: 'Portal', status: 'error', checkedAt: '2026-10-05T13:00:00Z', message: 'Timeout' },
      Outra: { name: 'Outra', status: 'disabled', checkedAt: '2026-10-05T13:00:00Z' } } });
  assert.equal(result.stats.insufficientContent, 1);
  assert.equal(result.items[0].contentQuality, 'apenas_titulo');
  assert.equal(result.collectionHealth[0].message, 'Timeout');
  assert.equal(result.collectionHealth[1].status, 'disabled');
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
  assert.equal(result.stats.pendingIdentity, 0);
  assert.equal(result.items[0].editorialReview.facts.valor, 'R$ 200.010,82');
  assert.equal(result.items[0].identityPending, '');
});

test('painel expõe ano de ingresso distinto do ano da última evidência', () => {
  const participation = { consorcio_id: 'cidespa', municipio: 'Marcelândia/MT', ano_ingresso: '',
    ano_ultima_evidencia_participacao: '2026', fonte_ultima_evidencia: 'https://example.org/lei' };
  const data = buildDashboardData({ archive: [], events: [], links: [], pendingIdentity: [],
    consortia: [{ id: 'cidespa', nome: 'CIDESPA', documentos_vinculados: '1' }],
    participations: [participation] });
  assert.deepEqual(data.consortia[0].participations, [participation]);
});
