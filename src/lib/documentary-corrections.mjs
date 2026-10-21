// Rules learned from the joint review. Match the operative document, not a
// mention in its legal foundations. Human reviews still take precedence.
export function documentaryCorrection(title, text) {
  const head = text.slice(0, 900);
  const result = (category, proofKind, stage, reason, match) => match && ({ category, proofKind,
    stage, reason, evidenceText: match[0], evidenceOffset: match.index });
  const reject = (stage, reason, match) => result('GERAL', 'documentary_exclusion', stage, `rejeitado: ${reason}`, match);
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
