import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFeed } from '../src/lib/sources/rss-feeds.mjs';
import { fetchQueridoDiario, mergeGazettes } from '../src/lib/sources/querido-diario.mjs';
import { parseGoogleNewsRss } from '../src/lib/sources/google-news.mjs';

test('preserva a URL e o domínio da fonte original do Google Notícias', () => {
  const xml = `<?xml version="1.0"?><rss><channel><item>
    <title>Consórcio público aprova novo contrato de rateio</title>
    <link>https://news.google.com/rss/articles/exemplo</link>
    <pubDate>Fri, 21 Aug 2026 12:00:00 GMT</pubDate>
    <description>Notícia resumida.</description>
    <source url="https://www.tce.mg.gov.br">TCE-MG</source>
  </item></channel></rss>`;
  const items = parseGoogleNewsRss(xml, new Date('2026-08-20T00:00:00Z'));
  assert.equal(items.length, 1);
  assert.equal(items[0].source, 'TCE-MG');
  assert.equal(items[0].sourceUrl, 'https://www.tce.mg.gov.br');
});

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

test('Querido Diário limita consultas simultâneas e preserva falhas parciais', async () => {
  let active = 0;
  let peak = 0;
  const result = await fetchQueridoDiario({ enabled: true, retries: 0, maxConcurrent: 2,
    queryGroups: [['termo1'], ['termo2'], ['termo3']] }, new Date('2026-10-01'), async (url) => {
    active += 1;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, 1));
    active -= 1;
    if (url.includes('termo2')) return new Response('', { status: 503 });
    return Response.json({ gazettes: [{ url, territory_id: url, territory_name: 'Exemplo',
      state_code: 'MG', date: '2026-10-01', excerpts: ['consórcio intermunicipal'] }] });
  });
  assert.equal(peak, 2);
  assert.equal(result.items.length, 2);
  assert.equal(result.diagnostics[1].status, 'error');
  assert.equal(result.degraded, true);
});

test('Querido Diário recupera resposta transitória 503 sem duplicar itens', async () => {
  let calls = 0;
  const result = await fetchQueridoDiario({ enabled: true, retries: 1,
    queryGroups: [['consórcio']] }, new Date('2026-10-01'), async () => {
    calls += 1;
    return calls === 1 ? new Response('', { status: 503 }) : Response.json({ gazettes: [{
      url: 'https://exemplo.gov.br/ato.pdf', territory_id: '1', territory_name: 'Exemplo',
      state_code: 'MG', date: '2026-10-01', excerpts: ['consórcio intermunicipal'],
    }] });
  });
  assert.equal(calls, 2);
  assert.equal(result.items.length, 1);
  assert.equal(result.ok, true);
  assert.equal(result.degraded, false);
});
