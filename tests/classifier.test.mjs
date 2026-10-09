import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifyItem } from '../src/lib/classifier.mjs';

test('protege os casos reais de regressão editorial', async () => {
  const fixtureUrl = new URL('./fixtures/classifier-regression.json', import.meta.url);
  const cases = JSON.parse(await readFile(fixtureUrl, 'utf8'));
  for (const fixture of cases) {
    const result = classifyItem(fixture.item);
    assert.equal(result.category, fixture.expectedCategory, fixture.name);
    if (fixture.minimumScore) assert.ok(result.score >= fixture.minimumScore, fixture.name);
    if (fixture.maximumScore) assert.ok(result.score <= fixture.maximumScore, fixture.name);
  }
});

test('lei de autorização não prova ingresso já efetivado', () => {
  const result = classifyItem({
    title: 'Município aprova adesão ao consórcio intermunicipal',
    summary: 'A lei autoriza o ingresso do município no consórcio público regional.',
  });
  assert.equal(result.category, 'ADESÃO AUTORIZADA');
  assert.ok(result.score >= 4);
});

test('encontra decisão no fim do texto integral, depois do antigo corte', () => {
  const rawText = `${'Contexto administrativo sem evento. '.repeat(170)} ` +
    'A Câmara aprovou a adesão do município ao consórcio intermunicipal de prevenção de desastres.';
  const result = classifyItem({ kind: 'news', title: 'Participação em consórcio',
    summary: rawText.slice(0, 1800), rawText });
  assert.equal(result.category, 'ADESÃO AUTORIZADA');
  assert.match(result.evidenceText, /Câmara aprovou a adesão/);
  assert.ok(result.evidenceText.length <= 1800);
});

test('criar agenda de um consórcio existente não é criação de consórcio', () => {
  const result = classifyItem({
    kind: 'news',
    title: 'Consórcio Intermunicipal cria agenda setorial com Brasília para atrair investimentos',
    summary: 'Consórcio Intermunicipal cria agenda setorial com Brasília para atrair investimentos',
  });
  assert.equal(result.category, 'ATUAÇÃO');
});

test('penaliza adesão a ata de registro de preços', () => {
  const result = classifyItem({
    title: 'Adesão a ata de registro de preços',
    summary: 'Ata gerenciada por consórcio intermunicipal para aquisição de veículos.',
  });
  assert.ok(result.score < 4);
});

test('adesão a credenciamento do consórcio não é ingresso no consórcio', () => {
  const result = classifyItem({
    kind: 'gazette', title: 'Aviso de Adesão - processo 36/2026',
    summary: 'O Município de Dois Irmãos ratificou o processo de adesão para prestação de serviços de coleta de resíduos através de adesão ao Credenciamento 03/2026 do Consórcio Público CPSINOS.',
  });
  assert.equal(result.category, 'GERAL');
  assert.match(result.reasons.join(' '), /credenciamento de serviços/);
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

test('prioriza autorização de adesão quando a lei também altera o protocolo', () => {
  const result = classifyItem({
    kind: 'gazette',
    title: 'Diário Oficial de Exemplo',
    summary:
      'Lei autoriza a adesão do Município ao Consórcio Intermunicipal Regional, mediante ratificação da alteração do protocolo de intenções, nos termos da Lei 11.107.',
  });
  assert.equal(result.category, 'ADESÃO AUTORIZADA');
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

test('reconhece fiscalização de consórcio interfederativo', () => {
  const result = classifyItem({
    kind: 'news',
    title: 'Tribunal de Contas suspende contratação do Consórcio Interfederativo Minas Gerais',
    summary: 'A decisão aponta irregularidades em credenciamento do consórcio.',
    sourceUrl: 'https://www.tce.mg.gov.br/noticia',
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

test('extinção de locação do consórcio não é crise institucional', () => {
  const result = classifyItem({ kind: 'gazette', title: 'Diário Oficial de Andradina',
    summary: 'CIENSP - CONSÓRCIO INTERMUNICIPAL DO EXTREMO NOROESTE DE SÃO PAULO. EXTRATO DE TERMO DE EXTINÇÃO AMIGÁVEL CONTRATO Nº 30/2025. LOCATÁRIO: CONSÓRCIO INTERMUNICIPAL DO EXTREMO NOROESTE DE SÃO PAULO.' });
  assert.equal(result.category, 'GERAL');
  assert.match(result.reasons.join(' '), /término de contrato/);
});

test('consórcio de instituições contratadas não vira consórcio intermunicipal', () => {
  const result = classifyItem({ kind: 'gazette', title: 'Diário Oficial de Niterói',
    summary: 'PARTES: FUNDAÇÃO MUNICIPAL DE EDUCAÇÃO e CONSÓRCIO CESGRANRIO - UFJF/CAEd. Contratação de solução para avaliação da rede municipal.' });
  assert.equal(result.category, 'GERAL');
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

test('rejeita menções a rateio em RREO, crédito suplementar e diretriz orçamentária', () => {
  const summaries = [
    'Despesas com ASPS executadas em consórcio público. VALORES TRANSFERIDOS POR CONTRATO DE RATEIO (a) DESPESAS EMPENHADAS.',
    'Fica aberto crédito adicional suplementar destinado a DESPESAS COM RATEIO DO CONSÓRCIO INTERMUNICIPAL DE SAÚDE.',
    'Deverão ser discriminadas em ações orçamentárias específicas as dotações destinadas à transferência de recursos para Consórcios Públicos em decorrência de contrato de rateio.',
    'MANUT. DO CONSÓRCIO COM O CISSUL/SAMU - CONTRATO DE RATEIO 3171.70.00 - RATEIO PELA PARTICIPAÇÃO EM CONSÓRCIO PÚBLICO.',
  ];
  for (const summary of summaries) {
    const result = classifyItem({ kind: 'gazette', title: 'Diário Oficial de Exemplo', summary });
    assert.ok(result.score < 5, `${summary}: ${result.score}`);
  }
});

test('proposta de ingresso sem decisão no trecho não vira adesão', () => {
  const result = classifyItem({ kind: 'gazette', title: 'Diário Oficial de Valinhos (SP)',
    summary: 'Aprovado por unanimidade o item anterior. 4) Apresentação, discussão e votação da Proposta para ingresso ao SAMU Regional, através de um consórcio intermunicipal.' });
  assert.ok(result.score < 5);
  assert.match(result.reasons.join(' '), /proposta de ingresso sem decisão/);
});

test('PDF de projeto de lei de 2022 reindexado em 2026 não vira notícia atual', () => {
  const old = { kind: 'news', title: 'PROJETO DE LEI N°. 54, DE DE DE 2022 Ratifica o Protocolo de Intenções do Consórcio Público Intermunicipal',
    summary: 'Ratifica o Protocolo de Intenções do Consórcio Público Intermunicipal de Saúde.',
    publishedAt: '2026-09-28T08:34:57Z' };
  assert.equal(classifyItem(old).category, 'GERAL');
  assert.match(classifyItem(old).reasons.join(' '), /data recente de indexação/);
  assert.notEqual(classifyItem({ ...old, title: old.title.replace('2022', '2026') }).category, 'GERAL');
});

test('lei de 2022 com data anteposta não vira notícia de 2026', () => {
  const old = { kind: 'news', title: '14/03/2022 - LEI Nº559-2022 (Ratifica o protocolo de intenções do Consórcio publico sustentavel)',
    summary: 'Lei ratifica protocolo de intenções do consórcio público intermunicipal.',
    publishedAt: '2026-10-04T21:59:00Z' };
  assert.equal(classifyItem(old).category, 'GERAL');
  assert.match(classifyItem(old).reasons.join(' '), /data recente de indexação/);
  assert.notEqual(classifyItem({ ...old, title: old.title.replaceAll('2022', '2026') }).category, 'GERAL');
});

test('requerimento aprovado que pede adesão não vira adesão aprovada', () => {
  const result = classifyItem({ kind: 'news', title: 'Votação Simbólica',
    articleUrl: 'https://sapl.exemplo.pe.leg.br/sessao/914/votacao-simbolica-transparencia/4911/9957',
    rawText: 'Matéria: Requerimento nº 352 de 2026. Ementa: Solicita a adesão e participação do município no consórcio público para gestão climática. Resultado da Votação: Aprovado.' });
  assert.equal(result.category, 'GERAL');
  assert.match(result.stage, /requerimento/);
});

test('pedido de informações sobre projeto de adesão não vira autorização', () => {
  const result = classifyItem({ kind: 'news', title: 'Acompanhamento de Matéria',
    articleUrl: 'https://sapl.exemplo.pr.leg.br/materia/33573/acompanhar-materia/',
    rawText: 'Tipo: REQ - Requerimento Número: 314. Requer ao Executivo informações sobre o Projeto de Lei 69/2026, que autoriza o ingresso do Município de Pato Branco no Consórcio Intermunicipal de Saneamento do Paraná.' });
  assert.equal(result.category, 'GERAL');
});

test('pauta de projeto não comprova aprovação nem lei gerada', () => {
  const result = classifyItem({ kind: 'news', title: 'Ordem do Dia',
    articleUrl: 'https://sapl.exemplo.pr.leg.br/sessao/ordemdia/1884',
    rawText: 'Matérias da Ordem do Dia. Projeto de Lei Ordinária nº 33 de 2026. Autoriza o ingresso do Município de Campina Grande do Sul no Consórcio Intermunicipal de Saneamento do Paraná. Tipo de votação nominal. Situação de Pauta.' });
  assert.equal(result.category, 'GERAL');
  assert.match(result.stage, /pauta/);
});

test('recomendação do MP com dissolução apenas hipotética é controle, não extinção', () => {
  const result = classifyItem({ kind: 'news', title: 'MP cobra medidas para hospital gerido pelo consórcio',
    rawText: 'O Ministério Público deu 10 dias aos municípios do Consórcio Intermunicipal de Saúde da Região do Vale do Peixoto. A Recomendação nº 23/2026 pede a retomada de cirurgias. Entre as alternativas futuras para regularizar o consórcio foi apresentada a dissolução da entidade, sem decisão tomada.' });
  assert.equal(result.category, 'CONTROLE');
  assert.match(result.stage, /dissolução apenas alternativa/);
});

test('resultado de busca legislativa não vira ato individual', () => {
  const result = classifyItem({ kind: 'news', title: 'Autoriza crédito adicional',
    articleUrl: 'https://camara.exemplo.pr.leg.br/@@search?SearchableText=lei&b_start:int=2670',
    rawText: 'Resultados de busca por lei. Consórcio intermunicipal citado no rodapé.' });
  assert.equal(result.category, 'GERAL');
  assert.match(result.reasons.join(' '), /página de busca/);
});
