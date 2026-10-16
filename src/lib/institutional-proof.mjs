import { normalizeWhitespace } from './text.mjs';
export const INSTITUTIONAL_REVIEW_POLICY = 'Aceite como ATUAÇÃO a visita técnica ou reunião efetivamente conduzida pelo consórcio, mesmo sem contrato ou entrega, distinguindo mera presença passiva. Descarte simples convocação e pauta futura. Uma composição municipal explicitamente afirmada no corpo pode ser aceita como GOVERNANÇA mesmo em notícia de seleção de pessoal: aceite apenas a composição, sem inferir ano de ingresso, operação iniciada, CNPJ ou confundir associação apoiadora com consórcio. Propostas discutidas não são planos aprovados. Negação, hipótese ou atribuição a outro ator não comprovam atuação.';

// Subject, completed verb and object must occur in the same sentence. A title,
// a future agenda or a list of guests cannot establish consortium activity.
const NAME = String.raw`Cons[oó]rcio\s+(?:P[uú]blico\s+)?Intermunicipal\s+(?:d[aeo]s?\s+)?[A-ZÀ-Ý][^.!?;:]{2,145}?`;
const ACTIVITY = new RegExp(String.raw`\b${NAME}\s+(?:realizou|promoveu|conduziu)\b[^.!?;:]{0,85}?\b(?:visita t[eé]cnica|reuni[aã]o)\b[^.!?;]{0,220}`, 'gi');
const RECEIVED = new RegExp(String.raw`\b${NAME}\s+recebeu\b[^.!?;:]{0,100}?\b(?:representantes?|vice-presidente|presidente|secret[aá]ri[oa]|comitiva)\b[^.!?;]{0,270}?\bpara\s+(?:discutir|debater|tratar)\b[^.!?;]{0,120}`, 'gi');
const SIGNED_COOPERATION = new RegExp(String.raw`\b${NAME}\s+e\s+(?:o|a)\s+(?:Instituto|Universidade|Minist[eé]rio|Associa[cç][aã]o)\b[^.!?;:]{3,90}?\s+(?:firmaram|assinaram)\b[^.!?;:]{0,90}?\b(?:um\s+)?acordo\s+de\s+coopera[cç][aã]o\s+t[eé]cnica\b`, 'gi');
const SIGNED_PROTOCOL = /\b(?:Prefeitos de \d+ Munic[ií]pios|Munic[ií]pios de)[^.!?;:]{3,180}?\bassinaram\s+o\s+protocolo\s+de\s+inten[cç][oõ]es\b[^.!?;:]{0,90}?\bCons[oó]rcio\s+(?:Nacional|P[uú]blico|Intermunicipal)\b[^.!?;]{5,180}/gi;
const NAME_ONLY = new RegExp(String.raw`\b${NAME}(?=,|[.!?;:]|\s+(?:realizou|recebeu|promoveu|conduziu|e\s+o\s+Cons[oó]rcio)\b)`, 'g');
const UNSAFE = /\b(?:n[aã]o|nunca|teria|supostamente|alegou|negou|se|caso|talvez)\b|[“”"]/i;
const FUTURE = /\b(?:convoca|convocou|convoca[cç][aã]o)\b[^.!?]{0,220}\bassembleia\b[^.!?]{0,130}\b(?:ser[aá]\s+realizada|realizar-se-[aá]|acontecer[aá])\b/i;

export function institutionalProof(item) {
  const text = normalizeWhitespace(item.rawText || '');
  if (text.length < 160 || item.kind === 'gazette' ||
      /^(?:lei|projeto de lei|contrato|resolu[cç][aã]o|portaria|di[aá]rio oficial)\b/i.test(item.title || '')) return null;
  for (const pattern of [ACTIVITY, RECEIVED, SIGNED_COOPERATION, SIGNED_PROTOCOL]) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      const clauseStart = Math.max(text.lastIndexOf('.', match.index - 1), text.lastIndexOf('!', match.index - 1), text.lastIndexOf('?', match.index - 1)) + 1;
      if (UNSAFE.test(text.slice(clauseStart, match.index) + match[0]) ||
          /\b(?:participou|acompanhou|informou|relatou|afirmou|anunciou)\b/i.test(match[0].split(/\b(?:realizou|promoveu|conduziu|recebeu)\b/i)[0])) continue;
      if(pattern===SIGNED_COOPERATION)return {category:'ATUAÇÃO',proofKind:'signed_cooperation',
        stage:'acordo de cooperação técnica firmado; execução e benefícios entregues não comprovados',
        reason:'partes identificadas e assinatura relatada no corpo; não é mera intenção',evidenceText:match[0],evidenceOffset:match.index};
      if(pattern===SIGNED_PROTOCOL)return {category:'PROTOCOLO',proofKind:'signed_municipal_protocol',
        stage:'protocolo de intenções subscrito; ingresso efetivo e constituição não comprovados',
        reason:'prefeitos/municípios assinaram protocolo; não inferir adesão consumada',evidenceText:match[0],evidenceOffset:match.index};
      return { category: 'ATUAÇÃO', proofKind: 'performed_institutional_activity',
        stage: 'atividade institucional realizada; acordos, planos aprovados e entregas não inferidos',
        reason: 'consórcio é o agente da visita/reunião realizada, não mero participante ou anúncio',
        evidenceText: match[0], evidenceOffset: match.index };
    }
  }
  // An explicit composition statement may be useful even inside recruitment
  // news. Do not infer which consortium a pronoun refers to if names conflict.
  const names = [...text.matchAll(NAME_ONLY)].map(m => m[0].trim());
  const distinct = [...new Set(names)];
  const composition = /\b[Oo] cons[oó]rcio é formado (?:por|pelos?) (?:munic[ií]pios de )?([^.!?;:]{10,260})[.!?]/.exec(text);
  if (composition && distinct.length === 1) {
    const list = composition[1].split(/,\s*|\s+e\s+/).map(s => s.trim());
    const nameSyntax = /^[A-ZÀ-Ý][\p{L}'’-]+(?:\s+(?:[A-ZÀ-Ý][\p{L}'’-]+|d[aeo]s?|do|das|dos))*$/u;
    if (list.length >= 2 && list.length <= 20 && list.every(s => nameSyntax.test(s)) && new Set(list).size === list.length &&
        !UNSAFE.test(text.slice(Math.max(0, composition.index - 60), composition.index)) &&
        !/\b(?:Empresas?|Bancos?|Institutos?|Associa[cç][oõ]es|Prefeitos?)\b/i.test(composition[1]))
      return { category: 'GOVERNANÇA', proofKind: 'documented_composition', participationEvidence: true,
        compositionMunicipalities: list, compositionConsortium: distinct[0],
        stage: 'composição explicitamente documentada; ingresso original e início de operação desconhecidos',
        reason: 'aproveitar somente a composição expressa; seleção de pessoal não é o fato aceito',
        evidenceText: composition[0], evidenceOffset: composition.index };
  }
  const future = FUTURE.exec(text);
  if (future && !/\b(?:aprovou|deliberou|elegeu|realizou|ocorreu|firmou|assinou|inaugurou)\b/i.test(text))
    return { category: 'GERAL', proofKind: 'future_convocation',
      stage: 'convocação e pautas futuras; realização e aprovação não comprovadas',
      reason: 'rejeitado: simples convocação, sem fato realizado', evidenceText: future[0], evidenceOffset: future.index };
  return null;
}
