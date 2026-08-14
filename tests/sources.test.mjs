import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed } from '../src/lib/sources/rss-feeds.mjs';
import { mergeGazettes } from '../src/lib/sources/querido-diario.mjs';

test('lê RSS e ignora publicação fora da janela', () => {
  const xml = `<?xml version="1.0"?><rss><channel>
    <item><title>Município adere ao consórcio</title><link>https://exemplo.gov.br/1</link>
    <pubDate>Fri, 14 Aug 2026 12:00:00 GMT</pubDate><description>Adesão aprovada.</description></item>
    <item><title>Antiga</title><link>https://exemplo.gov.br/2</link>
    <pubDate>Fri, 01 Jan 2021 12:00:00 GMT</pubDate></item>
  </channel></rss>`;
  const items = parseFeed(
    xml,
    { name: 'Fonte oficial' },
    new Date('2026-08-10T00:00:00Z'),
  );
  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'Fonte oficial');
  assert.equal(items[0].title, 'Município adere ao consórcio');
});

test('mescla excertos repetidos do mesmo diário', () => {
  const base = { url: 'https://exemplo.gov.br/ato.pdf', territory_id: '1', date: '2026-08-14' };
  const merged = mergeGazettes([
    [{ ...base, excerpts: ['adesão ao consórcio'] }],
    [{ ...base, excerpts: ['adesão ao consórcio', 'contrato de rateio'] }],
  ]);
  assert.equal(merged.length, 1);
  assert.deepEqual(merged[0].excerpts, ['adesão ao consórcio', 'contrato de rateio']);
});
