import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveGeography } from '../dashboard/src/geography-model.mjs';

test('orientação nacional não herda UF do portal que a reproduziu', () => {
  const result = resolveGeography({ uf: 'AL', abrangencia: 'nacional' });
  assert.deepEqual(result.ufs, []);
  assert.equal(result.scope, 'nacional');
});

test('UF explícita, múltiplas UFs e revisão editorial prevalecem sobre o domínio', () => {
  assert.deepEqual(resolveGeography({ uf: 'MG', titulo: 'Consórcio publicado' }).ufs, ['MG']);
  assert.deepEqual(resolveGeography({ titulo: 'Rio Negro (PR) e Mafra (SC) discutem transporte' }).ufs, ['PR', 'SC']);
  assert.deepEqual(resolveGeography({ titulo: 'Umuarama ratifica protocolo' }, {
    url: 'https://news.google.com/rss/articles/abc', editorialReview: { facts: { municipio: 'Umuarama/PR' } },
  }).ufs, ['PR']);
});

test('domínio oficial e texto com Estado explícito fornecem UF rastreável', () => {
  assert.deepEqual(resolveGeography({ titulo: 'Licitação do consórcio' }, {
    url: 'https://www.tce.mg.gov.br/noticia/123',
  }), { ufs: ['MG'], basis: 'domínio oficial', evidence: 'www.tce.mg.gov.br' });
  const recovered = resolveGeography({ titulo: 'Consórcio de saúde recebe equipamento' }, {
    fullText: 'O consórcio de Birigui (SP) recebeu um equipamento nesta semana.',
  });
  assert.equal(recovered.ufs[0], 'SP');
  assert.equal(recovered.basis, 'trecho da publicação');
});

test('não confunde município chamado Mato Grosso com a UF de mesmo nome', () => {
  assert.deepEqual(resolveGeography({ titulo: 'TCE rejeita contas das Câmaras de Igaracy e Mato Grosso' }).ufs, []);
  assert.deepEqual(resolveGeography({ titulo: 'Ato do consórcio no Mato Grosso do Sul' }).ufs, ['MS']);
  assert.deepEqual(resolveGeography({ titulo: 'Ato publicado' }, {}, {
    ufs: ['PB'], evidence: 'O Tribunal de Contas da Paraíba julgou as contas.',
  }).ufs, ['PB']);
});
