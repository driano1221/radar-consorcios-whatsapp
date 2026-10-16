// Read-only corpus replay. No sender, catalog writer, editorial guard or state cache.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { prepareOriginal, reviewOriginal, decideOriginal, bindContentReview, contentReviewKey, sha, VERSION, RULE_VERSION } from './lib/original-triage-shadow.mjs';
import {processSegments} from './lib/shadow-facts.mjs';
import { protectedSnapshot } from './pilot-retroactive-ten.mjs';
import { formalEventKey } from '../src/lib/event-identity.mjs';
import { canonicalUrl } from '../src/lib/dedupe.mjs';

const args=process.argv.slice(2), options = new Set(args);
const replayPath=args[0]==='--answers'&&args.length===2?args[1]:null;
if(!replayPath && args.length && !(args.length===1&&args[0]==='--ai')) throw new Error('Only --ai or --answers path; there is no apply mode.');
const before = await protectedSnapshot();
const rows = async name => (await readFile(`data/catalogo/${name}.ndjson`, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const archive = await rows('arquivo-coletas'), texts = await rows('textos-artigos'), reviews = await rows('revisoes-eventos');
const byText = new Map(texts.map(t => [t.documento_id, t]));
// Expected labels are joined ONLY after prediction. Human-sealed derived acts
// are not fed back as original documents: that would leak segmentation answers.
const reference = new Map(reviews.map(r => [r.documento_id, r]));
const prepared = archive.map(row => ({row, p: prepareOriginal(row, byText.get(row.id))}));
const comparableUrl = value => {try {const u=new URL(canonicalUrl(value));u.searchParams.sort();return u.href;}catch{return value;}};
const externalReference = (row,p) => {
  const r=reference.get(row.id);
  return Boolean(r?.fonte_evidencia && comparableUrl(r.fonte_evidencia)!==comparableUrl(p.item?.articleUrl || row.article_url || row.url));
};
const eligibleReviewed = prepared.filter(x => x.p.eligible &&
  ['confirmar_evento','nao_evento'].includes(reference.get(x.row.id)?.decisao) &&
  reference.get(x.row.id)?.trecho_sha256===sha(x.row.trecho || '') && !externalReference(x.row,x.p));
// Keep EXACTLY the original 40 (do not rerank after fixing rules). Include all
// remaining same-source reviewed cases as the first-AI extension, with no
// outcome-based selection. This is not an untouched prospective holdout.
const baseline=JSON.parse(await readFile('docs/simulacao-originais-2026-10-16-resumo.json','utf8'));
const oldById=new Map(baseline.sample.map(x=>[x.id,x]));
const v2=JSON.parse(await readFile('docs/simulacao-originais-v2-2026-10-16-resumo.json','utf8'));
const v2ById=new Map(v2.sample.map(x=>[x.id,x]));
const selected=prepared.filter(x=>v2ById.has(x.row.id)).sort((a,b)=>a.row.id.localeCompare(b.row.id));
if (selected.filter(x=>oldById.has(x.row.id)).length!==40 || selected.length!==70 || selected.some(x=>!x.p.eligible))
  throw new Error('Cohort changed: inspect before spending API calls.');
// Additional prospective-to-this-experiment sample: no editorial reference.
// Select before viewing text/results; annotate only after the frozen run.
const seenBodies=new Set(selected.map(x=>x.p.textHash));
const freshPool=prepared.filter(x=>x.p.eligible&&!reference.has(x.row.id)&&!v2ById.has(x.row.id))
  .sort((a,b)=>sha('original-v3-fresh:'+a.row.id).localeCompare(sha('original-v3-fresh:'+b.row.id)))
  .filter(x=>{if(seenBodies.has(x.p.textHash))return false;seenBodies.add(x.p.textHash);return true;});
// Stratify on UNCHANGED production rule, not the experimental fixes.
const fresh=[...freshPool.filter(x=>x.p.rawRule.category!=='GERAL'&&x.p.rawRule.score>=5).slice(0,6),
  ...freshPool.filter(x=>x.p.rawRule.category==='GERAL'||x.p.rawRule.score<5).slice(0,6)];
const freshIds=new Set(fresh.map(x=>x.row.id));
const frozen=JSON.parse(await readFile('docs/simulacao-v3-amostra-nova.json','utf8'));
if(fresh.length!==12 || frozen.cases.some(c=>!fresh.some(x=>x.row.id===c.id&&x.p.textHash===c.textHash)))
  throw new Error('Frozen new sample changed: do not silently replace cases.');
selected.push(...fresh);
if(selected.length>82)throw new Error('API budget exceeded');
await mkdir('output/original-triage-simulation', {recursive:true});
const answers = [];
const contentCalls=new Map();
let replaySource=null;
if(replayPath){
  replaySource=JSON.parse(await readFile(replayPath,'utf8'));
  if(replaySource.readingVersion!==VERSION || replaySource.answers.length!==selected.length)
    throw new Error('Replay policy/sample mismatch');
  for(const x of selected){
    const saved=replaySource.answers.find(a=>a.id===x.row.id);
    if(!saved || saved.inputHash!==x.p.inputHash || saved.textHash!==x.p.textHash)
      throw new Error('Replay input mismatch');
    if(!saved.review.error && (saved.review.version!==VERSION || saved.review.contentReviewKey!==contentReviewKey(x.p)))
      throw new Error('Replay answer binding mismatch');
    answers.push({id:x.row.id,...saved.review});
  }
}
if (options.has('--ai')) {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY unavailable; no AI experiment executed.');
  // At most 82 documents, one call per complete body, concurrency 2.
  // Failures are shared too: never retry duplicates until a favored answer.
  let next = 0;
  await Promise.all(Array.from({length:2}, async () => {
    while (next < selected.length) {
      const x = selected[next++];
      try {
        const key=contentReviewKey(x.p);
        if(!contentCalls.has(key))contentCalls.set(key,reviewOriginal(x.p,{apiKey:process.env.DEEPSEEK_API_KEY}).catch(e=>({error:e.message})));
        const shared=await contentCalls.get(key);
        answers.push({id:x.row.id,...(shared.error?shared:bindContentReview(x.p,shared))});
      }
      catch (e) {answers.push({id:x.row.id,error:e.message});}
      console.log(`[simulação] ${answers.length}/${selected.length} — ${x.row.id.slice(0,8)}`);
    }
  }));
}
const answerById = new Map(answers.map(a=>[a.id,a]));
const proposals=new Map(selected.map(x=>[x.row.id,decideOriginal(x.p,answerById.get(x.row.id))]));
const groups=new Map();
for(const x of selected){const g=groups.get(x.p.textHash)||[];g.push(x);groups.set(x.p.textHash,g);}
let inconsistentGroups=0;
for(const g of groups.values()){
  const signatures=new Set(g.map(x=>{const d=proposals.get(x.row.id);return JSON.stringify([d.decision,d.category||'',d.factType||'']);}));
  if(signatures.size>1){inconsistentGroups++;for(const x of g)proposals.set(x.row.id,{decision:'pendente',reason:'mesmo_corpo_com_regras_divergentes'});}
}
const fingerprints = new Map();
const results = [];
for (const {row,p} of prepared.sort((a,b)=>String(a.row.primeira_coleta).localeCompare(String(b.row.primeira_coleta)) || a.row.id.localeCompare(b.row.id))) {
  const decision = proposals.get(row.id)||decideOriginal(p,answerById.get(row.id));
  const predictedRelevant = p.eligible && p.rule.category !== 'GERAL' && p.rule.score >= 5;
  const keys = p.eligible ? ['url:'+canonicalUrl(p.item.articleUrl), ...(p.item.rawText.length>=500?['text:'+p.textHash]:[]),
    ...(predictedRelevant && formalEventKey({...p.item,classification:p.rule})?['event:'+formalEventKey({...p.item,classification:p.rule})]:[])] : [];
  const duplicate = keys.map(k=>fingerprints.get(k)).find(Boolean);
  for (const k of keys) if (!fingerprints.has(k)) fingerprints.set(k,row.id);
  const expected = reference.get(row.id);
  const sealed = expected?.trecho_sha256 === sha(row.trecho || '');
  const referenceDecision = !sealed ? null : expected.decisao === 'nao_evento' ? 'descartado' : expected.decisao === 'duplicata' ? 'duplicata' : 'aceito';
  const expectedRelevant = ['aceito','descartado'].includes(referenceDecision) ? referenceDecision === 'aceito' : null;
  const sameEvidenceReference = !externalReference(row,p);
  results.push({id:row.id,title:row.titulo,url:p.item?.articleUrl || row.article_url || row.url,
    fulltextAvailable:byText.has(row.id),eligible:p.eligible,reader:p.reader || byText.get(row.id)?.leitor || '',
    inputHash:p.inputHash || '',chars:byText.get(row.id)?.texto.length || 0,assistedReading:p.assistedReading || false,
    currentRawDecision:row.decisao_base || '', referenceDecision, referenceCategory:sealed?expected.categoria:null,
    referenceReason:sealed?expected.motivo:null, referenceTitle:sealed?expected.titulo:null,
    expectedRelevant, sameEvidenceReference,
    baselineRule:p.legacy?.category || null, ruleCategory:p.rule?.category || null, ruleRelevant:p.eligible?predictedRelevant:null,
    ruleEvidence:p.rule?.evidenceText || '', ruleStage:p.rule?.stage || '',
    unchangedRuleCategory:p.rawRule?.category || null, ruleRefinement:p.rule?.proofKind || '',
    ruleMatchesReference:p.eligible && sealed && expectedRelevant!==null?predictedRelevant===expectedRelevant:null,
    referenceCategoryMatches:p.eligible && sealed && expectedRelevant===true?p.rule.category===expected.categoria:null,
    selectedForAi:selected.some(x=>x.row.id===row.id), cohort:freshIds.has(row.id)?'new12':oldById.has(row.id)?'original40':v2ById.get(row.id)?.cohort==='fresh12'?'previous12':'additional',
    beforeProposal:v2ById.get(row.id)?.proposal || null, ai:answerById.get(row.id) || null,
    textHash:p.textHash||'',processSegments:p.independentProcesses?processSegments(p.item.rawText):[],
    proposal:decision, duplicateCandidate:duplicate || null,
    proposalMatchesReference:sealed && expectedRelevant!==null && decision.decision!=='pendente'?(decision.decision==='aceito')===expectedRelevant:null});
}
const count = (arr,key) => arr.reduce((a,x)=>(a[key(x)]=(a[key(x)]||0)+1,a),{});
const comparable = results.filter(x=>x.eligible && x.expectedRelevant!==null && x.sameEvidenceReference);
const decided = comparable.filter(x=>x.proposal.decision!=='pendente');
const report = {version:RULE_VERSION,readingVersion:VERSION,generatedAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  replaySource:replaySource?{run:replaySource.run,commit:replaySource.commit,readingVersion:replaySource.readingVersion}:null,
  corpusHash:sha(JSON.stringify(before)), productionActivated:false,whatsappCalls:0,
  caveats:['Amostra já usada para desenvolver regras: regressão, não teste independente de generalização.',
    'Duplicatas são avaliadas à parte; não recebem rótulo presumido de relevância. Equivalência exata proposta não é deduplicação completa.',
    'Referências apoiadas em outro documento são separadas da métrica principal; a simulação não recebe esse documento por conhecimento da resposta.',
    'Referências incluem decisões do usuário e revisões do assistente; não equivalem a auditoria humana independente.',
    'Nesta rodada a IA não vê categoria/etapa da regra nem decisão editorial. Isso reduz ancoragem, mas não garante acerto.',
    'Adicionais são novos para a leitura de IA, não notícias recém-coletadas nem holdout totalmente intocado: as regras já foram comparadas às 58 referências.',
    'Somente textos originais integrais elegíveis; PDFs e lacunas não são descartes temáticos.'],
  counts:{archive:archive.length,storedFulltext:texts.length,eligible:results.filter(x=>x.eligible).length,
    editorialReviews:reviews.length,reviewedArchive:results.filter(x=>x.referenceDecision!==null).length,
    comparable:comparable.length, referenceClasses:count(comparable,x=>x.referenceDecision),
    eligibleReviewed:results.filter(x=>x.eligible && x.referenceDecision!==null).length,
    externalReferenceCases:results.filter(x=>x.eligible && x.referenceDecision!==null && !x.sameEvidenceReference).length,
    reviewedDuplicates:results.filter(x=>x.eligible && x.referenceDecision==='duplicata').length,
    duplicatesWithExactCandidate:results.filter(x=>x.eligible && x.referenceDecision==='duplicata' && x.duplicateCandidate).length,
    ineligibleReasons:count(results.filter(x=>!x.eligible),x=>x.proposal.reason),
    ruleAgreements:comparable.filter(x=>x.ruleMatchesReference).length,
    ruleFalseAccepts:comparable.filter(x=>x.ruleRelevant && !x.expectedRelevant).length,
    ruleFalseRejects:comparable.filter(x=>!x.ruleRelevant && x.expectedRelevant).length,
    categoryDisagreements:comparable.filter(x=>x.expectedRelevant && x.ruleRelevant && !x.referenceCategoryMatches).length,
    aiSelected:selected.length,aiCalls:contentCalls.size,aiBoundDocuments:answers.length,aiErrors:replaySource?0:answers.filter(x=>x.error).length,
    savedResponseErrors:replaySource?answers.filter(x=>x.error).length:0,
    sharedBodyGroups:[...groups.values()].filter(g=>g.length>1).length,inconsistentGroups,
    aiDecisions:count(results.filter(x=>x.selectedForAi),x=>x.proposal.decision),
    aiDecisionAgreements:decided.filter(x=>x.proposalMatchesReference).length,
    aiDecisionDisagreements:decided.filter(x=>!x.proposalMatchesReference).length,
    aiAcceptedCategoryDisagreements:decided.filter(x=>x.proposal.decision==='aceito' && x.proposal.category!==x.referenceCategory).length,
    proposedNewUnreviewed:results.filter(x=>x.referenceDecision===null && x.proposal.decision==='aceito').length,
    usage:replaySource?{input:0,output:0}:[...new Map(answers.filter(x=>!x.error).map(x=>[x.contentReviewKey,x])).values()].reduce((a,x)=>({input:a.input+(x.usage?.prompt_tokens||0),output:a.output+(x.usage?.completion_tokens||0)}),{input:0,output:0})},
  baselineCommit:baseline.commit,
  cohorts:Object.fromEntries(['original40','additional','previous12','new12'].map(cohort=>{
    const set=results.filter(x=>x.selectedForAi&&x.cohort===cohort), decided=set.filter(x=>x.proposal.decision!=='pendente'&&x.expectedRelevant!==null);
    return [cohort,{total:set.length,before:count(set,x=>x.beforeProposal?.decision || 'nao_testado'),
      after:count(set,x=>x.proposal.decision),reasons:count(set.filter(x=>x.proposal.decision==='pendente'),x=>x.proposal.reason),
      labeledDecisions:decided.length, verdictErrors:decided.length?decided.filter(x=>!x.proposalMatchesReference).length:null,
      categoryErrors:decided.filter(x=>x.proposal.decision==='aceito'&&x.proposal.category!==x.referenceCategory).length}];
  })),results};
const after = await protectedSnapshot();
if (JSON.stringify(before)!==JSON.stringify(after)) throw new Error('Protected files changed: STOP.');
report.protectedFilesUnchanged=true;
await writeFile('output/original-triage-simulation/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({counts:report.counts,protectedFilesUnchanged:true,productionActivated:false},null,2));
