import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResults } from '../dashboard/src/results-model.mjs';

const data = {
  lastCollectionAt: '2026-10-13T12:00:00Z',
  consortia: [
    { id: 'c1', name: 'Consórcio Um', alias: 'CU', cnpj: '12345678000190' },
    { id: 'c2', name: 'Consórcio Dois', cnpj: '' },
  ],
  items: [
    { id: 'f1', firstSeenAt: '2026-10-13T10:00:00Z', links: [{ consortiumId: 'c1' }], editorialReview: { facts: { municipio: 'Cidade/PR' } } },
    { id: 'f2', firstSeenAt: '2026-09-02T10:00:00Z', links: [{ consortiumId: 'c2' }], editorialReview: { facts: {} } },
    { id: 'f3', firstSeenAt: '2026-10-12T10:00:00Z', links: [], editorialReview: { facts: { municipio: 'Outra/SP', consorcio: 'Consórcio avulso' } } },
  ],
  baseTables: [
    { id: 'eventos', rows: [
      { id: 'f1', primeira_coleta: '2026-10-13T10:00:00Z', decisao_base: 'confirmado', tipo_evento: 'ATUAÇÃO', mes_fato: '2026-05', fonte: 'Fonte A' },
      { id: 'f2', primeira_coleta: '2026-09-02T10:00:00Z', decisao_base: 'confirmado', tipo_evento: 'RATEIO', data_fato: '2026-09-01', fonte: 'Fonte B', uf: 'MG' },
      { id: 'f3', primeira_coleta: '2026-10-12T10:00:00Z', decisao_base: 'confirmado', tipo_evento: 'ATUAÇÃO', data_noticia_original: '2026-10-10T12:00:00Z', fonte: 'Fonte A' },
      { id: 'bad', primeira_coleta: '2026-10-13T10:00:00Z', decisao_base: 'candidato', tipo_evento: 'ATUAÇÃO', fonte: 'Fonte A' },
    ] },
    { id: 'participacoes', rows: [
      { documento_id: 'f1', municipio: 'Cidade/PR' },
      { documento_id: 'f2', municipio: 'Outra/MG' },
    ] },
  ],
};

test('all-time results count only confirmed facts and documented identities', () => {
  const result = buildResults(data);
  assert.equal(result.confirmedCount, 3);
  assert.equal(result.consortiaCount, 2);
  assert.equal(result.cnpjCount, 1);
  assert.equal(result.municipalityCount, 2);
  assert.equal(result.breakdowns.categories[0].count, 2);
  assert.equal(result.buckets.find((bucket) => bucket.key === '2026-10').count, 2);
});

test('discovery and occurrence are different timelines; month-only facts stay honest', () => {
  const discovered = buildResults(data, { period: '7d', mode: 'discovery' });
  assert.equal(discovered.confirmedCount, 2);
  assert.equal(discovered.consortiaCount, 1);
  assert.equal(discovered.cnpjCount, 1);
  assert.equal(discovered.municipalityCount, 1);
  assert.equal(discovered.buckets.find((bucket) => bucket.key === '2026-10-13').count, 1);

  const occurred = buildResults(data, { period: '7d', mode: 'occurrence' });
  assert.equal(occurred.confirmedCount, 1);
  assert.equal(occurred.buckets.find((bucket) => bucket.key === '2026-10-10').count, 1);
  assert.equal(occurred.consortiaCount, 1); // Identity cards always follow discovery.
  assert.equal(occurred.municipalityCount, 1);

  const allOccurrence = buildResults(data, { mode: 'occurrence' });
  assert.equal(allOccurrence.buckets.find((bucket) => bucket.key === '2026-05').count, 1);
  assert.equal(allOccurrence.undated, 0);
});

test('candidate facts and dates without proof never become occurrence statistics', () => {
  const withoutOriginal = structuredClone(data);
  withoutOriginal.baseTables[0].rows[2].data_noticia_original = '';
  assert.equal(buildResults(withoutOriginal, { period: '7d', mode: 'occurrence' }).confirmedCount, 0);
  assert.equal(buildResults(withoutOriginal, { mode: 'occurrence' }).undated, 1);
});
