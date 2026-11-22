import test from 'node:test';
import assert from 'node:assert/strict';
import { weeklyContext } from '../src/lib/weekly-context.mjs';
import { formatWeeklyMessages } from '../src/lib/format.mjs';

const item = { kind: 'gazette', title: 'CONVÊNIO Nº 004/2030', publishedAt: '2030-11-18T12:00:00Z',
  url: 'https://exemplo.gov.br/ato', source: 'Diário municipal', stateCode: 'PR',
  classification: { category: 'ATUAÇÃO', stage: 'instrumento publicado; execução e pagamento não comprovados' } };

test('semanal identifica consórcio sem sigla, município e objeto antes de remover a íntegra', () => {
  const body = 'O MUNICÍPIO DE BALSA NOVA E O CONSÓRCIO INTERGESTORES PARANÁ SAÚDE COM VISTAS A COOPERAÇÃO. ' +
    'CLÁUSULA PRIMEIRA: DO OBJETO - O termo prevê aquisição e distribuição de medicamentos essenciais aos usuários do SUS. ' +
    'CLÁUSULA SEGUNDA: DO COMPROMISSO DAS PARTES - Repassar recursos. Agência 0000, conta 1234.';
  const context = weeklyContext(item, {}, body);
  assert.deepEqual(context.consortia, ['CONSÓRCIO INTERGESTORES PARANÁ SAÚDE']);
  assert.equal(context.location, 'BALSA NOVA/PR');
  const report = { start: '2030-11-16T12:00:00Z', end: '2030-11-23T12:00:00Z', events: 1,
    highlights: [{ ...item, weeklyContext: context }] };
  const before = JSON.stringify(report);
  const text = formatWeeklyMessages(report).join('\n');
  assert.match(text, /aquisição e distribuição de medicamentos/);
  assert.match(text, /execução e pagamento não comprovados/);
  assert.doesNotMatch(text, /Agência|conta 1234/);
  assert.equal(JSON.stringify(report), before);
});

test('identifica o autor municipal da lei antes do anexo e mantém alteração como alteração', () => {
  const body = 'O PREFEITO MUNICIPAL DE NOVO MUNDO, Estado de Mato Grosso, sanciona: ' +
    'Art. 13 da Lei Orgânica. Art. 1º Fica ratificado o Termo de Alteração do Protocolo de Intenções, ' +
    'constante do Anexo Único, do Consórcio Intermunicipal de Desenvolvimento Sustentável Portal da Amazônia - CIDESPA. ' +
    'Art. 2º Integra o Estatuto. ANEXO I PROTOCOLO DE INTENÇÕES ' +
    'O consórcio tem sede no Município de Colíder. Município de Outro Lugar.';
  const context = weeklyContext({ ...item, title: 'Lei nº 746/2030', classification: { category: 'GOVERNANÇA' } }, { uf: 'MT' }, body);
  assert.equal(context.location, 'NOVO MUNDO/MT');
  assert.match(context.consortia[0], /Portal da Amazônia \(CIDESPA\)/);
  assert.match(context.description, /^Fica ratificado o Termo de Alteração/);
  assert.doesNotMatch(context.description, /Art\. 13|Colíder|Outro Lugar|Integra o Estatuto/);
});

test('separa retificação do mesmo rateio, sem expor o valor substituído como vigente', () => {
  const context = weeklyContext({ ...item, title: 'Retificação do Contrato de Rateio nº 10/2030',
    classification: { category: 'RATEIO' } }, { uf: 'MT' },
  'Consórcio Intermunicipal de Saúde Regional – CISR e Município de Campos de Júlio-MT: ' +
  'Onde se lê: "R$ 386.425,10". Leia-se: "bens e serviços; R$ 386.142,05; assinatura em 01/10/2030." Ratificam-se os demais termos.');
  assert.match(context.title, /^Retificação do Contrato de Rateio/);
  assert.equal(context.location, 'Campos de Júlio/MT');
  assert.match(context.description, /386\.142,05/);
  assert.doesNotMatch(context.description, /386\.425,10/);
  assert.deepEqual(context.values, []);
});

test('preserva o nome AMVAP Saúde e o aditivo, sem incorporar CNPJ na sigla', () => {
  const body = '3º Termo Aditivo ao Contrato de Rateio nº 12/2030, firmado entre o ' +
    'Consórcio Público Intermunicipal de Saúde do Triângulo Mineiro – AMVAP SAÚDE, inscrito no CNPJ nº 00.000.000/0000-00, ' +
    'e o Município de Gurinhatã/MG. Objeto: acréscimo do valor disposto na Cláusula Quarta; alteração do Anexo Único. ' +
    'Valor acrescido no aditivo: R$ 180.000,00. Valor total do contrato de rateio: R$ 935.586,80.';
  const context = weeklyContext({ ...item, title: body.slice(0, 62), classification: { category: 'RATEIO' } }, {}, body);
  assert.match(context.consortia[0], /\(AMVAP SAÚDE\)$/);
  assert.match(context.title, /3º Termo Aditivo/);
  assert.match(context.description, /Cláusula Quarta; alteração do Anexo Único/);
  assert.equal(context.values.length, 2);
  assert.doesNotMatch(context.consortia.join(''), /CNPJ/);
});

test('norma do consórcio não recebe município da sede ou da assinatura', () => {
  const body = 'Estabelece requisitos para o comércio de produtos de origem animal. O Conselho Diretor do ' +
    'Consórcio Intermunicipal de Desenvolvimento Econômico e Social do Vale do Guaporé – CIDESA VALE DO GUAPORÉ, resolve: ' +
    'Art. 1º Estabelece as regras para os estabelecimentos que optarem pelo comércio interestadual. ' +
    'Parágrafo único. Requer registro. Nova Lacerda, 16 de novembro de 2030.';
  const context = weeklyContext({ ...item, title: 'Instrução Normativa nº 007/2030' }, { uf: 'MT' }, body);
  assert.equal(context.location, '');
  assert.match(context.consortia[0], /\(CIDESA VALE DO GUAPORÉ\)$/);
  assert.match(context.description, /que optarem/);
  assert.doesNotMatch(context.description, /Requer registro|Nova Lacerda/);
});

test('nome ausente fica explícito; não inventa identificação nem perde achados na divisão', () => {
  const report = { start: '2030-11-16T12:00:00Z', end: '2030-11-23T12:00:00Z', events: 14,
    highlights: Array.from({ length: 14 }, (_, i) => ({ ...item, url: `${item.url}/${i}`,
      summary: 'Convênio publicado sem nome legível no trecho disponível.' })) };
  const parts = formatWeeklyMessages(report, false, 950);
  assert.ok(parts.length > 1);
  assert.ok(parts.every(part => part.length <= 950));
  const text = parts.join('\n');
  assert.equal((text.match(/nome não identificado com segurança/g) || []).length, 14);
  assert.equal((text.match(/🔗 /g) || []).length, 14);
  assert.match(text, /Datas dos itens: publicação/);
});
