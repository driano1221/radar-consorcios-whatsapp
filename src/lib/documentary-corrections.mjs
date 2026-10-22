// Rules learned from the joint review. Match the operative document, not a
// mention in its legal foundations. Human reviews still take precedence.
export function documentaryCorrection(title, text) {
  const head = text.slice(0, 900);
  const result = (category, proofKind, stage, reason, match) => match && ({ category, proofKind,
    stage, reason, evidenceText: match[0], evidenceOffset: match.index });
  const reject = (stage, reason, match) => result('GERAL', 'documentary_exclusion', stage, `rejeitado: ${reason}`, match);
  const draft = /^(?:\[Página 1\]\s*)?PROJETO DE LEI\b/i.test(text.slice(0,150)) &&
    /\b(?:contamos com o apoio|para a aprova[cç][aã]o do presente projeto|consequente convers[aã]o em lei)\b/i.exec(text);
  if (draft) return reject('projeto ainda submetido à aprovação; a fórmula de sanção faz parte da minuta', 'projeto não é lei sancionada nem rateio celebrado', draft);
  const committee = /\bPARECER DA COMISS[AÃÀÁ]O\b/i.test(head) && /(?:^|\s)[eé] de parecer que seja encaminhado\b.{0,120}/i.exec(text);
  if (committee) return reject('parecer de comissão sobre projeto; sanção e ratificação não comprovadas', 'parecer/redação não comprova lei sancionada', committee);
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
  const budget = /\bart\.?\s*1[º°o.]?\s*[-–—.]?\s*(?:fica este cons[oó]rcio autorizado\s*)?(?:a\s*)?abrir.{0,60}cr[eé]dito adicional suplementar\b.{0,240}/i.exec(text);
  if (/^(?:resolu[cç][aã]o|ato de cons[oó]rcio)/i.test(title) && budget && /\bpresidente do cons[oó]rcio\b/i.test(head))
    return result('FINANÇAS', 'consortium_budget_act', 'crédito suplementar do próprio consórcio autorizado; não comprova pagamento ou novo rateio', 'ato orçamentário do consórcio, distinto de rubrica genérica em orçamento municipal', budget);
  const receipt = /informa[cç][oõ]es da receita Tal[aã]o:\s*\d+\s*Data:\s*\d{2}\/\d{2}\/\d{4}\s*Valor:\s*R\$\s*[\d.,]+.{0,180}Origem:\s*MUNICIPIO\b.{0,120}/i.exec(text);
  if (receipt && /TRANSFER[EÊ]NCIAS DE MUNIC[IÍ]PIOS A CONS[OÓ]RCIOS P[UÚ]BLICOS/i.test(text))
    return result('FINANÇAS', 'recorded_receipt', 'receita municipal registrada no portal do consórcio; não comprova novo ingresso ou assinatura de rateio', 'talão, data, valor e ente de origem registrados na fonte oficial', receipt);
  const ldo = /disp[oõ]e\s+sobre[^.]{0,160}diretrizes\s+(?:or[cç]ament[aá]rias|para a elabora[cç][aã]o da lei or[cç]ament[aá]ria)[^.]{0,100}/i.exec(head);
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
  const ratification = /\bart\.?\s*1[º°o.]?\s*\.?(?:(?!\bn[aã]o\b|\bse\b|\bcaso\b).){0,420}?\bfica ratificado,?\s*(?:em todos os seus termos,?\s*)?o protocolo de inten[cç][oõ]es[^.]{0,300}/i.exec(text);
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
