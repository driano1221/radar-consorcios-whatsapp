// Shadow experiment only: never imported by collector, catalog or sender.
import {prepareV5,decideV5,readV5,locateQuote} from './original-v5.mjs';
import {entityProven} from './original-shadow-rules.mjs';
export const VERSION='original-shadow-6.0';
export const RULE_VERSION='original-rules-6.0';
const policy=`\nDistinguish WHO owns a meeting from WHO attends it. A completed assembly OF the public consortium, corroborated by discussion during that meeting, is its institutional activity even when the sentence's grammatical subject is an invited prosecutor. Passive attendance BY a consortium at another organization's event is not enough. Use tipo_fato=assembleia_realizada, category ATUAÇÃO, and quote the completed participation + ownership clause; do not infer agreements, financing, service expansion or membership from mere discussion or a facility's beneficiaries.
Read a pending bill's historical clauses separately from its proposed enactment. If it explicitly reports that an identified consortium's amended contract WAS deliberated by member entities at a dated general assembly and refers to its published minutes, that prior deliberation can be GOVERNANÇA, tipo_fato=deliberacao_anterior_relatada. Quote the PAST deliberation clause with its consortium, not 'ficam ratificadas' from a proposed article. Municipal ratification remains proposed. Published minutes mentioned by the bill are NOT minutes you have independently read. Record only that bounded historical fact, not a sanctioned law or effective municipal admission. A mere future assembly or proposed amendment is insufficient. Do not classify the pending bill and its supporting historical assembly as independent completed acts. Routine technical road-maintenance project approval (without delivered works) stays outside, even if issued by a consortium.`;
const unsafe=/\b(?:n[aã]o|nunca|supostamente|teria|poderia|pretende|caso)\b/i;
function mainBody(body){return body.split(/\bLEIA TAMB[EÉ]M\b|\bNOT[IÍ]CIAS RELACIONADAS\b/i)[0];}

export function completedAssembly(body){
  const b=mainBody(body);
  const re=/[^.!?]*\bparticipou (?:de|em) uma (?:assembleia|reuni[aã]o) do (Cons[oó]rcio (?:P[uú]blico )?(?:Intermunicipal|Interfederativo)\s+[^.!?]{2,160}?)\s+para\s+[^.!?]{8,650}[.!?]/gi;
  const hits=[...b.matchAll(re)];if(hits.length!==1)return null;
  const m=hits[0];if(unsafe.test(m[0]))return null;
  const rest=b.slice(m.index+m[0].length,m.index+m[0].length+900);
  const corroboration=/^\s*(Durante o encontro,[^.!?]{3,220}\b(?:abordaram|discutiram|debateram)\b[^.!?]{5,400}[.!?])/i.exec(rest);
  if(!corroboration||unsafe.test(corroboration[1]))return null;
  return {kind:'assembleia_realizada',entity:m[1],evidence:m[0].trim(),support:corroboration[1],
    reason:'Assembleia do próprio consórcio já realizada, com discussão relatada. Não comprova acordo firmado, recurso liberado, expansão de atendimento nem nova adesão municipal.'};
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
  const assembly=completedAssembly(p.item.rawText),prior=priorAssemblyInBill(p.item.rawText);
  if(assembly&&prior)return {...p,v6Conflict:true};
  const fact=assembly||prior;
  if(!fact||p.segments.length||p.rule.policyExclusion)return p;
  return {...p,v6Fact:fact,rule:{...p.rule,category:assembly?'ATUAÇÃO':'GOVERNANÇA',score:8,
    stage:assembly?'assembleia do consórcio realizada, sem presumir aprovação de propostas':'deliberação anterior relatada; ratificação municipal ainda proposta',
    proofKind:fact.kind,evidenceText:fact.evidence,evidenceParts:[fact.evidence,...(fact.support?[fact.support]:[])],
    policyExclusion:null,reasons:[fact.reason],...(prior?{sourceQualification:fact.sourceQualification,reportedYear:fact.year}:{})}};
}
export const readV6=(p,options)=>readV5(p,{...options,additionalPolicy:policy,policyVersion:VERSION});
export function decideV6(p,review,{expectedVersion=VERSION}={}){
  if(p.v6Conflict)return {decision:'pendente',reason:'fatos_distintos_exigem_separacao'};
  const result=decideV5(p,review,{expectedVersion});
  if(result.decision!=='aceito'||!p.v6Fact)return {...result,reading:'v6_shadow'};
  const f=p.v6Fact,a=review.answer,q=locateQuote(p.item.rawText,a.evidencia);
  // Both readings must locate the SAME fact, owner, stage and literal body.
  // Neither a category agreement nor the rule's proof can replace AI evidence.
  const sameFact=q&&a.tipo_fato===f.kind&&entityProven(p.item.rawText,a.entidade,f.entity)&&
    entityProven(p.item.rawText,a.entidade,q.text)&&
    (f.kind==='assembleia_realizada'?
      /participou (?:de|em) uma (?:assembleia|reuni[aã]o) do Cons[oó]rcio/i.test(q.text):
      /foi consolidado e deliberado pelos entes consorciados,\s*na A\.G\.O\. do dia/i.test(q.text))&&
    !unsafe.test(q.text);
  if(!sameFact)return {decision:'pendente',reason:'prova_da_etapa_e_do_titular_divergente',reading:'v6_shadow'};
  const ruleLocation=locateQuote(p.item.rawText,f.evidence);
  if(!ruleLocation)return {decision:'pendente',reason:'prova_da_regra_ambigua'};
  return {...result,reason:f.reason,modelReason:a.justificativa,modelEvidence:a.evidencia,
    evidence:ruleLocation.text,evidenceLocation:ruleLocation,
    supportEvidence:[q,...(f.support?[locateQuote(p.item.rawText,f.support)].filter(Boolean):[])],
    factType:f.kind,reading:'v6_shadow'};
}
