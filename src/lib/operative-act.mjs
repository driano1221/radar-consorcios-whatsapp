// Read the operative act before treating vocabulary in its recitals/annexes as events.
export function operativeAct(title,text) {
  const head=text.slice(0,2600),law=/^(?:republica[cç][aã]o da )?lei\b/i.test(title),resolution=/^resolu[cç][aã]o\b/i.test(title);
  const result=(category,proofKind,stage,reason,match)=> {
    if(!match)return null;
    const before=text.slice(0,match.index).split(/[.!?;]/).at(-1).slice(-90);
    if(category!=='GERAL'&&/\b(?:n[aã]o|caso|hip[oó]tese|se)\b/i.test(before))return null;
    return {category,proofKind,stage,reason,evidenceText:match[0],evidenceOffset:match.index};
  };
  const reject=(stage,reason,match)=>result('GERAL','documentary_exclusion',stage,`rejeitado: ${reason}`,match);
  const consortium=/\bcons[oó]rci[oa]/i.test(text);
  if(!consortium)return null;
  const staffRoutine=/\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*(?:dispor sobre a concess[aã]o de f[eé]rias|(?:designar|nomear)\s+fiscal\s+(?:do|de)\s+contrato)[^.;]{0,280}/i.exec(head);
  if(/^(?:portaria|resolu[cç][aã]o)\b/i.test(title)&&staffRoutine)
    return reject('rotina de pessoal ou fiscalização administrativa do contrato',
      'protocolo citado como fundamento não é ratificação; designar fiscal não comprova fiscalização realizada',staffRoutine);
  const executive=/\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*nomear[\s\S]{0,220}?cargo de\s*secret[aá]rio\s*executivo[\s\S]{0,120}?cons[oó]rcio[^.;]{0,120}/i.exec(head);
  if(/^portaria\b/i.test(title)&&executive)
    return result('GOVERNANÇA','published_governance_rule','secretário executivo nomeado; referendo posterior e posse não inferidos',
      'ato operativo nomeia a direção executiva; não é movimentação de empregado comum',/para ocupar o cargo de\s*secret[aá]rio\s*executivo[\s\S]{0,120}?cons[oó]rcio[^.;]{0,120}/i.exec(text));
  const interim=/\bassume interinamente a presid[eê]ncia do Cons[oó]rcio[^.!?]{0,220}/i.exec(text);
  if(/presid[eê]ncia interina/i.test(title)&&interim&&/licen[cç]a|afastamento tempor[aá]rio/i.test(text)&&
    !/\b(?:n[aã]o|poder[aá]|caso|se)\s*$/i.test(text.slice(Math.max(0,interim.index-25),interim.index)))
    return result('GOVERNANÇA','published_governance_rule','substituição interina da presidência relatada; mandato titular e entregas preservados',
      'corpo informa o exercício interino durante licença, sem inferir nova eleição',interim);
  const authorization=/\bart\.?\s*[12][º°o.]?\s*[.–—-]?\s*(?:fica\s+(?:o\s+)?(?:poder executivo|munic[ií]pio)[^.;]{0,140}?|esta lei[^.;]{0,80}?)autorizad[oa]\s+a\s+participar\b[^.;]{0,270}?cons[oó]rcio[^.;]{0,180}/i.exec(head);
  if(authorization&&/\b(?:sanciono|sanciona|promulg[ao])\b/i.test(head)&&!/^(?:projeto|minuta)\b/i.test(title))
    return result('ADESÃO AUTORIZADA','legal_entry_authorization','participação autorizada em lei; subscrição e ingresso efetivo não comprovados',
      'dispositivo autoriza município identificado a participar de consórcio determinado',authorization);
  const simPolicy=/\bart\.?\s*1[º°o.]?\s*[.–—-]?\s*esta lei\s+(?:cria|estabelece normas)[^.;]{0,380}?inspe[cç][aã]o[^.;]{0,220}/i.exec(head);
  if(simPolicy&&/\bservi[cç]o de inspe[cç][aã]o municipal\b/i.test(head)&&
    !/\bcons[oó]rcio\s+(?:intermunicipal|interfederativo|regional|interestadual)\b/i.test(text))
    return reject('serviço de inspeção municipal instituído; cooperação consorcial apenas genérica',
      'lei municipal não identifica ingresso ou instrumento com consórcio determinado; norma não comprova inspeção realizada',simPolicy);
  const procurement=/\b(?:ades[aã]o\s+(?:n[.º°o]*\s*\d+\/20\d{2},?\s*)?a\s*(?:arp|ata de registro de pre[cç]o)|termo de ades[aã]o a ata de registro de pre[cç]o)[^;]{0,240}/i.exec(head);
  if(procurement&&/\b(?:contratada|empresa|fornecimento|aquisi[cç][aã]o)\b/i.test(text))
    return reject('adesão a ata de preços; não é ingresso em consórcio',
      'instrumento compra de fornecedor; consórcio gerencia a ata, sem nova participação municipal',procurement);
  const privateAccreditation=/\b(?:e de outro|e,? de outro lado,?)\s+a empresa[^;]{0,160}?\b(?:LTDA|S\.?\s*A\.)/i.exec(head);
  if(/^termo de credenciamento/i.test(title)&&privateAccreditation)
    return reject('credenciamento de fornecedor privado; sem alteração institucional',
      'credenciamento para serviços administrativos não comprova nova cooperação pública ou serviço regional executado',privateAccreditation);
  const signedRateio=/\b(?:firmado\s+em\s+\d{2}\/\d{2}\/20\d{2}|assinam\s+(?:pela|o presente)|celebram o presente termo aditivo|que entre si celebram)\b[^.;]{0,220}/i.exec(text);
  if(/contrato de rateio/i.test(text.slice(0,700))&&signedRateio&&/\bmunic[ií]pio|prefeitura municipal/i.test(head)&&
    !/^(?:minuta|projeto)/i.test(title)&&(/rateio/i.test(title)||/termo aditivo/i.test(head)))
    return result('RATEIO','documented_rateio',/aditivo/i.test(title+' '+head)
      ?'aditivo de rateio formalizado; pagamento e novo ingresso não comprovados':'rateio publicado com partes e assinantes; pagamento não comprovado',
      'texto identifica município, consórcio e celebração/assinantes do instrumento',
      Object.assign([text.slice(0,Math.max(650,signedRateio.index+signedRateio[0].length))],{index:0}));
  const reportRateio=/\bN[uú]mero Contrato:\s*\d+\s+N[uú]mero Aditivo:[\s\S]{0,60}?Objeto:\s*\.?\s*O contrato de rateio\b[\s\S]{0,350}?Nome\s*\/\s*CNPJ:\s*CONS[OÓ]RCIO\b[\s\S]{0,180}?Data Assinatura:\s*\d{2}\/\d{2}\/20\d{2}/i.exec(text);
  if(/^extrato dos contratos/i.test(title)&&/\bMUNIC[IÍ]PIO DE\b/i.test(head)&&reportRateio)
    return result('RATEIO','documented_rateio','rateio individualizado no relatório com consórcio e data de assinatura; demais contratos não confundidos',
      'bloco próprio do contrato contém objeto de rateio, contratado público e assinatura; não é dotação genérica',reportRateio);
  const reintegration=/\bfoi registrado o retorno e a reintegra[cç][aã]o do munic[ií]pio[^.;]{0,200}?ao cons[oó]rcio\b/i.exec(text);
  if(/\bata\b/i.test(title)&&reintegration)
    return result('ADESÃO','documented_composition','retorno municipal registrado em ata; data do ingresso original não inferida',
      'ata relata reintegração efetiva, distinta de pauta ou autorização futura',reintegration);
  const firstVote=/\bas (?:\w+\s+)?propostas foram apreciadas em primeira vota[cç][aã]o e contaram com a aprova[cç][aã]o de todos os vereadores\b/i.exec(text);
  if(/\bprojetos\b/i.test(title)&&firstVote)
    return result('GOVERNANÇA','approved_legislative_project','projetos consorciais aprovados em primeira votação; segunda votação, sanção, extinção e ingresso não comprovados',
      'notícia relata etapa legislativa realizada; objetos dos projetos não são mudanças consumadas',firstVote);
  const consortiumActivity=/\bcons[oó]rcio\b[^.!?]{0,120}?\b(?:promoveu|avan[cç]ou)\b[^.!?]{0,300}/i.exec(text);
  if(consortiumActivity&&/webin[aá]rio|assembleia de prefeitos/i.test(title+' '+head)&&
    !/\b(?:n[aã]o|pretende|caso|se)\s*$/i.test(text.slice(Math.max(0,consortiumActivity.index-25),consortiumActivity.index)))
    return result('ATUAÇÃO','performed_institutional_activity','encontro/discussão regional realizado; projetos e entregas futuros não inferidos',
      'texto relata atividade realizada pelo consórcio; referência a protocolo anterior não é assinatura nova',consortiumActivity);
  const meeting=/\bestiveram reunidos com representantes do Cons[oó]rcio[^.!?]{0,230}/i.exec(text);
  if(meeting&&/Confedera[cç][aã]o Nacional de Munic[ií]pios/i.test(head))
    return result('ATUAÇÃO','performed_institutional_activity','reunião técnica realizada; serviços e adesões não comprovados',
      'representantes do consórcio participaram de encontro efetivo, sem inferir execução das propostas',meeting);
  const partnership=/\bcons[oó]rcio\b[^.!?]{0,120}?\b(?:firmou|assinou)\b[^.!?]{0,230}?\b(?:termo|parceria|coopera[cç][aã]o)\b[^.!?]{0,220}/i.exec(head);
  if(partnership&&/universidad|institui[cç][oõ]es de ensino/i.test(head)&&
    !/\b(?:nao|podera|caso|se|pretende)\b/i.test(partnership[0].split(/\b(?:firmou|assinou)\b/i)[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'')))
    return result('ATUAÇÃO','signed_cooperation','cooperação acadêmica firmada; execução, recursos e benefícios futuros não comprovados',
      'termo assinado relatado no corpo; agenda futura não equivale a entrega realizada',partnership);
  const convocation=/\bficam convocados[^.!?]{0,320}?assembl[eé]ia geral\b/i.exec(text)||/\bconvoca[^.!?]{0,260}?assembl[eé]ia geral\b/i.exec(text);
  if(/edital.*convoca[cç][aã]o|edital.*assembl[eé]ia geral/i.test(title)&&convocation)
    return reject('convocação de assembleia futura; pautas ainda não deliberadas',
      'edital convoca reunião; eleição, aprovação e alteração institucional não comprovadas',convocation);
  const selfSuspension=/\best[aá] suspensa em virtude de an[aá]lise e resposta a um pedido de impugna[cç][aã]o\b/i.exec(text);
  if(/aviso de suspens[aã]o/i.test(title)&&selfSuspension)
    return reject('suspensão administrativa para responder impugnação; sem julgamento externo',
      'aviso registra etapa da licitação; não é decisão do Tribunal nem crise institucional',selfSuspension);
  const controlRequest=/\bTribunal de Contas[^!?]{0,180}?encaminhou[^!?]{0,220}?solicitando esclarecimentos[^.!?]{0,300}/i.exec(text);
  if(/^despacho/i.test(title)&&controlRequest&&/DECIDE:\s*REVOGAR/i.test(text))
    return result('CONTROLE','initiated_inspection','ofício de fiscalização e resposta publicados; revogação administrativa, sem condenação',
      'despacho documenta questionamento efetivo do órgão de controle; não atribuir a ele a revogação feita pelo consórcio',controlRequest);
  const proposal=/\bapresenta [àa] judiciosa aprecia[cç][aã]o[^.]{0,150}o seguinte projeto de lei/i.exec(head);
  if(/^projeto de lei\b/i.test(title)&&proposal)return reject('projeto submetido à Câmara; ratificação e lei sancionada não comprovadas',
    'texto proposto e anexo não comprovam ratificação legal em vigor ou crise ocorrida',proposal);
  const recital=/\bCONSIDERANDO o Decreto [A-Z]+ que institui as normas internas[^;]{0,650}/.exec(text);
  if(/^di[aá]rio oficial/i.test(title)&&recital&&[...text.matchAll(/\bcons[oó]rcio\b/gi)].length===1)
    return reject('diário municipal; consórcio citado somente em fundamento de ato ambiental municipal',
      'única menção é referência a norma preexistente no considerando, sem novo ato do consórcio',recital);
  const request=/\bN[º°o.]\s*\d+\/\d{4}\s*[–—-]\s*Vereador[^.]{0,140}\bPresid[eê]ncia do Cons[oó]rcio[^.]{0,160}\bSolicitando informa[cç][oõ]es[^.]{0,250}/i.exec(text);
  if(/^di[aá]rio oficial/i.test(title)&&request&&[...text.matchAll(/\bcons[oó]rcios?\b/gi)].length===1&&
    /REQUERIMENTOS SUJEITOS A DESPACHO DO PRESIDENTE/i.test(text.slice(Math.max(0,request.index-5000),request.index)))
    return reject('requerimento de informação sujeito a despacho; apuração e julgamento não comprovados',
      'único registro consorcial é pedido de informação ainda sujeito a despacho; não comprova fiscalização realizada nem ato institucional do consórcio',request);

  if(law||/^decreto\b/i.test(title)) {
    const credit=/(?:abre cr[eé]dito suplementar ao or[cç]amento|abertura de cr[eé]dito adicional (?:especial|suplementar)|altera o quadro de detalhamento de despesas|estabelece o or[cç]amento do munic[ií]pio|estabelece as diretrizes or[cç]ament[aá]rias|disp[oõ]e sobre as diretrizes para a elabora[cç][aã]o da lei or[cç]ament[aá]ria)[^.]{0,180}/i.exec(head);
    if(credit&&/\bprefeito\b|\bor[cç]amento (?:do munic[ií]pio|desta prefeitura)/i.test(head)&&
      !/\b(?:extrato|termo aditivo)\s+(?:ao|do)\s+contrato de rateio\b|\b(?:celebram|assinam|firmam)\s+(?:o |presente )?contrato de rateio/i.test(text))
      return reject('orçamento/crédito municipal; contratação e repasse não comprovados',
        'rubricas e autorizações orçamentárias municipais não comprovam ato próprio do consórcio ou rateio firmado',credit);
    const ratification=/\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*fica[m]?\s+ratificad[ao]s?\b.{0,230}?\b(?:altera[cç][aã]o|altera[cç][oõ]es)\b.{0,200}?\b(?:contrato|protocolo|cons[oó]rcio)\b[^.;]{0,220}/i.exec(head);
    if(law&&ratification&&/\b(?:sanciono|sanciona|promulg[ao])\b/i.test(head))
      return result('GOVERNANÇA','published_governance_rule','ratificação de alteração contratual/protocolo publicada; não é novo ingresso nem novo rateio',
        'dispositivo inicial ratifica alteração de instrumento já existente; cláusulas do anexo não são fatos ocorridos',ratification);
    const rateioAuthorization=/\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*fica o poder executivo municipal autorizado a celebrar termo aditivo ao contrato de rateio[^.;]{0,280}/i.exec(head);
    if(law&&rateioAuthorization&&/\b(?:sanciono|sanciona|promulg[ao])\b/i.test(head))
      return result('RATEIO EM TRAMITAÇÃO','published_governance_rule','aditivo de rateio autorizado em lei; assinatura, repasse e pagamento não comprovados',
        'autorização legal específica para aditivo; a etapa não é contrato assinado',rateioAuthorization);
    const revenue=/\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*os valores recolhidos pelo cons[oó]rcio.{0,500}?passam a ser considerados receita or[cç]ament[aá]ria do pr[oó]prio cons[oó]rcio/i.exec(text);
    if(law&&revenue)return result('FINANÇAS','consortium_budget_act','incorporação de IRRF à receita do consórcio autorizada; arrecadação e pagamento não verificados',
      'lei disciplina receita própria; referência a controle judicial é cláusula condicional, não crise comprovada',revenue);
    const policy=/\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*esta lei institui a pol[ií]tica municipal de saneamento b[aá]sico[^.]{0,300}/i.exec(head);
    const namedConsortium=/\bcons[oó]rcio (?:intermunicipal|interfederativo|regional|p[uú]blico de (?:sa[uú]de|desenvolvimento|gest[aã]o|saneamento))\b/i.test(text)||
      [...text.matchAll(/\bcons[oó]rcio p[uú]blico\s+(\p{L}+)/giu)].some(([,name])=>name.length>=3&&name===name.toUpperCase()&&!['DOS','DAS','PARA'].includes(name));
    if(law&&policy&&!namedConsortium)
      return reject('política municipal de saneamento; cooperação consorcial apenas genérica',
        'norma municipal cita formas possíveis de gestão; não identifica ingresso ou instrumento com consórcio determinado',policy);
    const rateioRule=/\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*os valores repassados pelo munic[ií]pio[^.]{0,320}ser[aã]o reajustados anualmente[^.]{0,140}/i.exec(text);
    if(law&&rateioRule)return result('GOVERNANÇA','published_governance_rule','regra de reajuste e vigência publicada; novos contratos e pagamentos não comprovados',
      'lei regula contratos futuros e limites administrativos; não comprova assinatura nem ingresso',rateioRule);
  }
  const rateioWaiver=/\bfica\s+autorizad[ao]\s+a\s+dispensa de licita[cç][aã]o\s+para\s+contrato de rateio com\s+(?:o\s+)?[A-Z][A-Z0-9-]{2,20}\s*\([^)]{0,400}\bcons[oó]rcio\b[^)]{0,400}\)/i.exec(text);
  if(rateioWaiver&&/^(?:di[aá]rio oficial|dispensa de licita[cç][aã]o)\b/i.test(title)&&
    !/\b(?:minuta|projeto|cancelad[ao]|revogad[ao])\b/i.test(text.slice(Math.max(0,rateioWaiver.index-600),rateioWaiver.index)))
    return result('RATEIO EM TRAMITAÇÃO','published_governance_rule',
      'dispensa para rateio autorizada; contrato assinado, repasse e pagamento não comprovados',
      'ato publicado autoriza contratação direta com consórcio identificado; confirmar somente essa etapa, sem inferir celebração do contrato',rateioWaiver);
  const presidency=/\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*formalizar o afastamento tempor[aá]rio[^.]{0,300}/i.exec(head);
  if(/^ato da presid[eê]ncia/i.test(title)&&presidency)return result('GOVERNANÇA','published_governance_rule',
    'afastamento temporário e substituição estatutária publicados; titularidade do mandato preservada',
    'ato modifica temporariamente o exercício da presidência; citação do protocolo não é nova ratificação',presidency);
  const regulation=/\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*fica aprovado o regimento interno do cons[oó]rcio[^.]{0,230}/i.exec(head);
  const allowance=/\bart\.?\s*\d[º°o.]?\s*[).–—-]?\s*conceder a revis[aã]o dos valores referente a indeniza[cç][aã]o a t[ií]tulo de di[aá]ria[^.]{0,250}/i.exec(head);
  if(resolution&&(regulation||allowance))return result('GOVERNANÇA','published_governance_rule',
    regulation?'regimento interno aprovado; cláusulas de saída não comprovam desligamento ocorrido':'regra de diárias/reembolso revisada; pagamento individual não comprovado',
    'norma interna do consórcio publicada; referências legais não alteram o objeto do ato',regulation||allowance);
  const cession=/\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*ceder a servidora? p[uú]blic[ao] municipal[^.]{0,160}/i.exec(head);
  if(/^portaria\b/i.test(title)&&cession)return reject('cessão administrativa de pessoal; protocolo já existente apenas citado',
    'movimentação de servidora não constitui ratificação de protocolo nem alteração de composição municipal',cession);
  const staff=/\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*fica designada,?[^.]{0,270}\bpara atuar nas inspe[cç][oõ]es permanentes[^.]{0,150}/i.exec(head);
  if(/^portaria\b/i.test(title)&&staff)return reject('designação de servidora para inspeção municipal já consorciada',
    'lotação administrativa não comprova adesão nova nem fiscalização efetivamente realizada',staff);
  const holiday=/\b(?:transfer[eê]ncia do ponto facultativo|suspens[aã]o do expediente administrativo)[^.]{0,190}/i.exec(head);
  if(holiday&&/\b(?:dia do servidor|feriado|ponto facultativo)\b/i.test(head))return reject('calendário administrativo; sem sanção ou fiscalização externa',
    'suspensão do expediente por ponto facultativo não é suspensão por órgão de controle',holiday);

  const cooperation=/\btermo de coopera[cç][aã]o t[eé]cnica e finan[cç]eira\b[^.]{0,90}/i.exec(head);
  if(cooperation&&/\bmunic[ií]pio\b/i.test(head)&&/resolvem celebrar o presente termo de coopera[cç][aã]o/i.test(head)&&!/\bminuta\b/i.test(head))
    return result('ATUAÇÃO','public_service_agreement','termo município–consórcio publicado; vigência retroativa, execução e pagamentos não inferidos',
      'instrumento de cooperação técnico-financeira identifica as partes; confirmar somente o instrumento publicado',cooperation);
  if(/^extrato do contrato de rateio\b/i.test(title)&&/\bconcedente:\s*munic[ií]pio\b/i.test(text)&&
    /\bproponente:\s*cons[oó]rcio\b/i.test(text)&&/\bdata:\s*\d{2}\/\d{2}\/\d{4}/i.test(text))
    return result('RATEIO','documented_rateio','extrato de rateio publicado com partes, valor, vigência e data; pagamento não comprovado',
      'extrato identifica ente e consórcio, sem inferir novo ingresso',/\bOBJETO:\s*Rateio[^.]{0,450}/i.exec(text));
  const suspension=/\b(?:fica SUSPENSO[^.]{0,110}|torna p[uú]blico a SUSPENS[AÃ]O da sess[aã]o p[uú]blica do preg[aã]o)/i.exec(text);
  if(/suspens[aã]o/i.test(title)&&suspension&&(/conveni[eê]ncia e oportunidade administrativa/i.test(text)||/^aviso de suspens[aã]o$/i.test(title))&&
    !/tribunal|judici|ministerio p[uú]blico|minist[eé]rio p[uú]blico|irregular|fraud|suspeit|ilegal/i.test(text))
    return reject('aviso de procedimento de compra suspenso; não comprova decisão de controle externo',
      'suspensão da sessão/procedimento sem prova de julgamento ou crise institucional',suspension);
  const arp=/\b(?:contrata[cç][aã]o atrav[eé]s da ades[aã]o da ata|torna p[uú]blico o interesse em aderir [àa] ata de registro de pre[cç]o)[^.]{0,210}/i.exec(text);
  if(arp)return reject('adesão a ata de preços/compra de fornecedor; não é ingresso no consórcio',
    'objeto da adesão é ata de registro de preços, não pessoa jurídica consorcial',arp);
  const exclusion=/\baditamento para exclus[aã]o de especialidade e profissionais aptos[^.]{0,200}/i.exec(text);
  if(exclusion&&/\bcredenciada:\s*[^.]{0,120}\bLTDA\b/i.test(text))return reject('aditivo de credenciamento de fornecedor; exclusão de especialidade não é saída municipal',
    'retirada de serviços/profissionais de empresa credenciada não altera a composição do consórcio',exclusion);
  const supplier=/\b(?:e,? de outro lado,? a empresa|e a Empresa)\b.{0,180}/i.exec(head);
  if(supplier&&/\b(?:CONTRATO \(TERMO DE CREDENCIAMENTO\)|CONTRATO DE FORNECIMENTO|CONTRATO N[º°.]?\s*\d)/i.test(head))
    return reject('contrato rotineiro com fornecedor privado; cláusulas de fiscalização não são julgamento',
      'objeto é credenciamento/fornecimento privado; não é instrumento município–consórcio',supplier);
  const vehicle=/\b(?:adquiriu|investiu[^.]{0,60}na aquisi[cç][aã]o de)\b[^.]{0,180}\bcaminhonete\b[^.]{0,100}/i.exec(text);
  if(vehicle&&/recursos pr[oó]prios|atividades administrativas/i.test(text))return reject('aquisição administrativa de veículo; utilização futura não é entrega de serviço regional',
    'compra de caminhonete administrativa não comprova fato institucional das sete famílias',vehicle);
  const penalty=/\b(?:TCEMG|Tribunal de Contas[^.]{0,100})\s+aprovou,?\s+em sess[aã]o[^.]{0,150}aplica[cç][aã]o de multas[^.]{0,180}cons[oó]rcios p[uú]blicos/i.exec(text);
  if(penalty)return result('CONTROLE','court_decision','multas e determinações aprovadas pelo Tribunal; cumprimento e trânsito em julgado não inferidos',
    'notícia do Tribunal relata decisão efetiva contra consórcios, não simples norma ou cadastro',penalty);
  const operation=/\bO Cons[oó]rcio Intermunicipal[^.]{0,80}\brealizou,?[^.]{0,130}\bOpera[cç][aã]o ABC\+Seguro\b[^.]{0,80}/i.exec(text);
  if(operation)return result('ATUAÇÃO','performed_institutional_activity','operação integrada de segurança realizada; não é fiscalização do consórcio por Tribunal',
    'operação com guardas municipais executada; menção a protocolos não é protocolo constitutivo',operation);
  const launched=/\bO Cons[oó]rcio Intermunicipal[^.]{0,90}\blan[cç]ou,?[^.]{0,220}\bo programa\b[^.]{0,190}/i.exec(text);
  if(launched)return result('ATUAÇÃO','performed_institutional_activity','programa institucional lançado; projetos anunciados, festival e entregas futuros não comprovados',
    'corpo relata lançamento realizado pelo consórcio; propostas que integram o programa não são entregas executadas',launched);
  const seminar=/\bTribunal de Contas[^.]{0,100}\breuniu,?[^.]{0,180}especialistas[^.]{0,160}cons[oó]rcios p[uú]blicos/i.exec(text);
  if(seminar&&/semin[aá]rio/i.test(title)) {
    const event=result('ATUAÇÃO','performed_institutional_activity','seminário/orientação sobre consórcios realizado; nenhuma saída municipal comprovada',
      'evento institucional de capacitação realizado; exemplos debatidos não são episódios ocorridos nesta notícia',seminar);
    return event&&{...event,scope:'orientacao_geral'};
  }
  const works=/\bA Prefeitura[^.]{0,220}\bobras[^.]{0,200}\bprojeto de engenharia elaborado pelo Cons[oó]rcio[^.]{0,130}/i.exec(text);
  if(works)return result('ATUAÇÃO','reported_ongoing_work','início de obra municipal com projeto do consórcio relatado; conclusão e financiamento da obra não inferidos',
    'notícia diferencia projeto elaborado pelo consórcio e execução pela prefeitura; gargalos históricos não são crise atual',works);
  const presentation=/\bA Confedera[cç][aã]o Nacional de Munic[ií]pios[^.]{0,30}se reuniu com[^.]{0,230}\bapresentar o Cons[oó]rcio[^.]{0,120}/i.exec(text)||
    (/\bapresentaram o Cons[oó]rcio Nacional\b/i.test(text)&&/\bConfedera[cç][aã]o Nacional de Munic[ií]pios[^.]{0,30}realizou atendimentos t[eé]cnicos[^.]{0,200}/i.exec(text));
  if(presentation)return result('ATUAÇÃO','performed_institutional_activity','reunião técnica e apresentação do consórcio realizadas; adesão municipal e serviços futuros não comprovados',
    'reunião documentada de orientação; possibilidade de apoio não equivale a ingresso ou atendimento executado',presentation);
  return null;
}
