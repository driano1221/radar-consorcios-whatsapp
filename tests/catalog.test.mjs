import test from 'node:test';
import assert from 'node:assert/strict';
import { catalogRecord, mergeCatalogRecord, mergeStateIntoCatalog } from '../src/lib/catalog.mjs';

const at = '2026-10-02T15:00:00.000Z';

test('lei que autoriza ingresso não vira participação confirmada', () => {
  const row = catalogRecord({ kind: 'gazette', title: 'LEI Nº 42/2026',
    url: 'https://diario.exemplo/lei/42', source: 'Diário Oficial',
    territoryName: 'Pains', stateCode: 'MG', classification: {
      category: 'ADESÃO AUTORIZADA', score: 12,
      evidenceText: 'Autoriza o ingresso de Pains no Consórcio Intermunicipal X.',
    } }, at, at);
  assert.equal(row.tipo_evento, 'ADESÃO AUTORIZADA');
  assert.equal(row.etapa, 'autorização — ingresso não comprovado');
  assert.equal(row.efeito_na_participacao, 'não inferido automaticamente');
  assert.equal(row.municipio, 'Pains');
});

test('projeto de lei continua identificado como proposta', () => {
  const row = catalogRecord({ kind: 'legislative', title: 'PROJETO DE LEI 14/2026: adesão ao consórcio',
    url: 'https://camara.exemplo/materia/14', classification: { category: 'ADESÃO', score: 9 } }, at, at);
  assert.equal(row.etapa, 'proposta — não aprovada');
});

test('publicação no WhatsApp não equivale a confirmação manual', () => {
  const item = { title: 'Consórcio X', url: 'https://portal.exemplo/1',
    classification: { category: 'GOVERNANÇA', score: 10, evidenceText: 'Ata de assembleia.' } };
  const old = catalogRecord(item, at, at, at);
  const richer = catalogRecord({ ...item, kind: 'gazette',
    classification: { ...item.classification, evidenceText: 'Ata de assembleia do consórcio com alteração do estatuto.' } }, at, at);
  const merged = mergeCatalogRecord(old, richer);
  assert.match(merged.situacao_analise, /não confirmado manualmente/);
  assert.match(merged.trecho, /alteração do estatuto/);
});

test('mesma URL de versões históricas é consolidada e rejeição posterior prevalece', () => {
  const url = 'https://portal.exemplo/ato/1';
  const item = { kind: 'gazette', title: 'Ato sobre consórcio', url,
    classification: { category: 'RATEIO', score: 10, evidenceText: 'Contrato de rateio celebrado.' } };
  const map = new Map();
  mergeStateIntoCatalog(map, { observations: { x: { item, firstSeenAt: at, lastSeenAt: at } } });
  mergeStateIntoCatalog(map, { observations: { x: { item: { ...item,
    aiReview: { status: 'rejected' } }, firstSeenAt: at, lastSeenAt: at } } });
  assert.equal(map.size, 1);
  assert.match([...map.values()][0].situacao_analise, /rejeitado/);
});

test('envio antigo sem evidência não vira fato confirmado nem supera triagem atual', () => {
  const url = 'https://portal.exemplo/agenda';
  const map = new Map();
  const old = { seen: { x: { url, title: 'Consórcio cria agenda de reuniões',
    category: 'CRIAÇÃO', sentAt: at } } };
  mergeStateIntoCatalog(map, old);
  assert.match([...map.values()][0].situacao_analise, /legado sem texto/);
  mergeStateIntoCatalog(map, { observations: { x: { item: { title: old.seen.x.title, url,
    source: 'Portal', summary: 'O consórcio existente cria agenda de reuniões.',
    classification: { category: 'CRIAÇÃO', score: 12 } }, firstSeenAt: at, lastSeenAt: at } } });
  assert.equal([...map.values()][0].tipo_evento, 'GERAL');
});
