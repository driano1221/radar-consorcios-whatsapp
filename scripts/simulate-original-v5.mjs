import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {prepareV5,prepareProcess,decideV5,readV5,VERSION} from './lib/original-v5.mjs';
import {sha,bindContentReview} from './lib/original-triage-shadow.mjs';
import {protectedSnapshot} from './pilot-retroactive-ten.mjs';
const mode=process.argv[2]||'--replay';assert.ok(['--freeze','--replay','--ai'].includes(mode));
const before=await protectedSnapshot();
const json=async path=>JSON.parse(await readFile(path,'utf8'));
const nd=async name=>(await readFile(`data/catalogo/${name}.ndjson`,'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const archive=await nd('arquivo-coletas'),texts=new Map((await nd('textos-artigos')).map(x=>[x.documento_id,x]));
const reviews=new Set((await nd('revisoes-eventos')).map(x=>x.documento_id));
const v31=await json('docs/simulacao-v31-respostas-congeladas.json'),v32=await json('docs/simulacao-originais-v32-2026-10-16-resumo.json'),v4=await json('docs/simulacao-v4-resultado.json');
const previous=[...v31.answers.map(x=>({...x,proposal:v32.sample.find(y=>y.id===x.id).proposal})),...v4.fresh.results];
assert.equal(previous.length,94);
const prepared=archive.map(row=>({row,p:prepareV5(row,texts.get(row.id))})),byId=new Map(prepared.map(x=>[x.row.id,x]));
const samplePath='docs/simulacao-v5-amostra-nova.json';
const count=rs=>rs.reduce((a,r)=>(a[r.proposal.decision]=(a[r.proposal.decision]||0)+1,a),{});
if(mode==='--freeze') {
  const seen=new Set(previous.map(x=>x.textHash)),old=new Set(previous.map(x=>x.id));
  const pool=prepared.filter(x=>x.p.eligible&&!old.has(x.row.id)&&!seen.has(x.p.textHash))
    .sort((a,b)=>sha('v5-new-text:'+a.row.id).localeCompare(sha('v5-new-text:'+b.row.id)))
    .filter(x=>{if(seen.has(x.p.textHash))return false;seen.add(x.p.textHash);return true;});
  const selected=[],domains=new Map(),types=new Map();
  function take(list,limit){for(const x of list){if(selected.length>=limit)break;const domain=new URL(x.p.item.articleUrl).hostname;
    if((domains.get(domain)||0)>=2)continue;selected.push(x);domains.set(domain,(domains.get(domain)||0)+1);}}
  // More positives without concealing that this remaining positive pool has
  // prior human/editorial reviews. No decisions/evidence enter the model.
  const positives=pool.filter(x=>x.p.rule.category!=='GERAL');
  const diverse=positives.filter(x=>{const n=types.get(x.p.rule.category)||0;types.set(x.p.rule.category,n+1);return n<2;});
  take(diverse,6);take(pool.filter(x=>x.p.rule.category==='GERAL'&&!reviews.has(x.row.id)),12);
  assert.equal(selected.length,12);
  await writeFile(samplePath,JSON.stringify({version:VERSION,selectedBeforeAi:true,seed:'v5-new-text',
    caveat:'Textos fora dos 94 anteriores; positivos podem ter revisão editorial e episódios conhecidos. Não é holdout independente de decisões humanas.',
    cases:selected.map(({row,p})=>({id:row.id,textHash:p.textHash,inputHash:p.inputHash,title:row.titulo,url:p.item.articleUrl,
      rule:p.rule.category,hadEditorialReview:reviews.has(row.id)}))},null,2)+'\n');
  console.log(selected.map(x=>({id:x.row.id.slice(0,8),title:x.row.titulo,rule:x.p.rule.category,review:reviews.has(x.row.id)})));
} else {
  const sample=await json(samplePath),cache=new Map();
  const cohort=[...previous.map(x=>({id:x.id,group:'regression',previous:x})),...sample.cases.map(x=>({id:x.id,group:'additional',frozen:x}))];
  const results=[];let index=0;
  async function evaluate(p) {
    if(mode!=='--ai')return {proposal:decideV5(p),review:null};
    const key=sha(VERSION+'\n'+p.item.rawText);
    if(!cache.has(key))cache.set(key,readV5(p,{apiKey:process.env.DEEPSEEK_API_KEY}).catch(e=>({error:e.message})));
    const shared=await cache.get(key);
    const review=shared.error?shared:{...shared,inputHash:p.inputHash,sourceInputHash:shared.inputHash};
    return {proposal:decideV5(p,review),review};
  }
  if(mode==='--ai')assert.ok(process.env.DEEPSEEK_API_KEY);
  await Promise.all(Array.from({length:2},async()=>{while(index<cohort.length){
    const target=cohort[index++],{row,p}=byId.get(target.id);assert.ok(p.eligible);
    if(target.frozen){assert.equal(p.textHash,target.frozen.textHash);assert.equal(p.inputHash,target.frozen.inputHash);}
    let frozenReplay=null;
    if(target.previous){assert.equal(p.textHash,target.previous.textHash);const old=target.previous.review;
      const review=old.error?old:bindContentReview(p,old);
      frozenReplay=decideV5(p,review,{replayLegacy:true});}
    // Parent is a container, not a merged fact. Every child is evaluated on
    // its own literal span; unresolved children are reported, never hidden.
    let value,children=[];
    if(p.segments.length>=2){value={proposal:decideV5(p),review:null};for(const segment of p.segments){
      const child=prepareProcess(p,segment);children.push({...segment,text:undefined,...await evaluate(child),rule:child.rule});}}
    else value=await evaluate(p);
    results.push({id:row.id,title:row.titulo,url:p.item.articleUrl,group:target.group,textHash:p.textHash,inputHash:p.inputHash,
      before:target.previous?.proposal||null,frozenReplay,...value,rule:p.rule,children});
    console.log(`[simulação v5] ${results.length}/${cohort.length}`);
  }}));
  const manifest=await json('data/catalogo/documentos-primarios-2026-10-16.json');
  const currentReviews=new Map((await nd('revisoes-eventos')).map(r=>[r.documento_id,r]));let proofs=0;
  for(const review of manifest.appliedReviews){assert.deepEqual(currentReviews.get(review.documento_id),review);assert.equal(review.publicar,false);
    for(const ref of review.documentos_primarios){assert.ok(manifest.documents.find(d=>d.sha256===ref.pdf_sha256).pages[ref.pagina-1].includes(ref.trecho));proofs++;}}
  assert.deepEqual(await protectedSnapshot(),before);
  const regression=results.filter(x=>x.group==='regression'),additional=results.filter(x=>x.group==='additional');
  const responses=await Promise.all(cache.values());
  const report={generatedAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),version:VERSION,
    productionActivated:false,whatsappCalls:0,protectedFilesUnchanged:true,mode,calls:cache.size,
    errors:responses.filter(x=>x.error).length,usage:responses.reduce((a,x)=>({input:a.input+(x.usage?.prompt_tokens||0),output:a.output+(x.usage?.completion_tokens||0)}),{input:0,output:0}),
    documentary:{reviews:manifest.appliedReviews.length,pdfs:manifest.documents.length,proofs},
    regression:{total:regression.length,before:count(regression.map(x=>({proposal:x.before}))),after:count(regression),
      frozenRuleReplay:count(regression.map(x=>({proposal:x.frozenReplay})))},
    additional:{total:additional.length,decisions:count(additional)},results:results.sort((a,b)=>a.id.localeCompare(b.id))};
  await mkdir('output/original-v5',{recursive:true});await writeFile('output/original-v5/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report,results:undefined},null,2));
}
assert.deepEqual(await protectedSnapshot(),before);
