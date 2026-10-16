import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {prepareV6,decideV6,readV6,VERSION,RULE_VERSION} from './lib/original-v6.mjs';
import {prepareProcess,VERSION as V5} from './lib/original-v5.mjs';
import {sha} from './lib/original-triage-shadow.mjs';
import {protectedSnapshot} from './pilot-retroactive-ten.mjs';
const mode=process.argv[2]||'--replay';assert.ok(['--freeze','--replay','--ai','--frozen'].includes(mode));
const before=await protectedSnapshot();
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const nd=async name=>(await readFile(`data/catalogo/${name}.ndjson`,'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const archive=await nd('arquivo-coletas'),texts=new Map((await nd('textos-artigos')).map(x=>[x.documento_id,x]));
const editorial=new Set((await nd('revisoes-eventos')).map(x=>x.documento_id));
const previous=(await json('docs/simulacao-v5-replay-resultado.json')).results;assert.equal(previous.length,106);
const prepared=archive.map(row=>({row,p:prepareV6(row,texts.get(row.id))})),byId=new Map(prepared.map(x=>[x.row.id,x]));
const samplePath='docs/simulacao-v6-amostra-nova.json';
const count=rs=>rs.reduce((a,r)=>(a[r.proposal.decision]=(a[r.proposal.decision]||0)+1,a),{});
if(mode==='--freeze'){
  const seen=new Set(previous.map(x=>x.textHash)),old=new Set(previous.map(x=>x.id));
  const pool=prepared.filter(x=>x.p.eligible&&!old.has(x.row.id)&&!seen.has(x.p.textHash))
    .sort((a,b)=>sha('v6-new-text:'+a.row.id).localeCompare(sha('v6-new-text:'+b.row.id)))
    .filter(x=>{if(seen.has(x.p.textHash))return false;seen.add(x.p.textHash);return true;});
  const selected=[],domains=new Map(),types=new Map();
  function take(list,limit){for(const x of list){if(selected.length>=limit)break;const d=new URL(x.p.item.articleUrl).hostname;
    if((domains.get(d)||0)>=2||selected.includes(x))continue;selected.push(x);domains.set(d,(domains.get(d)||0)+1);}}
  const diverse=pool.filter(x=>x.p.rule.category!=='GERAL').filter(x=>{const n=types.get(x.p.rule.category)||0;types.set(x.p.rule.category,n+1);return n<2;});
  take(diverse,6);take(pool.filter(x=>!editorial.has(x.row.id)),12);take(pool,12);assert.equal(selected.length,12);
  await writeFile(samplePath,JSON.stringify({version:VERSION,selectedBeforeAi:true,seed:'v6-new-text',
    caveat:'Textos distintos dos 106 anteriores; podem conter episódios conhecidos e revisões editoriais. Não é holdout independente nem coleta nova.',
    cases:selected.map(({row,p})=>({id:row.id,textHash:p.textHash,inputHash:p.inputHash,title:row.titulo,url:p.item.articleUrl,
      rule:p.rule.category,hadEditorialReview:editorial.has(row.id)}))},null,2)+'\n');
  console.log(selected.map(x=>({id:x.row.id.slice(0,8),title:x.row.titulo,rule:x.p.rule.category,review:editorial.has(x.row.id)})));
}else{
  const sample=await json(samplePath),cache=new Map(),frozen=new Map();
  if(mode==='--frozen')for(const row of (await json('docs/simulacao-v6-resultado.json')).results)
    for(const e of row.children.length?row.children:[row])if(e.review&&!e.review.error)frozen.set(e.review.contentReviewKey,e.review);
  const cohort=[...previous.map(x=>({id:x.id,group:'regression',previous:x})),...sample.cases.map(x=>({id:x.id,group:'additional',frozen:x}))];
  let index=0;const results=[];
  async function evaluate(p){
    if(mode==='--replay')return {proposal:decideV6(p),review:null};
    const key=sha(VERSION+'\n'+p.item.rawText);
    if(!cache.has(key)){
      if(mode==='--frozen'){assert.ok(frozen.has(key),`Missing frozen body ${key}`);cache.set(key,Promise.resolve(frozen.get(key)));}
      else cache.set(key,readV6(p,{apiKey:process.env.DEEPSEEK_API_KEY}).catch(e=>({error:e.message})));
    }
    const shared=await cache.get(key),review=shared.error?shared:{...shared,inputHash:p.inputHash,sourceInputHash:shared.inputHash};
    return {proposal:decideV6(p,review),review};
  }
  if(mode==='--ai')assert.ok(process.env.DEEPSEEK_API_KEY);
  await Promise.all(Array.from({length:2},async()=>{while(index<cohort.length){
    const t=cohort[index++],{row,p}=byId.get(t.id);assert.ok(p.eligible);
    if(t.frozen){assert.equal(p.textHash,t.frozen.textHash);assert.equal(p.inputHash,t.frozen.inputHash);}
    if(t.previous)assert.equal(p.textHash,t.previous.textHash);
    const frozenReplay=t.previous?decideV6(p,t.previous.review,{expectedVersion:V5}):null;
    let value,children=[];
    if(p.segments.length>=2){value={proposal:decideV6(p),review:null};for(const s of p.segments){
      const child=prepareProcess(p,s);children.push({...s,text:undefined,...await evaluate(child),rule:child.rule});}}
    else value=await evaluate(p);
    results.push({id:row.id,title:row.titulo,url:p.item.articleUrl,group:t.group,textHash:p.textHash,inputHash:p.inputHash,
      before:t.previous?.proposal||null,frozenReplay,...value,rule:p.rule,children});
    console.log(`[simulação v6] ${results.length}/${cohort.length}`);
  }}));
  const manifest=await json('data/catalogo/documentos-primarios-2026-10-16.json');
  const current=new Map((await nd('revisoes-eventos')).map(x=>[x.documento_id,x]));let proofs=0;
  for(const r of manifest.appliedReviews){assert.deepEqual(current.get(r.documento_id),r);assert.equal(r.publicar,false);
    for(const ref of r.documentos_primarios){assert.ok(manifest.documents.find(d=>d.sha256===ref.pdf_sha256).pages[ref.pagina-1].includes(ref.trecho));proofs++;}}
  assert.deepEqual(await protectedSnapshot(),before);
  const regression=results.filter(x=>x.group==='regression'),additional=results.filter(x=>x.group==='additional'),responses=await Promise.all(cache.values());
  const report={generatedAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),version:VERSION,ruleVersion:RULE_VERSION,
    productionActivated:false,whatsappCalls:0,protectedFilesUnchanged:true,mode,calls:mode==='--ai'?cache.size:0,reusedReadings:mode==='--frozen'?cache.size:0,
    errors:responses.filter(x=>x.error).length,usage:responses.reduce((a,x)=>({input:a.input+(x.usage?.prompt_tokens||0),output:a.output+(x.usage?.completion_tokens||0)}),{input:0,output:0}),
    documentary:{reviews:manifest.appliedReviews.length,pdfs:manifest.documents.length,proofs},
    regression:{total:regression.length,before:count(regression.map(x=>({proposal:x.before}))),after:count(regression)},
    additional:{total:additional.length,decisions:count(additional)},results:results.sort((a,b)=>a.id.localeCompare(b.id))};
  await mkdir('output/original-v6',{recursive:true});await writeFile('output/original-v6/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report,results:undefined},null,2));
}
assert.deepEqual(await protectedSnapshot(),before);
