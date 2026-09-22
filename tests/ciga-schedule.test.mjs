import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCigaArticle, fetchCiga } from '../src/lib/sources/ciga.mjs';
import { shouldCollect } from '../scripts/should-collect.mjs';

test('CIGA usa a data editorial, não a data de migração da API', () => {
  const config = { baseUrl: 'https://consorciociga.gov.br' };
  const row = { tipo: 'noticia', titulo: 'CIGA aprova adesão municipal', slug: 'ciga-aprova-adesao',
    data: '2026-09-20', publishedAt: '2026-09-22T00:00:00Z', corpo: 'Assembleia aprova entrada.' };
  const item = parseCigaArticle(row, config, new Date('2026-09-19'), new Date('2026-09-22'));
  assert.equal(item.publishedAt, '2026-09-20T12:00:00-03:00');
  assert.equal(item.url, 'https://consorciociga.gov.br/blog/noticias/ciga-aprova-adesao');
  assert.equal(parseCigaArticle({ ...row, data: '2026-04-02' }, config, new Date('2026-09-19')), null);
});

test('CIGA valida resposta da API e encerra ao alcançar registros antigos', async () => {
  let requests = 0;
  const config = { enabled: true, baseUrl: 'https://consorciociga.gov.br', retries: 0 };
  const result = await fetchCiga(config, new Date('2026-09-19'), async () => {
    requests += 1;
    return Response.json({ data: [
      { tipo: 'noticia', titulo: 'Consórcio aprova novo protocolo', slug: 'novo-protocolo', data: '2026-09-20' },
      { tipo: 'noticia', titulo: 'Antiga', slug: 'antiga', data: '2026-04-02' },
    ], meta: { pagination: { pageCount: 5 } } });
  });
  assert.equal(requests, 1);
  assert.equal(result.items.length, 1);
  assert.equal(result.diagnostics[0].status, 'ok');
  await assert.rejects(() => fetchCiga(config, new Date(), async () => Response.json({ message: 'erro' })), /formato inesperado/);
});

test('execução redundante é dispensada durante 50 minutos', () => {
  const now = new Date('2026-09-22T20:00:00Z');
  assert.equal(shouldCollect({ runs: {} }, now), true);
  assert.equal(shouldCollect({ runs: { a: { at: '2026-09-22T19:30:00Z' } } }, now), false);
  assert.equal(shouldCollect({ runs: { a: { at: '2026-09-22T19:00:00Z' } } }, now), true);
});
