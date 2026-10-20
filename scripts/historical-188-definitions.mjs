// Lote fixo coletado e validado no Actions 39336621942. Números são apenas
// referências do relatório, nunca índices da base atual. URLs são a identidade.
const codes=`5CE63D47 63DBE6B4 E340CFD6 F554B521 0B8EF3CE E6F22836 1027262E 068F0FD4 C2C88E13 66B39529 7433396A 34A06A00 6594AA56 147E602C 836D9BA8 ADADE757 4796E327 A54CFAEC 94A9AFD4 4A4835D7 9346D96B 8A9816AC 39338B8C 620B2AC9 18C4A8D0 C97AEF15 FFCAF5C2 C4C6F805 EE9C1288 2C3D2A70 60B04267 788C959B BE24BBA0 9285D8F4 1CE7FB5E 11F4AB91 06ED5732 A139DF20 12FA856B FD790BFF 672C95C4 2EEC75CC F3CFBFEB 8D907054 A1A8F9FC DEE68394 310612DE 1CD98503 194B5D5F EED3DDDA
8820649 8820821 8820939 8821006 8821307 8812468 8818341 8818440 8818459 8818468 8818492 8818516 8818535 8818540 8818546 8818550 8818570 8818601 8818980 8819239 8819379 8819463 8819912 8820173 8820258 8820353
D3E7684B 12917F9A 3D99BCB8 65457346 07DEEC38 CF282BEB B72C99F0 90F29D30 CD05A8FC D50012A9 D29DF057 9939B591
339DBD90 47313FD7 719865DD BB494784 D14EFB3B EE7758C8 0365B353 244BB117 E166A1CF 8F6F25F5 CB7CCC36 C46CCE0A 348CBEAE 6B12E034 72DCF9BA 76F6239E 5386FB85 97BBF8AE 0ED5BA6E 247F5442 5C732C01 3C30B678 39E6EDB5 4295E2CE 577BA84C BF94D0D7 2C93C957 AAB88CEB A36ED7E5 25E3168B 0F753E52 0532D687 DAA8F96A 9D2DFA25 406D341D 89138778 E1428D6A 8F90BC16 C64DC59B FCDA3F7F 36E99EA4 BCBF8CBE E2CEC306 E8656463 3DC37B4C 33433C5B 39AE5AEF 3EF6B37A 4E11CD92 34429FD7
15A7193D 9D13CAC8 F2A1265D E1784D3E F2ACC65C B73DD32B E00D9949 C871E8EB 8B4A5F76 E8DB5582 6E4360B9 CA10D9EE 65263F8B 4904B31C A8168A77 DFD3037B E308C190 197881D9 C245D175 78E59696 EFF688BA 083832C7 FB2D0529 04A710A1 99535BD7 96817376 AA597D13 8B1B27DE 7B0AFC9E 07EC7232 3A9EBF21 44DC81A8 13693625 5EF8556F 82BE246D 88A181B6 6A1AF889 1E78BE6F AAB010B7 34CBB425 2D29B658 FF3F41C0 24021E1B 456E7834 D7BA7532 55D36C33 520FFCFB BF5D82C3 65E7A155 9334C942`.trim().split(/\s+/);
if(codes.length!==188||new Set(codes).size!==188)throw new Error('Manifesto dos 188 inválido');
export const BATCH='diarios-188-2026-10-20';
export const urls=codes.map((code,i)=>i>=50&&i<76?`https://diariomunicipal.sc.gov.br/atos/${code}`:
  `https://www.diariomunicipal.com.br/${i<50?'amm-mg':i<88?'ama':i<138?'amp':'femurn'}/materia/${code}`);

const cimop='Consórcio Intermunicipal Multifinalitário dos Municípios do Oeste Potiguar';
const cisSerido='Consórcio Intermunicipal de Saúde do Seridó';
const ciedepar='Consórcio Intermunicipal de Educação e Ensino do Paraná';
// Citações são contíguas; fatos secundários são guardados separadamente, sem
// costurar frases como se fossem uma única citação ou inventar páginas de HTML.
export const accepted=new Map([
  [6,{categoria:'GOVERNANÇA',titulo:'Araporã consta como consorciado da AMVAP Saúde em aviso oficial',
    quote:'com execução no próprio Município de Araporã/MG, consorciado ao AMVAP SAÚDE',
    consorcio:'Consórcio Público Intermunicipal de Saúde do Triângulo Mineiro',sigla:'AMVAP SAÚDE',uf:'MG',municipio:'Araporã',
    etapa:'participação documentada em 2026; ingresso original desconhecido',participacao:true,
    motivo:'Aproveitado somente o vínculo explicitamente declarado no aviso. O futuro credenciamento fica fora; não comprova nova adesão nem exames já realizados.'}],
  [55,{categoria:'RATEIO',titulo:'Flor do Sertão: segundo aditivo de R$ 200 mil ao contrato com o CISAMERIOS',
    quote:'O presente Termo Aditivo tem por objeto aditar o valor correspondente ao EXCEDENTE a ser utilizado pelo município caso haja necessidade',
    consorcio:'Consórcio Público Interfederativo de Saúde da AMERIOS',sigla:'CISAMERIOS',uf:'SC',municipio:'Flor do Sertão',
    etapa:'aditivo publicado; utilização condicionada, pagamento não comprovado',
    tipo_documento:'aditivo ao contrato 13/2026',valor_aditivo_brl:200000,
    motivo:'Aditivo entre Fundo Municipal de Saúde e consórcio, com referência expressa à cláusula de rateio. O limite excedente é condicionado à necessidade; não é gasto efetuado nem novo ingresso.'}],
  [56,{categoria:'ATUAÇÃO',titulo:'Treviso e CISAMREC apostilam dotações do contrato 06/2026',
    quote:'Fica realizada a transferência do valor de R$ 20.000,00 (vinte mil reais) da dotação orçamentária nº 181, referente ao item 2 – Medicamentos, para a dotação orçamentária nº 183 do exercício de 2026.',
    consorcio:'Consórcio Público Interfederativo de Saúde da AMREC',sigla:'CISAMREC',cnpj:'13.791.885/0001-36',uf:'SC',municipio:'Treviso',
    etapa:'apostilamento firmado; alteração de dotação, não transferência paga',tipo_documento:'quarto apostilamento ao contrato 06/2026',
    valor_reclassificado_brl:20000,
    motivo:'Instrumento público firmado entre Treviso e CISAMREC altera somente dotações e mantém as demais cláusulas. Não comprova pagamento de R$ 20 mil, novo rateio, ingresso ou prestação executada.'}],
  [91,{categoria:'RATEIO',titulo:'CONSAMU publica três extratos de rateio com municípios do Paraná',
    quote:'Extratos dos contratos de rateio, firmados entre o Consórcio de Saúde dos Municípios do Oeste do PR – CONSAMU – CNPJ 17.420.047/0001-07 e os Municípios abaixo relacionados',
    consorcio:'Consórcio de Saúde dos Municípios do Oeste do Paraná',sigla:'CONSAMU',cnpj:'17.420.047/0001-07',uf:'PR',municipio:'',
    municipios:['Capitão Leônidas Marques','Braganey','Marechal Cândido Rondon'],participacao:true,
    etapa:'extratos de três instrumentos publicados; pagamento não comprovado',tipo_documento:'extratos de contratos de rateio',
    instrumentos:[{municipio:'Capitão Leônidas Marques',numero:'140/2026',valor_fonte:'5.646,45'},
      {municipio:'Braganey',numero:'137/2026',valor_fonte:'5.556,06'},
      {municipio:'Marechal Cândido Rondon',numero:'1/128/2026',valor_fonte:'-1.243.572,37'}],
    quoteExtra:['CAPITÃO LEÔNIDAS MARQUES 140/2026','BRAGANEY 137/2026','MARECHAL CÂNDIDO RONDON 1/128/2026'],
    motivo:'Uma publicação contém três extratos, conservados na lista de instrumentos. O sinal negativo do valor de Marechal Cândido Rondon é preservado como publicado, sem interpretá-lo como pagamento negativo ou corrigi-lo. Município do editor não é a parte de todos os contratos.'}],
  [92,{categoria:'ADESÃO',titulo:'CIEDEPAR homologa ingresso de Jardim Alegre e aprova alterações institucionais',
    quote:'a Assembleia APROVOU E HOMOLOGOU o ingresso do Município de Jardim Alegre no CIEDEPAR, passando o referido ente federado a integrar o Consórcio',
    consorcio:ciedepar,sigla:'CIEDEPAR',uf:'PR',municipio:'Jardim Alegre',participacao:true,ano_ingresso:2026,
    etapa:'ingresso homologado pela assembleia; não somente autorização legislativa',tipo_documento:'ata da 28ª assembleia extraordinária',
    quoteExtra:['a Assembleia APROVOU a alteração da Cláusula Cinquenta','a Assembleia APROVOU a atualização do referido Anexo I'],
    motivo:'A ata de 14/10 homologa o ingresso autorizado pela Lei 2.830/2026 e atualiza a relação de integrantes e o protocolo. As planilhas e minutas de rateio de 2027 foram aprovadas para futura formalização; não são contratos já assinados.'}],
  [95,{categoria:'ATUAÇÃO',titulo:'Jaguapitã publica acréscimo de R$ 9 mil ao contrato com o CISMEPAR',
    quote:'OBJETO: Acréscimo de valor ao Contrato nº 013/2026, destinado ao pagamento de participação financeira ao CISMEPAR',
    consorcio:'Consórcio Intermunicipal de Saúde do Médio Paranapanema',sigla:'CISMEPAR',cnpj:'00.445.188/0001-81',uf:'PR',municipio:'Jaguapitã',
    etapa:'aditivo unilateral publicado; pagamento e execução não comprovados',tipo_documento:'segundo aditivo unilateral ao contrato 013/2026',valor_aditivo_brl:9000,
    motivo:'O extrato identifica município e consórcio como partes e formaliza acréscimo de valor. Não rotular como contrato de rateio sem essa identificação, nem como pagamento realizado, novo ingresso ou atendimentos executados.'}],
  [109,{categoria:'ATUAÇÃO',titulo:'Secretária executiva do CONSUD ministra palestra em Pinhal de São Bento',
    quote:'Na sequência, a Sra. Ivone Faust Sponchiado deu início à palestra sobre resíduos sólidos',
    quoteExtra:['Ivone Faust Sponchiado, Secretária executiva do Consórcio Intermunicipal de Saúde do Sudoeste (CONSUD)'],
    consorcio:'Consórcio Intermunicipal de Saúde do Sudoeste',sigla:'CONSUD',uf:'PR',municipio:'Pinhal de São Bento',
    etapa:'palestra realizada; presença ativa, sem novo contrato',tipo_documento:'ata de reunião do plano de educação ambiental',
    motivo:'A ata identifica a secretária executiva do CONSUD como palestrante e relata sua palestra efetivamente iniciada. Não é mera presença passiva; as demais ações ambientais municipais não são atribuídas ao consórcio.'}],
  [112,{categoria:'GOVERNANÇA',titulo:'São Pedro do Paraná publica Lei 69/2026 alterando finalidades e estrutura do COMAFEN',
    quote:'Art. 1º O Contrato de Consórcio Público do CONSÓRCIO INTERMUNICIPAL DA APA FEDERAL DO NOROESTE DO PARANÁ - COMAFEN, cuja versão original está anexa ao presente Projeto de Lei, resta alterado',
    consorcio:'Consórcio Intermunicipal da APA Federal do Noroeste do Paraná',sigla:'COMAFEN',uf:'PR',municipio:'São Pedro do Paraná',
    etapa:'lei publicada; alteração contratual, não nomeação rotineira',tipo_documento:'lei municipal 69/2026',
    quoteExtra:['Art. 2º Cria-se o cargo de Chefe de Planejamento e Gestão em Saúde'],
    motivo:'Documento publicado como Lei 69/2026, com fórmula de sanção, altera finalidades de saúde e resíduos e cria cargo. A expressão residual “PROJETO DE LEI” é preservada, não ocultada. Não comprova ingresso municipal nem execução de novos serviços.'}],
  [113,{categoria:'ATUAÇÃO',titulo:'Iporã e Paraná Saúde firmam convênio 002/2026 de produtos de saúde',
    quote:'firmam o presente Convênio de acordo com os termos e condições a seguir estabelecidos',
    quoteExtra:['CONSÓRCIO INTERGESTORES PARANÁ SAÚDE, CNPJ nº 03.273.207/0001-28','recursos financeiros no valor de R$20.000 em parcela única'],
    consorcio:'Consórcio Intergestores Paraná Saúde',sigla:'',cnpj:'03.273.207/0001-28',uf:'PR',municipio:'Iporã',
    etapa:'convênio firmado; repasse previsto, não comprovado',tipo_documento:'convênio 002/2026',valor_previsto_brl:20000,
    motivo:'Instrumento público entre Iporã e Paraná Saúde firmado para aquisição e distribuição de produtos. R$ 20 mil são compromisso a repassar; não pagamento executado, entrega comprovada ou ingresso municipal.'}],
  [140,{categoria:'RATEIO',titulo:'Paraná/RN e CIMOP assinam rateio 2026025/001 para resíduos',
    quote:'DATA DA ASSINATURA: 14 de outubro de 2026.',quoteExtra:['EXTRATO DO CONTRATO DE RATEIO Nº 2026025/001.','Município consorciado nos repasses de obrigações financeiras ao CIMOP'],
    consorcio:cimop,sigla:'CIMOP',cnpj:'15.185.079/0001-40',uf:'RN',municipio:'Paraná',participacao:true,
    etapa:'rateio assinado; não adesão nem pagamento',tipo_documento:'contrato de rateio 2026025/001',valor_mensal_previsto_brl:8528.85,valor_exercicio_previsto_brl:25577.55,
    motivo:'Extrato identifica partes, objeto e assinatura. Prevê R$ 8.528,85 mensais e R$ 25.577,55 no exercício. Rateio é instrumento distinto do contrato de programa 025/2026 do mesmo projeto; não comprova ingresso novo nem repasse pago.'}],
  [141,{categoria:'RATEIO',titulo:'Currais Novos publica contrato de rateio com o CIM Seridó',
    quote:'ASSINANTES: Lucas Galvão da Cruz - Prefeito de Currais Novos/RN e Ivanildo Araújo de Albuquerque Filho - Presidente do CIM/SERIDÓ.',
    consorcio:'Consórcio Intermunicipal Multifinalitário da Região do Seridó',sigla:'CIM SERIDÓ',cnpj:'15.605.955/0001-40',uf:'RN',municipio:'Currais Novos',participacao:true,
    etapa:'contrato de rateio publicado; data original em agosto',tipo_documento:'rateio 3/2026 PMCN / 07/2026 CIM Seridó',valor_previsto_brl:74841,
    motivo:'É um só instrumento com numerações diferentes nas duas partes. Vigência inicia em 26/08/2026; a coleta em outubro não transforma a assinatura em fato de outubro. Valor previsto, sem prova de pagamento nem ano original de ingresso.'}],
  [144,{categoria:'RATEIO',titulo:'Equador e CIS Seridó firmam aditivo ao rateio 11/2026',
    quote:'Fica aditivado em R$ 173.111,00 (cento e setenta e três mil e cento e onze reais)',
    consorcio:cisSerido,sigla:'CIS SERIDÓ',cnpj:'12.397.803/0001-00',uf:'RN',municipio:'Equador',
    etapa:'aditivo firmado; não novo contrato nem pagamento',tipo_documento:'primeiro aditivo ao rateio 11/2026',valor_aditivo_brl:173111,valor_anual_revisado_brl:293111,
    motivo:'Termo assinado e datado de 09/10 acrescenta R$ 173.111 e informa valor anual revisado de R$ 293.111. Não somar os dois como repasses efetuados nem afirmar que os exames foram realizados.'}],
  [154,{categoria:'ATUAÇÃO',titulo:'Paraná/RN e CIMOP assinam contrato de programa 025/2026 para resíduos',
    quote:'DATA DA ASSINATURA: 14 de outubro de 2026.',quoteExtra:['EXTRATO DO CONTRATO DE PROGRAMA Nº 025/2026','VALOR ESTIMADO: R$ 8.528,85'],
    consorcio:cimop,sigla:'CIMOP',cnpj:'15.185.079/0001-40',uf:'RN',municipio:'Paraná',
    etapa:'contrato de programa firmado; execução e ingresso não comprovados',tipo_documento:'contrato de programa 025/2026',valor_mensal_estimado_brl:8528.85,valor_vigencia_estimado_brl:102352.14,
    motivo:'Programa de gestão associada de resíduos formalizado entre entes públicos. Preserva o total estimado publicado, inclusive diferença de R$ 5,94 em relação a 12 mensalidades; não corrige por conta própria nem afirma pagamento, entrega ou ingresso.'}],
  [173,{categoria:'PROTOCOLO',titulo:'Parelhas ratifica alterações do contrato do CIS Seridó pela Lei 2.919/2026',
    quote:'Art. 1º Ficam ratificadas nos termos da Lei Federal nº 11.107/2005, e demais disposições legais aplicáveis, as alterações realizadas no Protocolo de Intenções',
    quoteExtra:['do qual o Município de Parelhas/RN é ente consorciado'],
    consorcio:cisSerido,sigla:'CIS SERIDÓ',uf:'RN',municipio:'Parelhas',participacao:true,
    etapa:'alteração ratificada; participação anterior, não crise ocorrida',tipo_documento:'lei municipal 2.919/2026 e contrato consolidado',
    motivo:'O ato principal é ratificação das alterações e comprovação da participação de Parelhas. Cláusulas abstratas sobre inadimplência, saída ou extinção do consórcio não são acontecimentos. Não inferir ingresso em 2010 a partir de simples referência à lei anterior.'}],
  [181,{categoria:'FINANÇAS',titulo:'Encanto informa pagamento de R$ 5.592,76 ao CIMOP em relação financeira',
    quote:'Consórcio Intermunicipal Multifinalitário dos Municípios do Oeste Potiguar - CIMOP 5.592,76 09/10/2026 19/10/2026 Sim Não',
    quoteExtra:['Data de Liquidação Prazo para Pagamento Pagamento Efetuado? Pendências'],
    consorcio:cimop,sigla:'CIMOP',uf:'RN',municipio:'Encanto',
    etapa:'pagamento declarado na relação; data exata não identificada',tipo_documento:'relação de ordem cronológica de pagamentos',valor_pago_declarado_brl:5592.76,
    motivo:'A coluna Pagamento Efetuado? está marcada Sim. As datas são liquidação e prazo, não data efetiva de pagamento. O título diz setembro e a linha traz outubro: divergência preservada; somente o ano 2026 é utilizado. Não inferir rateio ou ingresso.'}],
  [185,{categoria:'ATUAÇÃO',titulo:'Ata de Itaú relata 519 atendimentos via COPIRN no segundo quadrimestre',
    quote:'Em relação à COPIRN – Consórcio Público Intermunicipal do Rio Grande do Norte, foi apresentada a realização de 519 atendimentos',
    consorcio:'Consórcio Público Intermunicipal do Rio Grande do Norte',sigla:'COPIRN',uf:'RN',municipio:'Itaú',
    etapa:'produção apresentada em ata; não apenas oferta futura',tipo_documento:'ata do Conselho Municipal de Saúde',atendimentos_relatados:519,periodo_relatado:'maio a agosto de 2026',
    motivo:'Ata de 02/10 apresenta RDQA de maio a agosto e descreve 519 atendimentos via COPIRN, com detalhamento. Não atribuir ao consórcio toda a produção municipal nem confundir os 519 com pessoas distintas ou municípios.'}],
]);

const personnel=new Set([7,8,83,96,98,104,119,134,135,136,155,158,159,160,161,162,163,164,165,174,182,187]);
const budget=new Set([18,93,97,99,108,114,117,118,123,124,125,127,133,147,170,188]);
const generic=new Set([26,81,86,115,129,146,157,167,186]);
const suspension=new Set([54,102,130,142]);
export function rejectReason(n){
  if(personnel.has(n))return {grupo:'pessoal_e_acompanhamento',motivo:'Ato rotineiro de pessoal, seleção, representação em conselho ou designação de fiscal/gestor de contrato. Não altera presidência, composição nem ato constitutivo; menção a estatuto é fundamento, não alteração.',pattern:/nomeia|exonera|designa|licen[cç]a|candidat|membros|pessoal/i};
  if(budget.has(n))return {grupo:'orcamento',motivo:'Abre, suplementa ou reorganiza dotação orçamentária. Rubrica de rateio ou manutenção de consórcio não comprova contrato celebrado, pagamento realizado nem ingresso municipal.',pattern:/or[cç]ament|cr[eé]dito|dota[cç]/i};
  if(generic.has(n))return {grupo:'referencia_generica',motivo:'Norma geral, regimento ou lista sem ato institucional específico de consórcio público. Referência a possíveis consórcios, competência legislativa ou consórcio empresarial não comprova vínculo ou acontecimento.',pattern:/cons[oó]rci/i};
  if(suspension.has(n))return {grupo:'ajuste_licitacao',motivo:'Suspensão ou revogação administrativa de procedimento de contratação/ata de preços. Não comprova ordem de fiscalização externa, crise institucional nem saída municipal do consórcio.',pattern:/suspens|revoga/i};
  if([110,156].includes(n))return {grupo:'rotina_operacional',motivo:n===156?'Conselho aprova substituição do prestador previsto em proposta de cirurgias, ainda sujeita a formalização. Ajuste operacional; não comprova crise, saída municipal ou interrupção de atendimentos.':'Disciplina procedimento operacional de intenção de registro de preços. Cita acórdão do TCE como fundamento, sem comprovar nova sanção, fiscalização ou alteração de estatuto/protocolo.',pattern:n===156?/substitui[cç][aã]o|altera[cç][aã]o do prestador/i:/procedimento de inten[cç][aã]o de registro/i};
  if(n===51)return {grupo:'contratacao_nao_formalizada',motivo:'Homologação de dispensa para contratar CISAMA em sinalização viária. O texto não é contrato ou convênio firmado, nem comprova execução. Preservado no acervo, sem promover a instrumento celebrado.',pattern:/homologa/i};
  return {grupo:'compras_e_fornecedores',motivo:'Licitação, credenciamento, contrato/aditivo rotineiro com fornecedor, ou adesão a ata de preços. Não é ingresso em consórcio, ratificação constitutiva ou serviço já executado; cláusulas hipotéticas não comprovam crise.',pattern:/licita[cç]|pre[cç]os|preg[aã]o|credenciamento|contratad[ao]|fornecedor|contrata[cç]|aquisi[cç][aã]o/i};
}
