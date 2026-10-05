import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardData } from '../scripts/build-dashboard.mjs';

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
