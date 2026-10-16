// Experimental evidence contracts. Category aliases alone never authorize an
// acceptance: both independent readings must prove the same supported fact.
import {fold} from './original-shadow-rules.mjs';

const contracts = {
  secondary_institutional_history: {type:'constituicao_historica', category:'CRIAÇÃO', aliases:['CRIAÇÃO','GOVERNANÇA'],
    check:q=>/consorcio intermunicipal/.test(q)&&/\b(?:estabelecido|constituido|criado) em (?:\d{1,2} de [a-z]+ de )?20\d{2}\b/.test(q)},
  protocol_amendment:{type:'alteracao_protocolo',category:'GOVERNANÇA',aliases:['GOVERNANÇA','PROTOCOLO'],
    check:q=>/fica ratificado o termo de alteracao do protocolo de intencoes/.test(q)&&/consorcio intermunicipal/.test(q)},
  delivered_recommendation:{type:'recomendacao_entregue',category:'CONTROLE',aliases:['CONTROLE','CRISE'],
    check:q=>/foi entregue aos participantes a recomendacao/.test(q)&&/promotorias/.test(q)},
  hosted_activity:{type:'atividade_sediada',category:'ATUAÇÃO',aliases:['ATUAÇÃO'],
    check:q=>/consorcio intermunicipal/.test(q)&&/\bsediou\b/.test(q)&&/\b(?:oficina|curso|seminario)\b/.test(q)},
  judicial_order:{type:'ordem_judicial',category:'CONTROLE',aliases:['CONTROLE'],
    check:q=>/consorcio intermunicipal/.test(q)&&(/\b(?:justica|juizo|tribunal) determinou que\b/.test(q)&&/\b(?:promovam|promova|regularize|realize|providencie)\b/.test(q)||/por sua vez, devera realizar/.test(q))},
  signed_partnership_context:{type:'acordo_firmado',category:'ATUAÇÃO',aliases:['ATUAÇÃO','COOPERAÇÃO AUTORIZADA'],
    check:q=>/\bfirmada em [a-z]+, a parceria preve\b/.test(q)},
};
export function factAgreement(rule, answer) {
  const c=contracts[rule.proofKind];
  if(!c)return {supported:false};
  const quotes=[rule.evidenceText,answer.evidencia].map(fold);
  const unsafe=/\b(?:nao|nunca|seria|supostamente|poderia|pretende)\b/;
  const matches=c.category===rule.category && c.aliases.includes(answer.categoria) && answer.tipo_fato===c.type &&
    quotes.every(q=>c.check(q)&&!unsafe.test(q));
  return {supported:true,matches,type:c.type};
}

// Split only explicitly enumerated process blocks. No editorial IDs, registry
// aliases or title guesses. Spans refer to the complete stored original body.
export function processSegments(body) {
  const starts=[...body.matchAll(/\b(?:Um dos processos,|Outro processo,|J[aá] o terceiro processo,)/g)];
  if(starts.length<2)return [];
  return starts.map((m,i)=>{
    const start=m.index,end=starts[i+1]?.index??body.length,text=body.slice(start,end);
    const process=/\b(?:n[uú]mero|n\.)\s*(\d{6,})/.exec(text)?.[1];
    return {start,end,text,process:process||null,
      hasDispositive:/\b(?:manteve suspensa|foi suspensa|decis[aã]o foi confirmada|determinou|julgou)\b/i.test(text),
      limitation:/acompanharam o voto/.test(text)&&!/\b(?:suspensa|confirmada|determinou|julgou)\b/.test(text)?'voto acompanhado sem resultado específico neste trecho':null};
  });
}
