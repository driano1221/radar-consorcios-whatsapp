import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalUrl,
  enqueuePending,
  itemId,
  listPending,
  reclassifyPending,
  markPendingFailure,
  markSeen,
  selectUnseen,
} from '../src/lib/dedupe.mjs';

test('remove parâmetros de rastreamento da URL', () => {
  assert.equal(
    canonicalUrl('https://exemplo.gov.br/noticia?id=1&utm_source=x#topo'),
    'https://exemplo.gov.br/noticia?id=1',
  );
});

test('não seleciona item já enviado', () => {
  const item = { title: 'Novo consórcio intermunicipal', url: 'https://exemplo.gov.br/1' };
  const state = { version: 1, seen: {} };
  item.id = itemId(item);
  markSeen(state, item);
  assert.equal(selectUnseen([{ ...item }], state).length, 0);
});

test('elimina cobertura equivalente publicada em outro endereço', () => {
  const original = {
    title: 'Campo Belo autoriza saída do CISMARG',
    summary: 'Lei municipal autoriza retirada do consórcio de saúde do Alto Rio Grande.',
    url: 'https://fonte-a.gov.br/noticia',
    classification: { category: 'SAÍDA' },
  };
  const state = { version: 2, seen: {} };
  original.id = itemId(original);
  markSeen(state, original);
  const republicado = {
    title: 'Saída do CISMARG é autorizada por Campo Belo',
    summary: 'Lei municipal autoriza retirada do consórcio de saúde do Alto Rio Grande.',
    url: 'https://fonte-b.com.br/materia',
    classification: { category: 'SAÍDA' },
  };
  assert.equal(selectUnseen([republicado], state).length, 0);
});

test('mesma página original não reaparece com outro link do Google', () => {
  const original = { title: 'Consórcio publica decisão', url: 'https://news.google.com/rss/articles/um',
    articleUrl: 'https://portal.gov.br/noticia/123', classification: { category: 'GOVERNANÇA', score: 8 } };
  const state = { seen: {}, pending: {} };
  markSeen(state, original);
  const republicado = { ...original, title: 'Decisão do consórcio em destaque',
    url: 'https://news.google.com/rss/articles/dois', publishedAt: '2026-10-09T12:00:00Z' };
  assert.equal(selectUnseen([republicado], state).length, 0);
});

test('mesma lei municipal em fontes diferentes compartilha identidade de evento', () => {
  const original = { title: 'Lei 3.309/2026 autoriza ingresso de Centenário do Sul no CISPAR',
    url: 'https://camara.pr.leg.br/lei/3309',
    classification: { category: 'ADESÃO AUTORIZADA', score: 10,
      evidenceText: 'Lei 3.309/2026 autoriza o ingresso do Município de Centenário do Sul no CISPAR.' } };
  const state = { seen: {}, pending: {} };
  markSeen(state, original);
  const otherSource = { title: 'Autorizado ingresso de Centenário do Sul no consórcio',
    url: 'https://jornal.com.br/centenario', publishedAt: '2026-10-09T12:00:00Z',
    classification: { category: 'ADESÃO AUTORIZADA', score: 9,
      evidenceText: 'O Município de Centenário do Sul foi autorizado pela Lei nº 3309/2026 a ingressar no CISPAR.' } };
  assert.equal(selectUnseen([otherSource], state).length, 0);
  const anotherCity = { ...otherSource, url: 'https://jornal.com.br/outra-cidade',
    title: 'Autorizado ingresso do Município de Pinhais no consórcio',
    classification: { ...otherSource.classification,
      evidenceText: 'O Município de Pinhais foi autorizado pela Lei nº 3309/2026 a ingressar no CISPAR.' } };
  assert.equal(selectUnseen([anotherCity], state).length, 1);
});

test('não reenvia o mesmo fato quando IA corrige categoria e a fonte muda de nome', () => {
  const original = {
    title: 'Consórcio Intermunicipal cria agenda setorial com Brasília para atrair investimentos - Diário do Grande ABC',
    summary: 'Consórcio Intermunicipal cria agenda setorial com Brasília para atrair investimentos Diário do Grande ABC',
    source: 'Diário do Grande ABC', publishedAt: '2026-09-22T19:00:00Z',
    url: 'https://news.google.com/rss/articles/antigo',
    classification: { category: 'CRIAÇÃO' },
  };
  const state = { seen: {}, pending: {} };
  markSeen(state, original, '2026-09-22T22:25:00Z');
  const corrected = {
    ...original,
    title: 'Consórcio Intermunicipal cria agenda setorial com Brasília para atrair investimentos - dgabc.com.br',
    summary: 'Consórcio Intermunicipal cria agenda setorial com Brasília para atrair investimentos dgabc.com.br',
    source: 'dgabc.com.br', url: 'https://news.google.com/rss/articles/novo',
    classification: { category: 'ATUAÇÃO' },
  };
  assert.equal(selectUnseen([corrected], state).length, 0);
  assert.equal(selectUnseen([{ ...corrected, publishedAt: '2026-10-20T19:00:00Z' }], state).length, 1);
});

test('mantém candidato em fila até a confirmação do envio', () => {
  const state = { version: 3, seen: {}, pending: {}, session: {} };
  const item = {
    title: 'Município adere ao consórcio público regional',
    url: 'https://exemplo.gov.br/adesao',
    classification: { category: 'ADESÃO', score: 12 },
  };
  const fresh = selectUnseen([item], state);
  assert.equal(enqueuePending(state, fresh, '2026-09-14T12:00:00.000Z'), 1);
  assert.equal(listPending(state).length, 1);
  assert.equal(selectUnseen([{ ...item }], state).length, 0);
  markPendingFailure(state, fresh, new Error('sessão desconectada'), '2026-09-14T13:00:00.000Z');
  assert.equal(Object.values(state.pending)[0].attempts, 1);
  markSeen(state, fresh[0], '2026-09-14T14:00:00.000Z');
  assert.equal(listPending(state).length, 0);
  assert.equal(Object.keys(state.seen).length, 1);
});

test('reclassifica a fila antiga e descarta proposta sem aprovação', () => {
  const proposal = { kind: 'gazette', title: 'Diário Oficial de Valinhos (SP)',
    summary: 'Apresentação da proposta para ingresso ao SAMU Regional através de consórcio intermunicipal.',
    url: 'https://exemplo.gov.br/proposta', classification: { category: 'ADESÃO', score: 11 } };
  const approved = { kind: 'gazette', title: 'Diário Oficial de Município (MG)',
    summary: 'Lei autoriza a adesão do Município ao Consórcio Intermunicipal de Saúde.',
    url: 'https://exemplo.gov.br/lei', classification: { category: 'GERAL', score: 0 } };
  const state = { pending: { [itemId(proposal)]: { item: proposal },
    [itemId(approved)]: { item: approved } } };
  assert.equal(reclassifyPending(state), 1);
  assert.equal(listPending(state).length, 1);
  assert.equal(listPending(state)[0].classification.category, 'ADESÃO AUTORIZADA');
});
