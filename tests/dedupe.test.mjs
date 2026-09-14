import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalUrl,
  enqueuePending,
  itemId,
  listPending,
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
