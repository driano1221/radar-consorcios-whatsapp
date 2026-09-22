import test from 'node:test';
import assert from 'node:assert/strict';
import { presentItem, shortenLongUrl } from '../src/lib/message-presentation.mjs';
import { formatWhatsAppMessage } from '../src/lib/format.mjs';

const clipped = {
  kind: 'news',
  title: 'Legislação - Autoriza o ingresso do Município de Centenário do Sul no Consórcio Intermunicipal de Saneamento d... - Câmara Municipal de Centenário do Sul',
  summary: 'Legislação - Autoriza o ingresso do Município de Centenário do Sul no Consórcio Intermunicipal de Saneamento d...',
  url: 'https://news.google.com/rss/articles/' + 'A'.repeat(250),
  sourceUrl: 'https://www.centenariodosul.pr.leg.br',
  source: 'Câmara Municipal de Centenário do Sul',
  publishedAt: '2026-09-21T12:04:22Z',
  classification: { category: 'ADESÃO', emoji: '🟦' },
};

test('ementa da Câmara substitui título cortado e fornece link oficial curto', async () => {
  const ementa = 'Autoriza o ingresso do Município de Centenário do Sul no Consórcio Intermunicipal de Saneamento do Paraná (CISPAR), bem como ratifica o seu Contrato de Consórcio Público e o seu Estatuto Social.';
  const html = `<table><tr><td>3309/2026</td><td>${ementa}</td><td><a href="/legislacao/detalhe/1339/slug-longo/">Detalhes</a></td></tr></table>`;
  const fetchImpl = async (url) => new Response(String(url).endsWith('/legislacao') ? html : `<article>${ementa}</article>`);
  const item = await presentItem(clipped, {}, fetchImpl);
  assert.equal(item.presentationTitle, 'Centenário do Sul autoriza ingresso no CISPAR');
  assert.equal(item.displayUrl, 'https://www.centenariodosul.pr.leg.br/legislacao/detalhe/1339');
  assert.equal(item.url, clipped.url);
  const message = formatWhatsAppMessage(item);
  assert.match(message, /Acesse a legislação oficial/);
  assert.match(message, /ratifica o seu Contrato/);
  assert.doesNotMatch(message, /d\.\.\.|news\.google\.com/);
});

test('quando a fonte oficial falha, título editorial não repete trecho cortado', async () => {
  const item = await presentItem(clipped, {}, async () => { throw new Error('indisponível'); });
  const message = formatWhatsAppMessage(item);
  assert.match(message, /Centenário do Sul autoriza ingresso em consórcio intermunicipal/);
  assert.doesNotMatch(message, /d\.\.\./);
});

test('encurtador é opcional, usa cache e preserva o original em falha', async () => {
  const long = 'https://news.google.com/rss/articles/' + 'B'.repeat(250);
  const cache = {};
  let calls = 0;
  const fetchImpl = async (_, options) => {
    calls += 1;
    assert.equal(options.method, 'POST');
    assert.equal(new URLSearchParams(options.body).get('url'), long);
    return Response.json({ result_url: 'https://cleanuri.com/abc123' });
  };
  assert.equal(await shortenLongUrl(long, cache, fetchImpl), 'https://cleanuri.com/abc123');
  assert.equal(await shortenLongUrl(long, cache, fetchImpl), 'https://cleanuri.com/abc123');
  assert.equal(calls, 1);
  assert.equal(await shortenLongUrl(long, {}, async () => new Response('', { status: 503 })), long);
  assert.equal(await shortenLongUrl(long, {}, async (url) => String(url).includes('cleanuri.com')
    ? new Response('', { status: 503 }) : Response.json({ shorturl: 'https://is.gd/Qwert1' })), 'https://is.gd/Qwert1');
});
