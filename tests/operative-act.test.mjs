import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyItem} from '../src/lib/classifier.mjs';
import {applySimpleTriage} from '../src/lib/simple-triage.mjs';
import {verifiedTriage} from '../src/lib/triage-proof.mjs';
import {operativeAct} from '../src/lib/operative-act.mjs';

const fixtures=[
 ['DECRETO ORÇAMENTÁRIO Nº 30/2026','O PREFEITO MUNICIPAL. Abre Crédito Suplementar ao Orçamento do exercício. Art. 1.º Fica aberto ao orçamento vigente um crédito. ANEXO: Consórcio Intermunicipal de Saúde; Rateio pela participação em consórcio público.','descartado','GERAL'],
 ['LEI ORDINÁRIA Nº 4482/2026','ESTABELECE O ORÇAMENTO DO MUNICÍPIO. O Prefeito sanciona a Lei. Art. 1º O orçamento municipal estima a Receita e fixa a Despesa. Anexo: Transferências a consórcios públicos mediante contrato de rateio.','descartado','GERAL'],
 ['LEI MUNICIPAL Nº 2383/2026','Ratifica as alterações do Contrato do Consórcio Público de Saúde. A Câmara aprovou e eu sanciono. Art. 1º Ficam ratificadas as alterações do Contrato do Consórcio Público Intermunicipal de Saúde, conforme anexos.','confirmado','GOVERNANÇA'],
 ['LEI Nº 1530/2026','A Câmara aprovou e eu sanciono a seguinte lei: Art. 1º Fica ratificado na íntegra a 5ª Alteração e Consolidação do Contrato do Consórcio Metropolitano de Serviços. Art. 3º O Município continuará a contribuir pelo sistema de rateio.','confirmado','GOVERNANÇA'],
 ['LEI MUNICIPAL Nº 1356/2026','Eu sanciono a Lei. Art. 1º Fica ratificado o Termo de Alteração do Protocolo de Intenções do Consórcio Intermunicipal, que inclui objetivos. Art. 2º Aplicam-se as disposições anexas sobre fiscalização e eventual desligamento.','confirmado','GOVERNANÇA'],
 ['LEI MUNICIPAL Nº 1717/2026','A Câmara aprovou e eu sanciono. Art. 1º Fica o Poder Executivo Municipal autorizado a celebrar Termo Aditivo ao Contrato de Rateio nº 001/2026, firmado com o Consórcio Intermunicipal de Saúde, para ampliar o repasse de recursos.','confirmado','RATEIO EM TRAMITAÇÃO'],
 ['LEI Nº 475/2026','A Câmara aprovou e eu sanciono. Art. 1º Os valores recolhidos pelo Consórcio Público de Saúde, instituído pela Lei Federal nº 11.107/2005, a título de IRRF, passam a ser considerados receita orçamentária do próprio consórcio.','confirmado','FINANÇAS'],
 ['LEI Nº 474/2026','A Câmara aprovou e eu sanciono. Art. 1º Os valores repassados pelo Município de Exemplo ao Consórcio Público de Saúde, mediante contrato de rateio, serão reajustados anualmente pelo IPCA. Novos contratos serão formalizados no exercício seguinte.','confirmado','GOVERNANÇA'],
 ['ATO DA PRESIDÊNCIA','O PRESIDENTE DO CONSÓRCIO PÚBLICO, considerando o Protocolo de Intenções, RESOLVE: Art. 1º Formalizar o afastamento temporário do titular da Presidência por trinta dias. Art. 2º A Vice-Presidente exercerá interinamente a função.','confirmado','GOVERNANÇA'],
 ['RESOLUÇÃO DA ASSEMBLEIA GERAL Nº 008/2026','O PRESIDENTE DO CONSÓRCIO INTERMUNICIPAL RESOLVE: Art. 1º Fica aprovado o Regimento Interno do Consórcio Intermunicipal, constante do Anexo Único. O anexo contém regras sobre saída e perda de mandato, sem declarar que aconteceram.','confirmado','GOVERNANÇA'],
 ['RESOLUÇÃO 34/2026','A Presidente do Consórcio Intermunicipal, conforme Protocolo de Intenções, RESOLVE: Art. 2º) Conceder a revisão dos valores referente a indenização a título de diária e deslocamento pelo índice anual. O pagamento depende de solicitação própria.','confirmado','GOVERNANÇA'],
 ['PORTARIA Nº 214/2026','O Prefeito Municipal, conforme protocolo já ratificado do Consórcio Intermunicipal, RESOLVE: Art. 1º Ceder a servidora pública municipal ao consórcio para exercer funções administrativas pelo prazo previsto no instrumento.','descartado','GERAL'],
 ['DESPACHO DE SUSPENSÃO - CREDENCIAMENTO','O Consórcio Intermunicipal de Saúde torna público que o credenciamento fica SUSPENSO, a partir desta publicação. A suspensão fundamenta-se em razões de conveniência e oportunidade administrativa. Não consta decisão de controle externo.','descartado','GERAL'],
 ['AVISO DE SUSPENSÃO','CONSÓRCIO INTERFEDERATIVO REGIONAL – Licitação pregão 64/2026, torna público a SUSPENSÃO da sessão pública do pregão. Assina o Pregoeiro. A publicação apenas informa o adiamento e não apresenta outro fato institucional.','descartado','GERAL'],
 ['PROCESSO ADMINISTRATIVO 448/2026','CONTRATO (TERMO DE CREDENCIAMENTO) O CONSÓRCIO PÚBLICO DE SAÚDE é CONTRATANTE e, de outro lado, a empresa EXEMPLO LTDA, inscrita no CNPJ, celebram o contrato de credenciamento para atendimento médico. Cláusula: fiscalização do contrato.','descartado','GERAL'],
 ['EXTRATO DO CONTRATO DE RATEIO Nº 083/2026','OBJETO: Rateio do aporte de recursos financeiros para serviços de saúde. VALOR TOTAL: R$ 200.530,20. PRAZO: doze meses. CONCEDENTE: MUNICÍPIO DE EXEMPLO. PROPONENTE: CONSÓRCIO REGIONAL DE SAÚDE. DATA: 06/10/2026.','confirmado','RATEIO'],
 ['TERMO DE COOPERAÇÃO TÉCNICA E FINANCEIRA Nº 002/2026','O CONSÓRCIO INTERMUNICIPAL e, de outro lado, o MUNICÍPIO DE EXEMPLO resolvem celebrar o presente TERMO DE COOPERAÇÃO TÉCNICA E FINANCEIRA. OBJETO: cooperação para gestão de resíduos. Efeitos financeiros retroativos.','confirmado','ATUAÇÃO'],
 ['TCEMG determina regularização de consórcios públicos','O Tribunal de Contas do Estado aprovou, em sessão do Plenário realizada nesta quarta-feira, a aplicação de multas e determinações aos representantes legais de 69 consórcios públicos. O cumprimento deve ocorrer após a intimação.','confirmado','CONTROLE'],
 ['Consórcio realiza operação de segurança','O Consórcio Intermunicipal Grande ABC realizou, na tarde desta terça-feira, uma edição da Operação ABC+Seguro. A ação reuniu guardas municipais e viaturas das sete cidades para patrulhamento integrado nas divisas.','confirmado','ATUAÇÃO'],
 ['Seminário do TCEMG sobre consórcios públicos','O Tribunal de Contas de Minas Gerais reuniu, na manhã desta segunda-feira, especialistas da área de auditoria para discutir o papel dos consórcios públicos. O seminário apresentou um estudo temático e orientou gestores.','confirmado','ATUAÇÃO'],
 ['Prefeitura inicia obras com projeto do consórcio','A Prefeitura de Exemplo inicia nesta segunda-feira as obras de um corredor de ônibus, a partir de projeto de engenharia elaborado pelo Consórcio Intermunicipal. Financiamento e execução da obra competem ao Município.','confirmado','ATUAÇÃO'],
 ['PROJETO DE LEI DO EXECUTIVO Nº 36','A Prefeita apresenta à judiciosa apreciação da Colenda Câmara o seguinte Projeto de Lei: Art. 1º Fica ratificada a alteração do Contrato do Consórcio Público. Anexo: disposições sobre extinção, rateio e responsabilidades.','descartado','GERAL'],
 ['Diário Oficial de Salto','REQUERIMENTOS SUJEITOS A DESPACHO DO PRESIDENTE: Nº 620/2026 – Vereador de Exemplo – Presidência do Consórcio Intermunicipal do Ribeirão Piraí (CONIRPI) – Solicitando informações sobre impactos de data centers nas proximidades do rio.','descartado','GERAL'],
 ['CNM realiza atendimentos técnicos','A Confederação Nacional de Municípios (CNM) realizou atendimentos técnicos com representantes dos Municípios. Seus analistas apresentaram o Consórcio Nacional para Gestão Climática e suas possibilidades de apoio. Nenhuma adesão foi declarada.','confirmado','ATUAÇÃO'],
 ['Consórcio lança programa de cultura','O Consórcio Intermunicipal Grande ABC lançou, nesta terça-feira (14/7), durante a Assembleia de Prefeitos, o programa ABC + Cultura, uma iniciativa para integração regional. O programa prevê festival e projetos futuros, ainda sem execução demonstrada.','confirmado','ATUAÇÃO'],
 ['Diário Oficial de Município Exemplo','DISPENSA DE LICITAÇÃO Nº 166/2026. Considerando o processo administrativo, fica autorizada a dispensa de licitação para CONTRATO DE RATEIO COM O CIEX (CONSÓRCIO INTERMUNICIPAL DE URGÊNCIA E EMERGÊNCIA). Prestação de serviços para o próximo exercício. Município de Exemplo, 30 de outubro de 2026.','confirmado','RATEIO EM TRAMITAÇÃO'],
];

for(const [title,body,status,category] of fixtures)test(`ato operativo: ${title}`,()=>{
  const rawText=body+' Documento original preservado para a conferência da prova literal, sem presumir atos posteriores.';
  const item={title,rawText,url:'https://fonte.gov.br/atos/2026/teste',kind:/^(?:lei|decreto|resolu|ato|portaria|extrato|processo|termo|aviso|despacho|projeto)/i.test(title)?'gazette':'news'};
  item.classification=classifyItem(item);item.ruleClassification=item.classification;
  // A stale generic cached review cannot reopen a documentary conclusion.
  item.aiReview={status:'disputed',category:'CRISE',promptVersion:0,evidence:'citação inexistente'};
  const result=applySimpleTriage(item);
  assert.equal(result.catalogDecision,status);assert.equal(result.triage.category,category);
  assert.ok(verifiedTriage(result.triage,rawText));
});

test('negação, hipótese e falta de dispositivo não viram confirmação documental',()=>{
  for(const body of [
    'Se o Consórcio Intermunicipal Grande ABC realizou, nesta data, a Operação ABC+Seguro, faltam documentos para comprovar. Texto apresentado como hipótese de análise, sem evento registrado.',
    'A Câmara recebe minuta. Art. 1º Não ficam ratificadas as alterações do contrato do Consórcio Intermunicipal. O texto é um projeto, não uma norma sancionada em vigor.',
  ]) {
    const item={title:'Notícia sobre consórcio',kind:'news',url:'https://fonte.gov.br/hipotese',rawText:body};
    item.classification=classifyItem(item);
    assert.notEqual(applySimpleTriage(item).catalogDecision,'confirmado');
  }
});

test('minuta, cancelamento e negação não comprovam dispensa de rateio autorizada',()=>{
  const fact='fica autorizada a dispensa de licitação para CONTRATO DE RATEIO COM O CIEX (CONSÓRCIO INTERMUNICIPAL DE SAÚDE).';
  for(const prefix of ['MINUTA: ','Dispensa cancelada. ','Não '])
    assert.equal(operativeAct('Diário Oficial de Exemplo',prefix+fact),null);
});

test('política municipal com consórcio identificado não recebe descarte genérico por diferença de maiúsculas',()=>{
  for(const name of ['Consórcio Intermunicipal de Saneamento','CONSÓRCIO PÚBLICO CISABC','Consórcio Público de Gestão Regional']) {
    const body=`Art. 1º Esta Lei institui a Política Municipal de Saneamento Básico. Art. 2º O Município delega a regulação ao ${name}.`;
    assert.equal(operativeAct('LEI MUNICIPAL Nº 953/2026',body),null);
  }
});

test('formatação, endereço alternativo e recitação de cláusula não mudam o ato operativo',()=>{
  // Metamorphic check: vary irrelevant inputs while preserving the enacted fact.
  const [title,body,status,category]=fixtures[2];
  for(const text of [body,body.replaceAll(' ','  '),body+' Anexo: regras genéricas de saída e de fiscalização do contrato.']) {
    for(const url of ['https://fonte.gov.br/lei/2383','https://fonte.gov.br/lei/2383?origem=arquivo']) {
      const item={title,rawText:text,url,kind:'gazette'};
      item.classification=classifyItem(item);item.ruleClassification=item.classification;
      const result=applySimpleTriage(item);
      assert.equal(result.catalogDecision,status);assert.equal(result.triage.category,category);
      assert.ok(verifiedTriage(result.triage,text));
    }
  }
});
