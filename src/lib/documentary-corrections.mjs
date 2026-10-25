// Rules learned from the joint review. Match the operative document, not a
// mention in its legal foundations. Human reviews still take precedence.
export function documentaryCorrection(title, text, sourceUrl = '') {
  const head = text.slice(0, 900);
  const result = (category, proofKind, stage, reason, match) => match && ({ category, proofKind,
    stage, reason, evidenceText: match[0], evidenceOffset: match.index });
  const reject = (stage, reason, match) => result('GERAL', 'documentary_exclusion', stage, `rejeitado: ${reason}`, match);
  // Decide the operative act before scoring words in annexes and legal recitals.
  const court = /\bTribunal de Contas[^.!?]{0,100}?\b(?:confirmou|determinou|manteve) a suspens[aã]o\b[^.!?]{0,300}/i.exec(text);
  if (court && /\b(?:cons[oó]rcio|CIM[A-Z]*)\b/i.test(court[0]) && /cons[oó]rcio (?:p[uú]blico|intermunicipal|interfederativo)/i.test(title + ' ' + text.slice(0,700)) &&
      !/\b(?:n[aã]o|poderia|se|caso)\b/i.test(court[0].split(/confirmou|determinou|manteve/i)[0]))
    return result('CONTROLE','court_decision','suspensão confirmada/determinada pelo Tribunal; condenação definitiva não inferida',
      'órgão de controle e decisão efetiva identificados no corpo',court);
  const provisionalEntry = /\bDECIDE AUTORIZAR,?\s+em car[aá]ter ad referendum[^.!?]{0,150}?\bades[aã]o do Munic[ií]pio[^.!?]{0,220}?\bCons[oó]rcio[^.!?]{0,130}/i.exec(text);
  if (/^decis[aã]o administrativa/i.test(title) && provisionalEntry)
    return result('ADESÃO AUTORIZADA','legal_entry_authorization','aprovação provisória ad referendum; homologação pelo colegiado ainda pendente',
      'decisão autoriza participação provisória; não inferir homologação definitiva',provisionalEntry);
  const election = /\b(?:foi reeleito presidente do Cons[oó]rcio[^.!?]{0,170}|a chapa foi eleita por aclama[cç][aã]o[^.!?]{0,250}\bDiretoria\b[^.!?]{0,70})/i.exec(text);
  if (election && /\bcons[oó]rcio\b/i.test(text.slice(0,1000)) && !/\b(?:n[aã]o|teria|caso|se)\s+(?:a chapa\s+)?$/i.test(text.slice(Math.max(0,election.index-35),election.index)))
    return result('GOVERNANÇA','published_governance_rule','eleição/reeleição realizada; promessas, investimentos e entregas não inferidos',
      'resultado eleitoral afirmado no corpo, distinto de convocação futura',election);
  const dispute = /\binformou que recorreu [àa] Justi[cç]a para contestar a restri[cç][aã]o ao seu direito de voto[^.!?]{0,220}/i.exec(text);
  if (dispute && /\bcons[oó]rcio p[uú]blico\b/i.test(text.slice(Math.max(0,dispute.index-600),dispute.index)))
    return result('CRISE','reported_institutional_dispute','contestação judicial de regra eleitoral relatada; decisão judicial e novo consórcio não comprovados',
      'notícia atribui à gestora recurso contra restrição eleitoral; não confirma o mérito da alegação',dispute);
  const correction = /\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*Ficam retificados,? por erro material[^.!?]{0,270}\bContrato de Cons[oó]rcio P[uú]blico\b[^.!?]{0,80}/i.exec(text.slice(0,5000));
  const internalRule = /\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*Esta Resolu[cç][aã]o institui o regime jur[ií]dico[^.!?]{0,170}/i.exec(text.slice(0,2400));
  if (/^resolu[cç][aã]o\b/i.test(title) && /\bcons[oó]rcio\b/i.test(head) && (correction || internalRule))
    return result('GOVERNANÇA','published_governance_rule',correction
      ? 'retificação material do contrato consolidado publicada; novo contrato, protocolo e saída não comprovados'
      : 'regime jurídico dos cargos eletivos publicado; eleição e ingresso não inferidos',
      'dispositivo inicial define a norma publicada; cláusulas de anexos não são eventos ocorridos',correction || internalRule);
  const annualBudget = /\b(?:aprova a estimativa da receita e a autoriza[cç][aã]o da despesa do Cons[oó]rcio|a programa[cç][aã]o or[cç]ament[aá]ria estima a receita e autoriza a despesa)[^.!?]{0,200}/i.exec(text.slice(0,1800));
  if (/^(?:portaria|resolu[cç][aã]o)\b/i.test(title) && annualBudget && /\bAssembleia Geral do Cons[oó]rcio\b/i.test(text.slice(0,1600)))
    return result('FINANÇAS','consortium_budget_act','orçamento do próprio consórcio aprovado; receita arrecadada, despesa executada e rateio assinado não comprovados',
      'aprovação orçamentária do consórcio identificada, distinta de rubrica municipal',annualBudget);
  const municipalAnnualBudget = /\bestima a receita e fixa a despesa\b[^.!?]{0,220}/i.exec(head);
  if (/^lei\b/i.test(title) && municipalAnnualBudget && /\b(?:Prefeitura Municipal|Munic[ií]pio)\b/i.test(municipalAnnualBudget[0]))
    return reject('orçamento anual municipal; não comprova ato institucional do consórcio',
      'estimativa de receita e autorização de despesa municipal não são rateio firmado',municipalAnnualBudget);
  const fiscal = /\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*designar[^.!?]{0,240}\b(?:fiscaliza[cç][aã]o e controle do contrato|fiscais? do contrato)\b[^.!?]{0,100}/i.exec(text.slice(0,2200));
  if (/^portaria\b/i.test(title) && fiscal)
    return reject('designação de fiscais de contrato existente; sem nova celebração',
      'acompanhamento rotineiro do contrato não comprova novo rateio nem julgamento de controle',fiscal);
  const debtInquiry = /\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*Designar[^.!?]{0,240}\bpara avaliarem se h[aá] ou n[aã]o d[ií]vida pendente junto ao Cons[oó]rcio[^.!?]{0,150}/i.exec(text);
  if (/^portaria\b/i.test(title) && debtInquiry)
    return result('CONTROLE','initiated_inspection','comissão designada para apurar possível dívida; existência do débito e conclusão não comprovadas',
      'ato constitui apuração específica; não transformar dívida sob avaliação em crise confirmada',debtInquiry);
  const travel = /\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*Autorizar a concess[aã]o de di[aá]rias de viagem[^.!?]{0,240}/i.exec(text);
  if (/concess[aã]o de di[aá]rias de viagem/i.test(title) && travel)
    return reject('despesa administrativa de viagem autorizada; não é saída de município',
      'saída e retorno são datas de deslocamento de agente, sem mudança de composição municipal',travel);
  const procurementMetadata = /\ba presente retifica[cç][aã]o limita-se [àa] inclus[aã]o do identificador de registro[^.!?]{0,300}/i.exec(text.slice(0,2200));
  if (/^termo de retifica[cç][aã]o/i.test(title) && procurementMetadata)
    return reject('correção do cadastro de licitação; não comprova fiscalização realizada',
      'registro perante Tribunal de Contas não é decisão do Tribunal contra o consórcio',procurementMetadata);
  const administrativeSuspension = /\b(?:suspens[aã]o cautelar[^.!?]{0,150}at[eé] decis[aã]o administrativa ulterior|Motivo:\s*ADEQUA[CÇ][AÃ]O FASE INTERNA)[^.!?]{0,80}/i.exec(text);
  if (/suspens[aã]o/i.test(title) && administrativeSuspension && !/Tribunal de Contas|decis[aã]o judicial|determina[cç][aã]o judicial/i.test(text))
    return reject('suspensão administrativa de procedimento de compra; não é decisão de controle externo',
      'aviso do próprio consórcio não identifica julgamento, sanção ou crise institucional',administrativeSuspension);
  const privateProvider = /\be a Empresa\b.{0,240}?\binscrit[ao] no CNPJ/i.exec(text);
  if (/^termo de credenciamento/i.test(title) && privateProvider && /\b(?:CRE[D]?ENCIAD[AO]|CREDENCIADO)\b/i.test(text) && /\bfuturos contratos\b/i.test(text))
    return reject('credenciamento rotineiro de fornecedor para contratos futuros',
      'fornecedor privado credenciado; não comprova cooperação pública, execução nem mudança institucional',privateProvider);
  const contractErratum = /\bPermanecem inalteradas as demais informa[cç][oõ]es constantes da publica[cç][aã]o original\b/i.exec(text);
  if (/^retifica[cç][aã]o do extrato do contrato\b/i.test(title) && contractErratum && /\bConv[eê]nio de Sa[ií]da\b/i.test(text) && !/Contrato de Cons[oó]rcio P[uú]blico/i.test(head))
    return reject('errata de número e denominação em contrato anterior; não é retirada municipal',
      'convênio de saída é o nome do instrumento, sem ato de desligamento do consórcio',contractErratum);
  const privateConsortium = /\bparticipa[cç][aã]o em regime de cons[oó]rcio de empresas[^.!?]{0,160}/i.exec(text);
  if (/\b(?:chamada p[uú]blica|edital|preg[aã]o)\b/i.test(title) && privateConsortium &&
      !/\bcons[oó]rcio\s+(?:p[uú]blico|intermunicipal|interfederativo)\b/i.test(head))
    return reject('edital municipal admite empresas consorciadas; fora do escopo intermunicipal',
      'habilitação/falência hipotética de empresas não comprova crise de consórcio público',privateConsortium);
  // An open registry is an activity already started, not a completed mapping.
  const registration = /\bcons[oó]rcio\b[^.!?;]{0,150}?\b(?:lan[cç]ou|abriu)\s+(?:um[a]?\s+|o\s+|a\s+)?(?:mapeamento|cadastro|levantamento)\b[^.!?;]{0,200}/i.exec(text);
  const invitation = /\ba iniciativa convida\b[^.!?;]{0,260}\bparticiparem do cadastro\b/i.test(text);
  const registrationPrefix = registration && text.slice(Math.max(0, registration.index - 120), registration.index).split(/[.!?;]/).at(-1);
  if (/mapeamento|cadastro|levantamento/i.test(title) && registration && invitation &&
      !/\b(?:n[aã]o|pretende|pretendia|poderia|se|caso)\b/i.test(registrationPrefix + registration[0].split(/\blan[cç]ou\b|\babriu\b/i)[0]))
    return result('ATUAÇÃO', 'performed_institutional_activity',
      'cadastro aberto; mapeamento em andamento, conclusão não comprovada',
      'consórcio lançou o levantamento e abriu participação; classificar a etapa realizada', registration);
  const draft = /^(?:\[Página 1\]\s*)?PROJETO DE LEI\b/i.test(text.slice(0,150)) &&
    /\b(?:contamos com o apoio|para a aprova[cç][aã]o do presente projeto|consequente convers[aã]o em lei)\b/i.exec(text);
  if (draft) return reject('projeto ainda submetido à aprovação; a fórmula de sanção faz parte da minuta', 'projeto não é lei sancionada nem rateio celebrado', draft);
  const committee = /\bPARECER DA COMISS[AÃÀÁ]O\b/i.test(head) && /(?:^|\s)[eé] de parecer que seja encaminhado\b.{0,120}/i.exec(text);
  if (committee) return reject('parecer de comissão sobre projeto; sanção e ratificação não comprovadas', 'parecer/redação não comprova lei sancionada', committee);
  const amendedContract = /\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*fica ratificad[ao]\s+(?:a\s+)?altera[cç][aã]o\s+do\s+contrato\s+(?:de\s+cons[oó]rcio\s+p[uú]blico\s+do\s+|do\s+)?cons[oó]rcio\b[^.;]{0,330}/i.exec(text);
  const amendmentSummary = /\bEmenta\s*[“"]?RATIFICA\s+(?:AS?\s+)?ALTERA[CÇ](?:[AÃ]O|[OÕ]ES)\s+(?:PROMOVIDAS?\s+)?(?:NO|DO)\s+CONTRATO DE CONS[OÓ]RCIO P[UÚ]BLICO DO CONS[OÓ]RCIO\b[^“”"]{5,400}/i.exec(text);
  if (/^lei(?: municipal)?\b/i.test(title) && /^https:\/\/[^/?#]+\.leg\.br\/norma\/\d+(?:[/?#]|$)/i.test(sourceUrl) &&
      /\bTipo da Norma Jur[ií]dica Lei Municipal N[uú]mero \d+ Ano 20\d{2}\b/i.test(head) &&
      /\bData de Publica[cç][aã]o \d{2}\/\d{2}\/20\d{2}\b/i.test(head) && amendmentSummary)
    return result('GOVERNANÇA', 'published_governance_rule',
      'lei publicada segundo ficha legislativa; ementa ratifica alteração contratual; anexo, novo ingresso e constituição não comprovados',
      'ficha oficial identifica lei e data de publicação; confirmar somente a ratificação descrita na ementa', amendmentSummary);
  if (/^lei\b/i.test(title) && /\b(?:sanciona|sanciono|promulg[ao])\b/i.test(head) && amendedContract)
    return result('GOVERNANÇA', 'published_governance_rule',
      'ratificação de alteração contratual publicada; teor do anexo e novo ingresso não comprovados',
      'a ratificação publicada é o fato; não inventar o conteúdo do anexo nem adesão municipal', amendedContract);
  const operative = /\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*(?:(?:fica\s+)?(?:o poder executivo municipal\s+)?autorizad[oa]|esta lei autoriza)\b.{0,220}\b(?:ingresso|participa[cç][aã]o|aderir)\b.{0,240}\bcons[oó]rcio\b[^.;]{0,230}/i.exec(text.slice(0, 2200));
  if (/^lei\b/i.test(title) && operative && /\b(?:sanciono|sanciona|promulga)\b/i.test(head)) {
    const proof = result('ADESÃO AUTORIZADA', 'legal_entry_authorization',
      'autorização legal de ingresso/participação; adesão efetiva não comprovada',
      'dispositivo operativo da lei prevalece sobre cláusulas hipotéticas de retirada nos anexos', operative);
    const named = value => /\b(?:no|ao|do)\s*[“"]?(cons[oó]rcio\s+[^,;.“”"\n]{12,180})/i.exec(value)?.[1]?.trim();
    const ementa = named(text.slice(0, text.indexOf('Art.')));
    const article = named(operative[0]);
    const key = value => value?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ');
    if (ementa && article && !key(ementa).includes(key(article)) && !key(article).includes(key(ementa)))
      proof.documentConflict = { reason: `A ementa identifica “${ementa}”, mas o art. 1º identifica “${article}”. Confirmar o destinatário da autorização.`,
        checks: ['Conferir se os dois nomes pertencem à mesma pessoa jurídica no protocolo/CNPJ anexo.', 'Se forem consórcios distintos, obter retificação ou confirmação oficial do destinatário da lei.'] };
    return proof;
  }
  const voted = /\bprojeto foi colocado em segunda vota[cç][aã]o e reda[cç][aã]o final, sendo aprovado por unanimidade, seguindo para san[cç][aã]o do executivo Municipal\b/i.exec(text);
  if (/\bATA DA\b/i.test(head) && voted && /\bratifica a consolida[cç][aã]o do contrato de cons[oó]rcio p[uú]blico\b/i.test(text))
    return result('GOVERNANÇA','approved_legislative_project','projeto de consolidação aprovado na Câmara; sanção e vigência não comprovadas',
      'ata registra segunda votação e encaminhamento para sanção; não inferir nova adesão',voted);
  const staff = /(?:nomea[cç][aã]o|exonera[cç][aã]o) de servidores.{0,100}(?:emprego|comiss[aã]o)|\b(?:nomear|exonerar)\s+(?:o servidor|as servidoras|os servidores)\b/i.exec(text.slice(0, 1800));
  if (staff && /\bportaria\s+n[º°o.]?\s*\d+/i.test(head))
    return reject('rotina de pessoal; protocolo citado como fundamento não é ratificação', 'nomeação/exoneração de empregados, sem mudança constitutiva', staff);
  const electoral = /\b(?:convoca[cç][aã]o das elei[cç][oõ]es|designa[cç][aã]o de empregados p[uú]blicos para atuarem no processo de elei[cç][aã]o)\b/i.exec(text.slice(0, 1700));
  if (electoral && !/\b(?:foram eleitos|elegeu|eleita a diretoria|resultado final da elei[cç][aã]o)\b/i.test(text))
    return reject('preparação/convocação de eleição futura; diretoria eleita não comprovada', 'procedimento eleitoral preparatório, sem resultado', electoral);
  const taxCode = /\bc[oó]digo tribut[aá]rio municipal\b.{0,80}/i.exec(head);
  if (taxCode && /^lei\b/i.test(title))
    return reject('código tributário municipal; referências legais não são atos do consórcio', 'norma tributária geral do município', taxCode);
  const courtNotice = /\bem raz[aã]o de Decis[aã]o Monocr[aá]tica\b.{0,420}\bdeferiu medida cautelar determinando a imediata suspens[aã]o\b.{0,120}/i.exec(text);
  if (/^aviso de suspens[aã]o/i.test(title) && courtNotice && /\bcons[oó]rcio\s+intermunicipal\b/i.test(text))
    return result('CONTROLE', 'court_notice', 'suspensão cautelar determinada em decisão monocrática; não é condenação definitiva', 'aviso oficial identifica decisão, processo e suspensão efetiva do certame', courtNotice);
  const publicParties = /\b(?:munic[ií]pio|prefeitura municipal)\b.{0,260}\b(?:contratad[ao][\s.:]*|e o |e de outro lado.{0,10})cons[oó]rcio\b/i.test(text.slice(0, 2000)) ||
    /\b(?:munic[ií]pio|prefeitura municipal)\b.{0,1200}\b(?:contratad[ao]|e de outro lado).{0,25}cons[oó]rcio\b/i.test(text.slice(0, 2200));
  const formalized = /\b(?:data d[ae] assinatura\s*:|firmam o presente conv[eê]nio\b|resolvem celebrar\s*o presente\b|que entre si celebram\b)/i.test(text);
  const agreement = /\b(?:contrato de programa|contrato\s*administrativo|conv[eê]nio)\b.{0,120}/i.exec(text.slice(0, 700));
  const publishedAgreement = /^extrato de conv[eê]nio/i.test(title) && /contratante[\s.:]*prefeitura municipal.{0,120}contratada[\s.:]*cons[oó]rcio/i.test(text);
  if (agreement && publicParties && (formalized || publishedAgreement) && !/\b(?:minuta|modelo de contrato)\b/i.test(title))
    return result('ATUAÇÃO', 'public_service_agreement', 'instrumento município–consórcio publicado; execução, pagamento e novo ingresso não inferidos', 'partes públicas e objeto do instrumento identificados; fornecedor privado não é o fato aceito', agreement);
  const authorizedService = /\bo munic[ií]pio de.{1,90}torna p[uú]blico que foi efetuado o processo de dispensa de licita[cç][aã]o.{0,200}?artigo 75,\s*inciso XI.{0,330}?visando a contrata[cç][aã]o.{0,150}?para presta[cç][aã]o de servi[cç]os.{0,160}?\ba contrata[cç][aã]o ser[aá] realizada com o cons[oó]rcio intermunicipal[^.;]{0,160}/i.exec(text);
  const authorizationPrefix = authorizedService && text.slice(Math.max(0, authorizedService.index - 120), authorizedService.index).split(/[.!?;]/).at(-1);
  if (authorizedService && !/\b(?:minuta|modelo de aviso)\b/i.test(title) &&
      !/\b(?:n[aã]o|se|caso)\b/i.test(authorizationPrefix + authorizedService[0].split(/\btorna p[uú]blico\b/i)[0]))
    return result('COOPERAÇÃO AUTORIZADA', 'authorized_public_cooperation',
      'dispensa intermunicipal publicada; contrato firmado, execução e pagamento não comprovados',
      'município publicou a autorização para contratar serviço de consórcio; classificar somente a etapa autorizada', authorizedService);
  const budget = /\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*(?:fica este cons[oó]rcio autorizado\s*)?(?:a\s*)?abrir.{0,60}cr[eé]dito adicional suplementar\b.{0,240}/i.exec(text);
  if (/^(?:resolu[cç][aã]o|ato de cons[oó]rcio)/i.test(title) && budget && /\bpresidente do cons[oó]rcio\b/i.test(head))
    return result('FINANÇAS', 'consortium_budget_act', 'crédito suplementar do próprio consórcio autorizado; não comprova pagamento ou novo rateio', 'ato orçamentário do consórcio, distinto de rubrica genérica em orçamento municipal', budget);
  const receipt = /informa[cç][oõ]es da receita Tal[aã]o:\s*\d+\s*Data:\s*\d{2}\/\d{2}\/\d{4}\s*Valor:\s*R\$\s*[\d.,]+.{0,180}Origem:\s*MUNICIPIO\b.{0,120}/i.exec(text);
  if (receipt && /TRANSFER[EÊ]NCIAS DE MUNIC[IÍ]PIOS A CONS[OÓ]RCIOS P[UÚ]BLICOS/i.test(text))
    return result('FINANÇAS', 'recorded_receipt', 'receita municipal registrada no portal do consórcio; não comprova novo ingresso ou assinatura de rateio', 'talão, data, valor e ente de origem registrados na fonte oficial', receipt);
  const ldo = /disp[oõ]e\s+sobre[^.]{0,160}diretrizes\s+(?:or[cç]ament[aá]rias|para a elabora[cç][aã]o da lei or[cç]ament[aá]ria)[^.]{0,100}/i.exec(head);
  const municipalCredit = /\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*fica o poder executivo municipal[^.;]{0,140}?autorizado a abrir cr[eé]dito (?:adicional )?(?:especial|suplementar)\b/i.exec(text);
  const budgetHeading = /autoriza o poder executivo[^.]{0,160}(?:abertura de cr[eé]dito|abrir cr[eé]dito)/i.test(head);
  const budgetLine = /transfer[eê]ncias a cons[oó]rcios p[uú]blicos mediante contrato de rateio/i.exec(text);
  const openedCredit = /\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*fica aberto no or[cç]amento[^.;]{0,90}\bcr[eé]dito (?:adicional )?(?:especial|suplementar)\b/i.exec(text);
  if ((/^lei\b/i.test(title) && budgetHeading && municipalCredit || /^decreto\b/i.test(title) && /\bPrefeito do Munic[ií]pio\b/i.test(head) && openedCredit) && budgetLine &&
      !/\b(?:celebram|firmam|assinam)\s+(?:(?:o|presente)\s+)?contrato de rateio\b|\b(?:extrato|termo aditivo)\s+(?:ao|do)\s+contrato de rateio\b/i.test(text))
    return reject('crédito orçamentário municipal; rateio apenas em rubrica de dotação',
      'abertura de crédito e rubrica de transferência não comprovam contrato de rateio firmado ou pagamento', municipalCredit || openedCredit);
  if (/^lei\b/i.test(title) && ldo)
    return reject('LDO municipal; menções genéricas não comprovam ato do consórcio',
      'diretrizes orçamentárias não comprovam adesão, rateio assinado ou fiscalização', ldo);
  if (/^resolu[cç][aã]o\b/i.test(title) && /regimento interno da c[aâ]mara municipal/i.test(head))
    return reject('regimento da Câmara Municipal; não é ato de consórcio',
      'regimento parlamentar municipal fora do escopo', /disp[oõ]e sobre o regimento interno da c[aâ]mara municipal[^.]{0,120}/i.exec(head));
  if (/^ato de cons[oó]rcio\b/i.test(title)) {
    const schedule = /art\.?\s*1[º°.]?\s*alterar o cronograma de desembolso[^.]{0,240}/i.exec(text);
    if (schedule) return reject('ajuste do cronograma de desembolso; não comprova novo contrato ou pagamento',
      'rubrica de contrato de rateio não é celebração', schedule);
  }
  // Both the legal act and its operative ratification must be present. A
  // hypothetical protocol in a recital does not satisfy this condition.
  const ratification = /\bart\.?\s*1[º°o.]?\s*\.?(?:(?!\bn[aã]o\b|\bse\b|\bcaso\b).){0,420}?\b(?:fica ratificado,?\s*(?:em todos os seus termos,?\s*)?o|ratifica o) protocolo de inten[cç][oõ]es[^.]{0,300}/i.exec(text);
  if (/^lei\b/i.test(title) && /(?:sanciona|sanciono|promulg[ao])/i.test(head) && ratification)
    return result('PROTOCOLO', 'ratified_protocol',
      'ratificação legal do protocolo; ingresso homologado, constituição e rateio assinado não comprovados',
      'dispositivo legal ratifica protocolo; não inferir efeitos posteriores', ratification);
  if (/^resolu[cç][aã]o\b/i.test(title) && /\bcons[oó]rcio\b/i.test(head)) {
    const councils = /regulamenta a cria[cç][aã]o, a composi[cç][aã]o, a nomea[cç][aã]o, as compet[eê]ncias e o funcionamento dos conselhos consultivos regionais[^.]{0,300}/i.exec(head);
    if (councils) return result('GOVERNANÇA', 'published_governance_rule',
      'organização interna dos conselhos consultivos publicada; não é protocolo nem ingresso municipal',
      'norma interna descreve órgãos e competências do consórcio', councils);
  }
  const hypothetical = /visando a futura e eventual constitui[cç][aã]o de um cons[oó]rcio p[uú]blico/i.exec(text);
  if (/^lei\b/i.test(title) && /conv[eê]nio de coopera[cç][aã]o intermunicipal/i.test(head) && hypothetical)
    return reject('cooperação municipal autorizada; consórcio apenas eventual e futuro',
      'não há consórcio constituído, protocolo firmado nem atividade realizada por consórcio existente', hypothetical);
  return null;
}
