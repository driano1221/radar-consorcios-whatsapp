import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyItem } from '../src/lib/classifier.mjs';

test('classifica adesão real ao consórcio', () => {
  const result = classifyItem({
    title: 'Município aprova adesão ao consórcio intermunicipal',
    summary: 'A lei autoriza o ingresso do município no consórcio público regional.',
  });
  assert.equal(result.category, 'ADESÃO');
  assert.ok(result.score >= 4);
});

test('penaliza adesão a ata de registro de preços', () => {
  const result = classifyItem({
    title: 'Adesão a ata de registro de preços',
    summary: 'Ata gerenciada por consórcio intermunicipal para aquisição de veículos.',
  });
  assert.ok(result.score < 4);
});

test('prioriza dissolução como crise', () => {
  const result = classifyItem({
    title: 'Prefeitos discutem dissolução do consórcio público',
    summary: 'A assembleia avaliará a liquidação do consórcio intermunicipal.',
  });
  assert.equal(result.category, 'CRISE');
  assert.ok(result.score >= 7);
});

test('reconhece contrato de rateio', () => {
  const result = classifyItem({
    title: 'Município publica contrato de rateio',
    summary: 'Contrato de rateio celebrado com o consórcio intermunicipal de saúde.',
  });
  assert.equal(result.category, 'RATEIO');
});

test('rejeita consórcio empresarial em licitação', () => {
  const result = classifyItem({
    kind: 'news',
    title: 'Consórcio de empresas vence licitação de rodovia',
    summary: 'O consórcio vencedor assinou contrato com o governo estadual.',
    url: 'https://exemplo.com/licitacao',
  });
  assert.ok(result.score < 5);
  assert.match(result.reasons.join(' '), /consórcio empresarial/);
});

test('reconhece fiscalização de consórcio público', () => {
  const result = classifyItem({
    kind: 'news',
    title: 'Tribunal de Contas inicia auditoria em consórcio intermunicipal',
    summary: 'A fiscalização avaliará irregularidades na associação pública de municípios.',
    url: 'https://tce-exemplo.gov.br/noticia',
  });
  assert.equal(result.category, 'CONTROLE');
  assert.ok(result.score >= 7);
});

test('rejeita consórcio comercial sem contexto intermunicipal', () => {
  const result = classifyItem({
    kind: 'news',
    title: 'Novo consórcio assume passeio de barco em atração turística',
    summary: 'Grupo assume a operação dos serviços aos visitantes.',
    url: 'https://noticias.example/turismo',
  });
  assert.ok(result.score < 5);
});

test('não confunde cláusula de extinção em anexo com crise atual', () => {
  const abertura =
    'Ratificação do protocolo de intenções para participação do Município no consórcio intermunicipal. ';
  const result = classifyItem({
    kind: 'gazette',
    title: 'Diário Oficial de Exemplo',
    summary: `${abertura}${'cooperação regional '.repeat(120)} cláusula sobre extinção do consórcio.`,
    url: 'https://exemplo.gov.br/ato.pdf',
  });
  assert.equal(result.category, 'ADESÃO');
});

test('penaliza previsão orçamentária genérica de rateio', () => {
  const result = classifyItem({
    kind: 'gazette',
    title: 'Diário Oficial de Exemplo',
    summary:
      'A Lei Orçamentária reservará recursos para transferências a consórcios públicos em conformidade com o respectivo contrato de rateio.',
    url: 'https://exemplo.gov.br/orcamento.pdf',
  });
  assert.ok(result.score < 5);
});
