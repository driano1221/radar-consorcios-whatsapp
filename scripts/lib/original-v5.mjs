// Simulation only. Production imports neither this module nor its predecessors.
import {prepareOriginal,decideOriginal,reviewOriginal,sha,VERSION as BASE_VERSION,literal} from './original-triage-shadow.mjs';
import {processSegments,} from './shadow-facts.mjs';
export const VERSION='original-shadow-5.0';
const policy=`\nBefore rejecting an article about a future ceremony, recruitment or agenda, inspect the entire body for separately completed institutional facts. Distinguish a completed course from a future certificate ceremony. 'A capacitação foi promovida' together with 'concluíram o curso' proves training already performed, NOT certificate delivery. Cite both aspects using evidencia and evidencias_complementares (array of verbatim contiguous quotes). Do not infer completion from certificates merely scheduled. Identify the public consortium's active role, not passive attendance or a partner's unrelated activity. Treat two different court processes as independent acts, even when the outcomes are similar; an annex to one process is not a second independent process. If the supplied body is one process segment, assess ONLY this segment. Preserve conditional fines, provisional measures and separate duties. Return Portuguese JSON using the same schema, plus evidencias_complementares. Exact quotes must retain case, punctuation, and accents; do not capitalize a lower-case article at the start of your excerpt.`;

// Only whitespace and case can differ. Return the SOURCE slice and offsets,
// never the model's repaired paraphrase. Ambiguous repeated matches fail closed.
export function locateQuote(body,quote) {
  if(typeof quote!=='string'||quote.trim().length<25||quote.length>6000)return null;
  const escaped=quote.trim().split(/\s+/).map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s+');
  const hits=[...body.matchAll(new RegExp(escaped,'giu'))];
  if(hits.length!==1)return null;
  const m=hits[0];
  return {text:m[0],start:m.index,end:m.index+m[0].length,repair:m[0]===quote?'none':'case_or_whitespace_only'};
}

export function completedCourse(body) {
  // Require the consortium to conduct the ceremony, an adjacent training
  // reference and explicit completed participants. A passive guest is not enough.
  const actor=/\b(?:O )?Cons[oó]rcio (?:P[uú]blico )?(?:Intermunicipal|Interfederativo)[^.!?]{2,150}?\s+(?:realiza|realizar[aá]|promove|promover[aá])\b[^.!?]{0,300}\bcertificados[^.!?]{0,230}/i.exec(body);
  if(!actor||/\b(?:n[aã]o|teria|poderia|caso|se)\b/i.test(actor[0]))return null;
  const rest=body.slice(actor.index+actor[0].length);
  const course=/^[.\s]*(A (?:capacita[cç][aã]o|forma[cç][aã]o) foi (?:promovida|realizada)\b[^.!?]{0,600})/i.exec(rest);
  if(!course||/\b(?:n[aã]o|teria|poderia|prevista)\b/i.test(course[1]))return null;
  const completed=/\b[^.!?]{0,160}\b(?:que conclu[ií]ram o curso|que conclu[ií]ram a capacita[cç][aã]o)\b[^.!?]{0,80}/i.exec(rest);
  if(!completed||completed.index>1300||/\b(?:n[aã]o|ainda|caso|se|teriam|supostamente)\b/i.test(completed[0]))return null;
  if(/LEIA TAMB[EÉ]M/i.test(rest.slice(0,completed.index)))return null;
  return {actor:actor[0],training:course[1],completion:completed[0],
    evidenceText:course[1],evidenceParts:[actor[0],course[1],completed[0]]};
}

export function splitProcesses(body) {
  const re=/(?:J[aá] )?Na sess[aã]o de [^.!?]{2,200}?\bProcesso\s*(?:n[º°.]*\s*)?(\d[\d.]{5,12})\b/gi;
  const starts=[...body.matchAll(re)];
  if(starts.length>=2 && new Set(starts.map(m=>m[1].replace(/\D/g,''))).size===starts.length) {
    return starts.map((m,i)=>{
      const start=m.index,end=starts[i+1]?.index??body.length,text=body.slice(start,end);
      const annexes=[...text.matchAll(/\banexo\s*n[º°.]*\s*(\d[\d.]{5,12})/gi)].map(x=>x[1].replace(/\D/g,''));
      return {start,end,text,process:m[1].replace(/\D/g,''),annexes,
        hasDispositive:/\b(?:determinou a suspens[aã]o|manteve suspensa|suspendeu)\b/i.test(text)};
    });
  }
  return processSegments(body);
}

export function prepareV5(row,stored) {
  const p=prepareOriginal(row,stored);if(!p.eligible)return p;
  const course=completedCourse(p.item.rawText),segments=splitProcesses(p.item.rawText);
  if(course)p.rule={...p.rule,category:'ATUAÇÃO',score:Math.max(5,p.rule.score),
    stage:'capacitação já realizada; cerimônia de certificados ainda futura, sem presumir sua realização',
    proofKind:'completed_course_context',policyExclusion:null,evidenceText:course.training,evidenceParts:course.evidenceParts};
  return {...p,course,segments,independentProcesses:p.independentProcesses||segments.length>=2};
}

export function prepareProcess(parent,segment) {
  const text=segment.text;
  const item={...parent.item,rawText:text,summary:text,excerpts:[text],title:`Processo ${segment.process}`};
  const p={...parent,item,textHash:sha(text),inputHash:sha(JSON.stringify(item)),segments:[],independentProcesses:false,course:null,
    parentTextHash:parent.textHash,sourceSpan:{start:segment.start,end:segment.end},process:segment.process,annexes:segment.annexes||[]};
  const proof=/\b(?:[A-ZÀ-Ú][\p{L} ]{3,80} )?determinou a suspens[aã]o[^.!?]{0,700}/u.exec(text);
  const name=/\bCons[oó]rcio (?:P[uú]blico )?(?:Intermunicipal|Interfederativo)[^.!?;]{2,180}?\([\p{L}\d-]+\)/u.exec(text);
  const referendo=/\breferendou (?:a decis[aã]o|a medida)/i.test(text);
  // Do not let the rule from the whole news item contaminate a child.
  p.rule=prepareOriginal({id:'segment',url:parent.item.url,titulo:item.title,fonte:parent.item.source},
    {documento_id:'segment',url_original:parent.item.url,url_artigo:parent.item.articleUrl,leitor:'segmento_original',texto:text,texto_sha256:sha(text)}).rule||{category:'GERAL',score:0};
  if(proof&&name&&referendo&&segment.hasDispositive)p.rule={...p.rule,category:'CONTROLE',score:8,
    stage:'referendo de cautelar relatado; suspensão provisória, sem julgamento definitivo de mérito',
    proofKind:'process_caution',evidenceText:proof[0],evidenceParts:[name[0],proof[0]],policyExclusion:null};
  return p;
}

export async function readV5(p,options) {
  return reviewOriginal(p,{...options,additionalPolicy:policy,policyVersion:VERSION});
}
export function decideV5(p,review,{replayLegacy=false}={}) {
  if(!p.eligible)return {decision:'pendente',reason:p.reason};
  if(p.segments.length>=2)return {decision:'desdobrar',reason:'processos_independentes_com_intervalos_no_original',
    processes:p.segments.map(s=>({process:s.process,annexes:s.annexes||[],start:s.start,end:s.end}))};
  if(review?.error)return {decision:'pendente',reason:'segunda_leitura_falhou'};
  if(!review)return {decision:'pendente',reason:'segunda_leitura_nao_executada'};
  const expected=replayLegacy?BASE_VERSION:VERSION;
  if(review.version!==expected||review.textHash!==p.textHash||review.inputHash!==p.inputHash||
    (review.contentReviewKey && review.contentReviewKey!==sha(expected+'\n'+p.item.rawText)))
    return {decision:'pendente',reason:'segunda_leitura_desatualizada'};
  const a={...review.answer},located=locateQuote(p.item.rawText,a.evidencia);
  // Rejection repair is allowed only when rule AND model agree. For acceptance,
  // identity/category/stage checks still run on the actual recovered source text.
  if(located)a.evidencia=located.text;
  const extras=Array.isArray(a.evidencias_complementares)?a.evidencias_complementares:[];
  const support=extras.map(q=>locateQuote(p.item.rawText,q)).filter(Boolean);
  if(p.course&&a.relevante===true) {
    const proof=[a.evidencia,...support.map(x=>x.text)].join(' ');
    if(!/(?:capacita[cç][aã]o|forma[cç][aã]o) foi (?:promovida|realizada)/i.test(proof)||!/(?:conclu[ií]ram o curso|conclu[ií]ram a capacita[cç][aã]o)/i.test(proof))
      return {decision:'pendente',reason:'curso_exige_prova_de_realizacao_e_conclusao'};
  }
  const result=decideOriginal(p,{...review,version:BASE_VERSION,answer:a});
  return {...result,...(located?{evidenceLocation:located,modelEvidence:review.answer.evidencia}:{}),
    ...(support.length?{supportEvidence:support}:{}),...(p.process?{process:p.process,annexes:p.annexes,parentTextHash:p.parentTextHash,sourceSpan:p.sourceSpan}:{}),
    ...(replayLegacy?{reading:'frozen_previous_prompt'}:{reading:'new_v5_prompt'})};
}
