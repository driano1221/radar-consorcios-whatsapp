import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyItem } from '../src/lib/classifier.mjs';
import { readFile } from 'node:fs/promises';

test('aprovação de projeto para participar do Conclima é autorização, não ingresso comprovado', () => {
  const rawText = 'A Câmara Municipal aprovou, em dois turnos, o projeto que ratifica a participação de Umuarama no Consórcio Nacional para Gestão Climática e Prevenção de Desastres (Conclima). O ingresso formal dependerá das etapas seguintes.';
  const result = classifyItem({ kind: 'news', title: 'Câmara aprova adesão de Umuarama ao consórcio', rawText });
  assert.equal(result.category, 'ADESÃO AUTORIZADA');
  assert.match(result.evidenceText, /Câmara Municipal aprovou/);
  assert.equal(rawText.slice(result.evidenceOffset, result.evidenceOffset + result.evidenceText.length), result.evidenceText);
});

test('cinco textos recuperados mantêm a categoria e a etapa jurídica corretas', async () => {
  const stored = (await readFile(new URL('../data/catalogo/textos-artigos.ndjson', import.meta.url), 'utf8'))
    .split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const archive = (await readFile(new URL('../data/catalogo/arquivo-coletas.ndjson', import.meta.url), 'utf8'))
    .split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const byId = new Map(archive.map((row) => [row.id, row]));
  const cases = [
    ['9e51dae9', 'CONTROLE', /contas.*desaprovadas/],
    ['b999516d', 'ATUAÇÃO', /chamamento público aberto/],
    ['741925b5', 'ATUAÇÃO', /atendimentos suspensos/],
    ['530064fc', 'GOVERNANÇA', /saída ou extinção ainda não comprovada/],
    ['05cd3fe0', 'ATUAÇÃO', /equipamento recebido/],
  ];
  for (const [prefix, category, stage] of cases) {
    const source = stored.find((row) => row.documento_id.startsWith(prefix));
    assert.ok(source, `${prefix}: texto recuperado ausente`);
    const row = byId.get(source.documento_id);
    const result = classifyItem({ kind: 'news', title: row.titulo, url: row.url,
      source: row.fonte, summary: source.texto.slice(0, 1800), rawText: source.texto,
      publishedAt: row.data_publicacao });
    assert.equal(result.category, category, `${prefix}: categoria incorreta`);
    assert.match(result.stage, stage, `${prefix}: etapa incorreta`);
    assert.ok(source.texto.includes(result.evidenceText), `${prefix}: prova não literal`);
  }
});

test('alteração do protocolo e lista de consorciados não inventam ingresso novo', () => {
  const rawText = 'Lei municipal ratifica a alteração do protocolo de intenções do Consórcio Intermunicipal de Desenvolvimento Sustentável Portal da Amazônia. O anexo lista Marcelândia entre os municípios consorciados e delega o Serviço de Inspeção Municipal.';
  const result = classifyItem({ kind: 'gazette', title: 'Lei municipal 1.261/2026', rawText });
  assert.equal(result.category, 'GOVERNANÇA');
  assert.equal(result.participationEvidence, true);
  assert.match(result.stage, /ingresso novo não comprovado/);
});

test('depoimento sobre possível criação não vira criação nem controle automático', () => {
  const rawText = 'O ex-presidente do Consórcio Intermunicipal de Saúde depôs à CPI. Ele questionou a necessidade de criação de um novo consórcio de saúde e disse que não via viabilidade para essa eventual estrutura.';
  const result = classifyItem({ kind: 'news', title: 'Ex-presidente depõe à CPI e questiona criação de novo consórcio', rawText });
  assert.equal(result.category, 'GERAL');
  assert.match(result.evidenceText, /questionou a necessidade de criação/);
  assert.match(result.reasons.join(' '), /hipotética|depoimento/);
});

test('ato formal de criação continua possível', () => {
  const rawText = 'Lei municipal institui o Consórcio Intermunicipal do Vale do Sol, com personalidade jurídica própria e participação dos municípios signatários.';
  const result = classifyItem({ kind: 'gazette', title: 'Lei institui consórcio intermunicipal', rawText });
  assert.equal(result.category, 'CRIAÇÃO');
  assert.match(result.evidenceText, /Lei municipal institui/);
});

test('contrato de rateio celebrado aponta a cláusula, sem afirmar adesão', () => {
  const rawText = 'O Município de Alto Paraguai e o Consórcio Intermunicipal de Saúde celebram o presente Contrato de Rateio para procedimentos do Programa Fila Zero. O valor é R$ 200.010,82, com vigência até 02/10/2027.';
  const result = classifyItem({ kind: 'gazette', title: 'Contrato de rateio 055/2026', rawText });
  assert.equal(result.category, 'RATEIO');
  assert.match(result.evidenceText, /celebram o presente Contrato de Rateio/);
  assert.doesNotMatch(result.stage, /ades[aã]o|ingresso/i);
});

test('autorização para ingressar prevalece sobre rateio futuro citado na notícia', () => {
  const rawText = 'O município de Caratinga foi autorizado a ingressar no Consórcio Interfederativo Minas Gerais (CIMINAS). A medida está prevista na Lei nº 4.178/2026, sancionada pelo prefeito. A lei também autoriza a celebração de Contratos de Rateio, ainda sem contrato assinado.';
  const result = classifyItem({ kind: 'news', title: 'Município é autorizado a integrar consórcio CIMINAS', rawText });
  assert.equal(result.category, 'ADESÃO AUTORIZADA');
  assert.match(result.evidenceText, /autorizado a ingressar/);
  assert.match(result.stage, /rateio apenas previsto/);
});

test('ementa de lei que autoriza ingresso não vira adesão já efetivada', () => {
  const rawText = 'Ementa Autoriza o ingresso do Município de Centenário do Sul no Consórcio Intermunicipal de Saneamento do Paraná (CISPAR), bem como ratifica o seu Contrato de Consórcio Público e Estatuto Social. Situação: ativa.';
  const result = classifyItem({ kind: 'news', title: 'Lei Ordinária 3309/2026', rawText });
  assert.equal(result.category, 'ADESÃO AUTORIZADA');
});

test('projeto sobre consórcio existente preserva alteração aprovada em assembleia', () => {
  const rawText = 'Um projeto de lei pretende ratificar a nova versão do protocolo de intenções do Consórcio Intermunicipal das Guardas Municipais (COIN-GM), incorporando Pontal do Paraná, Guaratuba, Matinhos e Campo Magro à relação de municípios consorciados. A proposta não cria o consórcio. O projeto ratifica a consolidação desse protocolo, aprovada pelos integrantes do consórcio em assembleia realizada em abril de 2026. A ratificação pela Câmara ainda está em análise.';
  const result = classifyItem({ kind: 'news', title: 'Consórcio pode atuar no litoral; entenda a proposta', rawText });
  assert.equal(result.category, 'GOVERNANÇA');
  assert.match(result.stage, /assembleia.*ratificação municipal/i);
  assert.match(result.evidenceText, /aprovada pelos integrantes/);
});

test('programa interno de combate à fraude não acusa o consórcio de fraude', () => {
  const rawText = 'INSTRUÇÃO DE TRABALHO Nº 010/2026 PROGRAMA DE PREVENÇÃO E COMBATE À FRAUDE. Objetivo: estabelecer procedimentos para prevenir fraudes em produtos de origem animal registrados no Serviço de Inspeção Municipal do Consórcio Intermunicipal do Araguaia.';
  const result = classifyItem({ kind: 'news', title: 'Instrução de trabalho do consórcio: combate à fraude', rawText });
  assert.equal(result.category, 'ATUAÇÃO');
  assert.match(result.stage, /não é apuração contra o consórcio/);
});

test('ratificação do IV protocolo preserva participação anterior sem adesão automática a novos programas', () => {
  const rawText = 'Lei 1.194/2026. Fica ratificado o IV Protocolo de Intenções do CONSCENSUL. O Município participa do consórcio nas funções originárias de gestão associada de resíduos sólidos. A aprovação desta Lei não implica adesão automática a qualquer Programa Setorial ou Específico.';
  const result = classifyItem({ kind: 'gazette', title: 'Lei de Simão Dias', rawText });
  assert.equal(result.category, 'GOVERNANÇA');
  assert.equal(result.participationEvidence, true);
  assert.match(result.stage, /adesão separada/);
});

test('proposta votada pelo Conselho de Saúde não vira adesão efetivada', () => {
  const rawText = 'Ata do Conselho Municipal de Saúde: apresentação, discussão e votação da proposta para ingresso no SAMU Regional por meio de um consórcio intermunicipal. A Presidente coloca a proposta em votação. Aprovada por unanimidade.';
  const result = classifyItem({ kind: 'gazette', title: 'Diário Oficial de Valinhos', rawText });
  assert.equal(result.category, 'PROPOSTA DE ADESÃO');
  assert.match(result.stage, /ingresso não comprovado/);
  assert.match(result.evidenceText, /proposta para ingresso/i);
});

test('etapa final aprovada não declara consórcio já constituído', () => {
  const rawText = 'O distrito avançou com a aprovação da etapa final para a criação do Consórcio Público Intermunicipal CI-DTSA. Prefeitos deram aval à iniciativa, que permitirá atuação conjunta.';
  const result = classifyItem({ kind: 'news', title: 'Serra Azul cria consórcio intermunicipal', rawText });
  assert.equal(result.category, 'CRIAÇÃO EM TRAMITAÇÃO');
  assert.match(result.stage, /constituição formal não comprovada/);
});

test('cláusula-padrão de improbidade em contrato de rateio não é fiscalização', () => {
  const rawText = 'CONTRATO DE RATEIO Nº 001/2026 entre o Consórcio Intermunicipal de Turismo e seus entes. CLÁUSULA ONZE: rateio pela participação em consórcio público. CLÁUSULA DOZE - Constitui ato de improbidade administrativa celebrar contrato de rateio sem prévia dotação orçamentária.';
  const result = classifyItem({ kind: 'gazette', title: 'Diário Oficial de Votuporanga', rawText });
  assert.equal(result.category, 'RATEIO');
  assert.match(result.reasons.join(' '), /não é ato de controle/);
});

test('CONIAPE tem sede em construção, sem declarar assembleia futura já realizada', () => {
  const rawText = 'O CONIAPE, Consórcio Público Intermunicipal do Agreste, realizará sua Assembleia Ordinária em 14 de outubro. O encontro acontecerá nas instalações da nova sede, que se encontra atualmente em fase de construção. Haverá visita técnica e sessão de prestação de contas.';
  const result = classifyItem({ kind: 'news', title: 'CONIAPE realiza assembleia e visita técnica', rawText });
  assert.equal(result.category, 'ATUAÇÃO');
  assert.match(result.stage, /reunião e visita ainda futuras/);
  assert.match(result.evidenceText, /nova sede/);
});

test('agenda futura sem obra ou ato consumado não vira evento', () => {
  const rawText = 'O Consórcio Público Intermunicipal realizará sua Assembleia Ordinária na próxima semana. A programação inclui visita técnica e sessão de prestação de contas.';
  const result = classifyItem({ kind: 'news', title: 'Consórcio anuncia assembleia ordinária', rawText });
  assert.equal(result.category, 'GERAL');
});

test('resolução operacional do SIM não é alteração do protocolo citado no preâmbulo', () => {
  const rawText = 'RESOLUÇÃO Nº 004/2026 Dispõe sobre os procedimentos de inspeção e fiscalização industrial e sanitária de produtos de origem animal executados pelo Serviço de Inspeção Municipal vinculado ao Consórcio Intermunicipal Araguaia. O presidente considera o Protocolo de Intenções e resolve estabelecer esses procedimentos.';
  const result = classifyItem({ kind: 'news', title: 'Resolução nº 004/2026', rawText });
  assert.equal(result.category, 'ATUAÇÃO');
  assert.match(result.stage, /norma operacional/);
});

test('resolução 003 do outro consórcio também é ato operacional, sem confundir com a 004', () => {
  const rawText = 'RESOLUÇÃO Nº 003/2026 Dispõe sobre os procedimentos de inspeção e fiscalização industrial e sanitária de produtos de origem animal executados pelo Serviço de Inspeção Municipal vinculado ao Consórcio Intermunicipal do Alto do Rio Paraguai.';
  const result = classifyItem({ kind: 'news', title: 'Resolução 003-2026', rawText });
  assert.equal(result.category, 'ATUAÇÃO');
  assert.match(result.stage, /norma operacional/);
});

test('retificação de regulamento eleitoral não informa eleição já ocorrida', () => {
  const rawText = 'RETIFICAÇÃO DO REGULAMENTO ELEITORAL – BIÊNIO 2027/2028. A eleição da diretoria do Consórcio Intermunicipal CODEMA será realizada em 21 de outubro de 2026. As demais regras permanecem inalteradas.';
  const result = classifyItem({ kind: 'news', title: 'CODEMA retifica regulamento eleitoral', rawText });
  assert.equal(result.category, 'GOVERNANÇA');
  assert.match(result.stage, /eleição não comprovada/);
});

test('autorização de dispensa para formalizar rateio não é contrato assinado', () => {
  const rawText = 'AUTORIZAÇÃO PARA REALIZAÇÃO DE DISPENSA DE LICITAÇÃO. Processo 269/2026 referente a formalização de Contrato de Rateio com o Consórcio Intermunicipal de Saúde do Médio Paranapanema. Após a publicação, os autos voltarão ao gabinete para verificação e assinaturas dos documentos necessários.';
  const result = classifyItem({ kind: 'gazette', title: 'Diário Oficial de Primeiro de Maio', rawText });
  assert.equal(result.category, 'RATEIO EM TRAMITAÇÃO');
  assert.match(result.stage, /contrato não assinado/);
});

test('notícia de ingresso autorizado não declara entrada consumada', () => {
  const rawText = 'O município de Caratinga foi autorizado a ingressar no Consórcio Interfederativo Minas Gerais (CIMINAS). A Lei 4.178/2026 permite firmar termo de adesão posteriormente.';
  const result = classifyItem({ kind: 'news', title: 'Caratinga é autorizada a integrar CIMINAS', rawText });
  assert.equal(result.category, 'ADESÃO AUTORIZADA');
});

test('lei de Junqueiro autoriza convênio de serviços, não ingresso no CONAGRESTE', () => {
  const rawText = 'LEI Nº 886/2026. AUTORIZA O PODER EXECUTIVO A FIRMAR CONVÊNIO, VISANDO A CONTRATAÇÃO DE BENS OU SERVIÇOS DE FORMA COMPARTILHADA JUNTO AO CONSÓRCIO INTERMUNICIPAL DO AGRESTE ALAGOANO - CONAGRESTE. Art. 1º Fica autorizado a firmar Convênio com o Consórcio. Art. 3º O contrato de rateio será formalizado em cada exercício financeiro.';
  const result = classifyItem({ kind: 'gazette', title: 'Lei 886/2026 de Junqueiro', rawText });
  assert.equal(result.category, 'COOPERAÇÃO AUTORIZADA');
  assert.match(result.stage, /assinatura e adesão não comprovadas/);
});

test('ratificação municipal de estatuto existente não é protocolo novo', () => {
  const rawText = 'Lei Municipal 1193/2026 ratifica o Estatuto Consolidado do Consórcio Intermunicipal CIDESAPA e correspondente alteração contratual. O estatuto substitui o texto de 2009 sem prejuízo da continuidade da personalidade jurídica.';
  const result = classifyItem({ kind: 'news', title: 'Araguainha ratifica estatuto CIDESAPA', rawText });
  assert.equal(result.category, 'GOVERNANÇA');
  assert.match(result.stage, /consórcio já existente/);
});

test('extrato de contrato com consórcio não é alteração do protocolo citado no objeto', () => {
  const rawText = 'EXTRATO DO CONTRATO DE PRESTAÇÃO DE SERVIÇOS Nº 230/2026. PARTES: O Município de Campo Mourão e Consórcio Intermunicipal para o Desenvolvimento dos Municípios da Região de Campo Mourão - CONDESCOM. OBJETO: locação de equipamentos rodoviários, de acordo com o Protocolo de Intenções. VALOR TOTAL: R$ 40.000,00. DATA DE ASSINATURA: 21 de setembro de 2026.';
  const result = classifyItem({ kind: 'gazette', title: 'Diário Oficial de Campo Mourão', rawText });
  assert.equal(result.category, 'ATUAÇÃO');
  assert.match(result.stage, /contrato de prestação de serviços assinado/);
});

test('inadimplência municipal com retenção do PAICI não declara falência do consórcio', () => {
  const rawText = 'Inadimplência deixa oito municípios de MT sem incentivo estadual para consórcios de Saúde. Oito municípios ficaram sem receber, em agosto, o incentivo financeiro estadual destinado ao PAICI. Os municípios estão inadimplentes com as cotas de participação nos respectivos consórcios.';
  const result = classifyItem({ kind: 'news', title: 'Inadimplência deixa oito municípios sem incentivo estadual para consórcios', rawText });
  assert.equal(result.category, 'FINANÇAS');
  assert.match(result.stage, /consórcios não declarados insolventes/);
});
