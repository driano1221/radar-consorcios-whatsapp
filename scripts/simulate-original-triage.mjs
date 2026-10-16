// Read-only corpus replay. No sender, catalog writer, editorial guard or state cache.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { prepareOriginal, reviewOriginal, decideOriginal, sha, VERSION } from './lib/original-triage-shadow.mjs';
import { protectedSnapshot } from './pilot-retroactive-ten.mjs';
import { formalEventKey } from '../src/lib/event-identity.mjs';
import { canonicalUrl } from '../src/lib/dedupe.mjs';

const options = new Set(process.argv.slice(2));
if ([...options].some(x => !['--ai'].includes(x))) throw new Error('Only --ai is supported; there is no apply mode.');
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
const rank = x => sha('original-shadow-fixed-seed:'+x.row.id);
const eligibleReviewed = prepared.filter(x => x.p.eligible &&
  ['confirmar_evento','nao_evento'].includes(reference.get(x.row.id)?.decisao) &&
  reference.get(x.row.id)?.trecho_sha256===sha(x.row.trecho || '') && !externalReference(x.row,x.p));
const ranked = relevant => eligibleReviewed.filter(x => (x.p.rule.category !== 'GERAL' && x.p.rule.score >= 5) === relevant)
  .sort((a,b) => rank(a).localeCompare(rank(b)));
const selected = [...ranked(true).slice(0,20), ...ranked(false).slice(0,20)];
// Fill unused strata without consulting the reference verdict.
for (const x of eligibleReviewed.sort((a,b)=>rank(a).localeCompare(rank(b))))
  if (selected.length < 40 && !selected.some(y=>y.row.id===x.row.id)) selected.push(x);
await mkdir('output/original-triage-simulation', {recursive:true});
const answers = [];
if (options.has('--ai')) {
  if (!process.env.DEEPSEEK_API_KEY) throw new Error('DEEPSEEK_API_KEY unavailable; no AI experiment executed.');
  // Bounded 40 calls, concurrency 2, no retries and no production AI cache.
  let next = 0;
  await Promise.all(Array.from({length:2}, async () => {
    while (next < selected.length) {
      const x = selected[next++];
      try { answers.push({id:x.row.id, ...await reviewOriginal(x.p,{apiKey:process.env.DEEPSEEK_API_KEY})}); }
      catch (e) {answers.push({id:x.row.id,error:e.message});}
      console.log(`[simulação] ${answers.length}/${selected.length} — ${x.row.id.slice(0,8)}`);
    }
  }));
}
const answerById = new Map(answers.map(a=>[a.id,a]));
const fingerprints = new Map();
const results = [];
for (const {row,p} of prepared.sort((a,b)=>String(a.row.primeira_coleta).localeCompare(String(b.row.primeira_coleta)) || a.row.id.localeCompare(b.row.id))) {
  const decision = decideOriginal(p,answerById.get(row.id));
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
    ruleMatchesReference:p.eligible && sealed && expectedRelevant!==null?predictedRelevant===expectedRelevant:null,
    referenceCategoryMatches:p.eligible && sealed && expectedRelevant===true?p.rule.category===expected.categoria:null,
    selectedForAi:selected.some(x=>x.row.id===row.id), ai:answerById.get(row.id) || null,
    proposal:decision, duplicateCandidate:duplicate || null,
    proposalMatchesReference:sealed && expectedRelevant!==null && decision.decision!=='pendente'?(decision.decision==='aceito')===expectedRelevant:null});
}
const count = (arr,key) => arr.reduce((a,x)=>(a[key(x)]=(a[key(x)]||0)+1,a),{});
const comparable = results.filter(x=>x.eligible && x.expectedRelevant!==null && x.sameEvidenceReference);
const decided = comparable.filter(x=>x.proposal.decision!=='pendente');
const report = {version:VERSION,generatedAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  corpusHash:sha(JSON.stringify(before)), productionActivated:false,whatsappCalls:0,
  caveats:['Amostra já usada para desenvolver regras: regressão, não teste independente de generalização.',
    'Duplicatas são avaliadas à parte; não recebem rótulo presumido de relevância. Equivalência exata proposta não é deduplicação completa.',
    'Referências apoiadas em outro documento são separadas da métrica principal; a simulação não recebe esse documento por conhecimento da resposta.',
    'Referências incluem decisões do usuário e revisões do assistente; não equivalem a auditoria humana independente.',
    'A IA vê a categoria da regra, mas não a decisão editorial. Concordância não é confirmação independente.',
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
    aiSelected:selected.length,aiCalls:answers.length,aiErrors:answers.filter(x=>x.error).length,
    aiDecisions:count(results.filter(x=>x.selectedForAi),x=>x.proposal.decision),
    aiDecisionAgreements:decided.filter(x=>x.proposalMatchesReference).length,
    aiDecisionDisagreements:decided.filter(x=>!x.proposalMatchesReference).length,
    aiAcceptedCategoryDisagreements:decided.filter(x=>x.proposal.decision==='aceito' && x.proposal.category!==x.referenceCategory).length,
    proposedNewUnreviewed:results.filter(x=>x.referenceDecision===null && x.proposal.decision==='aceito').length,
    usage:answers.reduce((a,x)=>({input:a.input+(x.usage?.prompt_tokens||0),output:a.output+(x.usage?.completion_tokens||0)}),{input:0,output:0})},
  results};
const after = await protectedSnapshot();
if (JSON.stringify(before)!==JSON.stringify(after)) throw new Error('Protected files changed: STOP.');
report.protectedFilesUnchanged=true;
await writeFile('output/original-triage-simulation/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({counts:report.counts,protectedFilesUnchanged:true,productionActivated:false},null,2));
