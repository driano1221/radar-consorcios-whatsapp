// Shadow experiment only: never imported by collector, catalog or sender.
import {prepareV5,decideV5,readV5,locateQuote} from './original-v5.mjs';
import {entityProven} from './original-shadow-rules.mjs';
import {factAgreement} from './shadow-facts.mjs';
export const VERSION='original-shadow-6.0';
export const RULE_VERSION='original-rules-6.2';
const policy=`\nDistinguish WHO owns a meeting from WHO attends it. A completed assembly OF the public consortium, corroborated by discussion during that meeting, is its institutional activity even when the sentence's grammatical subject is an invited prosecutor. Passive attendance BY a consortium at another organization's event is not enough. Use tipo_fato=assembleia_realizada, category ATUAÇÃO, and quote the completed participation + ownership clause; do not infer agreements, financing, service expansion or membership from mere discussion or a facility's beneficiaries.
Read a pending bill's historical clauses separately from its proposed enactment. If it explicitly reports that an identified consortium's amended contract WAS deliberated by member entities at a dated general assembly and refers to its published minutes, that prior deliberation can be GOVERNANÇA, tipo_fato=deliberacao_anterior_relatada. Quote the PAST deliberation clause with its consortium, not 'ficam ratificadas' from a proposed article. Municipal ratification remains proposed. Published minutes mentioned by the bill are NOT minutes you have independently read. Record only that bounded historical fact, not a sanctioned law or effective municipal admission. A mere future assembly or proposed amendment is insufficient. Do not classify the pending bill and its supporting historical assembly as independent completed acts. Routine technical road-maintenance project approval (without delivered works) stays outside, even if issued by a consortium.`;
const unsafe=/\b(?:n[aã]o|nunca|supostamente|teria|poderia|pretende|caso)\b/i;
function mainBody(body){return body.split(/\bLEIA TAMB[EÉ]M\b|\bNOT[IÍ]CIAS RELACIONADAS\b/i)[0];}

export function completedAssembly(body){
  const b=mainBody(body);
  const re=/[^.!?]*\bparticipou (?:de|em) uma (?:assembleia|reuni[aã]o) do (Cons[oó]rcio (?:P[uú]blico )?(?:Intermunicipal|Interfederativo)\s+[^.!?]{2,160}?)\s+para\s+[^.!?]{8,650}[.!?]/gi;
  const hosted=/[^.!?]*\bmunic[ií]pio de [^.!?]{2,100}?\s+sediou,?[^.!?]{0,100}\ba assembleia geral (?:ordin[aá]ria|extraordin[aá]ria) do (Cons[oó]rcio (?:P[uú]blico )?(?:Intermunicipal|Interfederativo)\s+[^.!?]{2,180})[.!?]/gi;
  const hits=[...b.matchAll(re),...b.matchAll(hosted)];if(hits.length!==1)return null;
  const m=hits[0];if(unsafe.test(m[0]))return null;
  const rest=b.slice(m.index+m[0].length,m.index+m[0].length+900);
  const corroboration=/^\s*((?:Durante o encontro,[^.!?]{3,220}\b(?:abordaram|discutiram|debateram)\b|O encontro reuniu[^.!?]{3,220}\bpara discutir)\b[^.!?]{5,400}[.!?])/i.exec(rest);
  if(!corroboration||unsafe.test(corroboration[1]))return null;
  return {kind:'assembleia_realizada',entity:m[1],evidence:m[0].trim(),support:corroboration[1],
    reason:'Assembleia do próprio consórcio já realizada, com discussão relatada. Não comprova acordo firmado, recurso liberado, expansão de atendimento nem nova adesão municipal.'};
}

export function hostedOpening(body){
  const b=mainBody(body),hits=[...b.matchAll(/[^.!?]*\b(Cons[oó]rcio (?:P[uú]blico )?Intermunicipal[^.!?]{2,100}?)\s+recebeu,?[^.!?]{0,85}\ba aula inaugural do curso[^.!?]{5,350}[.!?]/gi)];
  if(hits.length!==1||unsafe.test(hits[0][0]))return null;
  const m=hits[0],support=/A aula inaugural foi ministrada[^.!?]{5,500}[.!?]/i.exec(b.slice(m.index+m[0].length));
  if(!support||unsafe.test(support[0]))return null;
  return {kind:'atividade_sediada',entity:m[1],evidence:m[0].trim(),support:support[0],
    reason:'O consórcio recebeu uma aula inaugural já ministrada. Não comprova conclusão de todo o curso nem realização das etapas seguintes.'};
}

export function enactedConsolidation(item){
  const b=mainBody(item.rawText);
  if(!/^Lei\b/i.test(item.title)||/projeto de lei|minuta/i.test(item.title)||
    /o presente projeto de lei|\bminuta\b/i.test(b)||
    !/FAZ SABER que a C[aâ]mara Municipal aprovou e eu promulgo a seguinte/i.test(b))return null;
  const q=/Fica ratificado, em todos os seus termos, o texto consolidado do Contrato de Cons[oó]rcio P[uú]blico e respectivo Estatuto Social do (Cons[oó]rcio Intermunicipal[^.!?]{3,180}?), do qual o Munic[ií]pio[^.!?]{3,100}[.!?]/i.exec(b);
  const support=/A presente ratifica[cç][aã]o abrange todas as altera[cç][oõ]es estatut[aá]rias formalizadas[^.!?]{3,400}[.!?]/i.exec(b);
  if(!q||!support||unsafe.test(q[0])||unsafe.test(support[0]))return null;
  return {kind:'consolidacao_estatutaria_ratificada',entity:q[1],evidence:q[0],support:support[0],
    reason:'Lei promulgada ratifica a consolidação do contrato e do estatuto de consórcio existente. Não comprova novo ingresso nem criação.'};
}

export function deniedRumorOnly(p){
  const b=p.item.rawText;
  if(p.rule.category!=='GERAL'||b.length>2400||
    /\b(?:ratificou|assinou|assinaram|firmou|firmaram|aprovou|aprovaram|celebraram|deliberou|realizou|sediou|participou|reuniu|determinou|instaurou|entregou|recebeu|criou|instituiu|deu in[ií]cio|foi (?:aprovad[oa]|assinad[oa]|realizad[oa]|firmad[oa]|ratificad[oa]|entregue))\b/i.test(b))return null;
  const q=/rebateu informa[cç][oõ]es[^.!?]{0,250}suposto fim do Cons[oó]rcio[^.!?]{0,220}\.\s*Segundo[^.!?]{0,100}a informa[cç][aã]o n[aã]o procede[^.!?]{0,180}\./i.exec(b);
  if(!q||!/a proposta discutida[^.!?]{0,180}n[aã]o prev[eê] o encerramento[^.!?]{0,180}uni[aã]o/i.test(b))return null;
  return q[0];
}

export function priorAssemblyInBill(body){
  const b=mainBody(body);
  if(!/apresenta [aà] C[aâ]mara[^.!?]{0,160}\bo presente Projeto de Lei/i.test(b)||
    !/solicito a aprova[cç][aã]o do presente Projeto de Lei/i.test(b))return null;
  const re=/O texto consolidado do Contrato de Cons[oó]rcio P[uú]blico do (CONS[OÓ]RCIO[^;]{8,230}?),\s*(?:j[aá] incluso[^,]{1,100},\s*)?foi consolidado e deliberado pelos entes consorciados,\s*na A\.G\.O\. do dia (\d{2}\/\d{2}\/(20\d{2}))\s+[^;]{0,200}?conforme ATA publicada no DOM[^;]{0,100}?edi[cç][aã]o N[º°.]\s*\d+/gi;
  const hits=[...b.matchAll(re)];if(hits.length!==1)return null;
  const m=hits[0];
  const prefix=b.slice(Math.max(0,m.index-80),m.index);
  if(unsafe.test(m[0])||/(?:n[aã]o [eé] verdade que|hip[oó]tese|exemplo fict[ií]cio)\s*[:—-]?\s*$/i.test(prefix))return null;
  return {kind:'deliberacao_anterior_relatada',entity:m[1],evidence:m[0],year:Number(m[3]),
    reason:'O projeto relata deliberação anterior dos consorciados sobre alteração do contrato. A ratificação municipal continua proposta; a ata citada não foi conferida neste teste.',
    sourceQualification:'deliberação anterior relatada em projeto de lei; ato original não conferido'};
}

export function prepareV6(row,stored){
  const p=prepareV5(row,stored);if(!p.eligible)return p;
  const rumor=deniedRumorOnly(p);
  if(rumor)return {...p,rule:{...p.rule,category:'GERAL',score:0,policyExclusion:'denied_rumor_and_proposal_only',
    proofKind:'denied_rumor_and_proposal_only',stage:'boato negado e proposta em discussão; sem crise ou união consumada',evidenceText:rumor,
    reasons:['Notícia nega o encerramento e relata somente proposta de união em discussão; não comprova crise institucional nem alteração consumada.']}};
  const assembly=completedAssembly(p.item.rawText),prior=priorAssemblyInBill(p.item.rawText),opening=hostedOpening(p.item.rawText),consolidation=enactedConsolidation(p.item);
  const facts=[assembly,prior,opening,consolidation].filter(Boolean);
  if(facts.length>1)return {...p,v6Conflict:true};
  const fact=facts[0];
  if(!fact||p.segments.length||p.rule.policyExclusion)return p;
  return {...p,v6Fact:fact,rule:{...p.rule,category:assembly||opening?'ATUAÇÃO':'GOVERNANÇA',score:8,
    stage:assembly?'assembleia do consórcio realizada, sem presumir aprovação de propostas':opening?'aula inaugural realizada, curso não necessariamente concluído':consolidation?'lei promulgada ratifica consolidação de contrato e estatuto':'deliberação anterior relatada; ratificação municipal ainda proposta',
    proofKind:fact.kind,evidenceText:fact.evidence,evidenceParts:[fact.evidence,...(fact.support?[fact.support]:[])],
    policyExclusion:null,reasons:[fact.reason],...(prior?{sourceQualification:fact.sourceQualification,reportedYear:fact.year}:{})}};
}
export const readV6=(p,options)=>readV5(p,{...options,additionalPolicy:policy,policyVersion:VERSION});
// Repair only verifiable response structure, not its substantive verdict.
// Preserve the raw model answer in the report. No second call/reroll is made.
export function normalizeV6Answer(p,review){
  if(!p.eligible||!review?.answer||typeof review.answer!=='object')return {review,repairs:[]};
  const a={...review.answer},repairs=[],body=p.item.rawText;
  const name=a.evidencia_entidade;
  if(!a.entidade&&a.relevante===true&&a.escopo==='entidade'&&typeof name==='string'&&
    name.length>=25&&name.length<=220&&/^CONS[OÓ]RCIO (?:P[UÚ]BLICO )?(?:INTERMUNICIPAL|INTERFEDERATIVO) [\p{L}\p{N} (),–—-]+$/iu.test(name)&&
    !/\b(?:munic[ií]pio|prefeitura|representado|celebram|e o cons[oó]rcio)\b/i.test(name)&&locateQuote(body,name)){
    a.entidade=locateQuote(body,name).text;repairs.push('nome_omitido_recuperado_da_citacao_integral_da_ia');
  }
  if(p.rule.proofKind==='hosted_activity'&&a.tipo_fato==='outro'&&a.categoria==='ATUAÇÃO'&&
    factAgreement(p.rule,{...a,tipo_fato:'atividade_sediada'}).matches&&locateQuote(body,a.evidencia)){
    a.tipo_fato='atividade_sediada';repairs.push('tipo_generico_normalizado_por_duas_provas_de_atividade_sediada');
  }
  if(p.rule.proofKind==='delivered_recommendation'&&a.tipo_fato==='recomendacao_entregue'&&
    !factAgreement(p.rule,a).matches){
    const quotes=(Array.isArray(a.evidencias_complementares)?a.evidencias_complementares:[]).filter(q=>locateQuote(body,q)&&factAgreement(p.rule,{...a,evidencia:q}).matches);
    if(new Set(quotes).size===1){a.evidencia=quotes[0];repairs.push('prova_de_recomendacao_localizada_no_complemento_da_ia');}
  }
  // Legislative approval of a protocol bill is not enacted municipal law or
  // completed membership. Normalize two labels only when BOTH proofs say so.
  const approval=q=>/C[aâ]mara Municipal[^.!?]{2,100}aprovou,?[^.!?]{0,100}projeto que ratifica o protocolo de inten[cç][oõ]es[^.!?]{0,120}Cons[oó]rcio/i.test(q)&&!unsafe.test(q);
  if(p.rule.category==='ADESÃO AUTORIZADA'&&a.relevante===true&&a.categoria==='PROTOCOLO'&&
    approval(p.rule.evidenceText)&&approval(a.evidencia)&&locateQuote(body,a.evidencia)){
    a.categoria='ADESÃO AUTORIZADA';repairs.push('aprovacao_legislativa_de_projeto_com_rotulo_normalizado');
  }
  return {review:{...review,answer:a},repairs};
}
export function decideV6(p,review,{expectedVersion=VERSION}={}){
  if(p.v6Conflict)return {decision:'pendente',reason:'fatos_distintos_exigem_separacao'};
  if(p.process&&p.segmentLimitation)return {decision:'pendente',reason:'segmento_sem_resultado_exige_documento_primario',
    process:p.process,sourceSpan:p.sourceSpan,parentTextHash:p.parentTextHash,limitation:p.segmentLimitation};
  const normalized=normalizeV6Answer(p,review);
  let result=decideV5(p,normalized.review,{expectedVersion});
  if(normalized.repairs.length)result={...result,responseRepairs:normalized.repairs,modelAnswer:review.answer};
  if(result.decision==='aceito'&&p.rule.proofKind==='delivered_recommendation')result={...result,
    reason:'Recomendação do Ministério Público entregue; medidas e respostas solicitadas, sem presumir condenação, dissolução, regularização executada ou irregularidade institucional definitivamente comprovada.',modelReason:review.answer.justificativa};
  if(result.decision==='aceito'&&normalized.repairs.includes('aprovacao_legislativa_de_projeto_com_rotulo_normalizado'))result={...result,
    stage:'projeto aprovado pela Câmara; sanção, ingresso efetivo e operação não comprovados',
    reason:'A Câmara aprovou projeto de ratificação do protocolo para participação no consórcio. A notícia não comprova sanção municipal, ingresso efetivo ou início da operação.',modelReason:review.answer.justificativa};
  if(result.decision!=='aceito'||!p.v6Fact)return {...result,reading:'v6_shadow'};
  const f=p.v6Fact,a=review.answer,q=locateQuote(p.item.rawText,a.evidencia);
  // Both readings must locate the SAME fact, owner, stage and literal body.
  // Neither a category agreement nor the rule's proof can replace AI evidence.
  const expectedTypes=f.kind==='consolidacao_estatutaria_ratificada'?['alteracao_protocolo','consolidacao_estatutaria_ratificada']: [f.kind];
  const proofMatches=f.kind==='assembleia_realizada'?
    /(?:participou (?:de|em) uma (?:assembleia|reuni[aã]o)|sediou[^.!?]{0,100}a assembleia geral (?:ordin[aá]ria|extraordin[aá]ria)) do Cons[oó]rcio/i:
    f.kind==='atividade_sediada'?/recebeu,?[^.!?]{0,85}a aula inaugural do curso/i:
    f.kind==='consolidacao_estatutaria_ratificada'?/Fica ratificado, em todos os seus termos, o texto consolidado do Contrato de Cons[oó]rcio P[uú]blico e respectivo Estatuto Social/i:
    /foi consolidado e deliberado pelos entes consorciados,\s*na A\.G\.O\. do dia/i;
  const sameFact=q&&expectedTypes.includes(a.tipo_fato)&&entityProven(p.item.rawText,a.entidade,f.entity)&&
    entityProven(p.item.rawText,a.entidade,q.text)&&
    proofMatches.test(q.text)&&
    !unsafe.test(q.text);
  if(!sameFact)return {decision:'pendente',reason:'prova_da_etapa_e_do_titular_divergente',reading:'v6_shadow'};
  const ruleLocation=locateQuote(p.item.rawText,f.evidence);
  if(!ruleLocation)return {decision:'pendente',reason:'prova_da_regra_ambigua'};
  return {...result,reason:f.reason,modelReason:a.justificativa,modelEvidence:a.evidencia,
    evidence:ruleLocation.text,evidenceLocation:ruleLocation,
    supportEvidence:[q,...(f.support?[locateQuote(p.item.rawText,f.support)].filter(Boolean):[])],
    factType:f.kind,reading:'v6_shadow'};
}
