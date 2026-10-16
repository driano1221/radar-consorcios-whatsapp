// Entry point for the PREPARED integration. No collection, saving to catalog,
// model retraining, sending, or activation is performed by this script.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {prepareV6,decideV6,readV6,VERSION} from './lib/original-v6.mjs';
import {prepareProcess} from './lib/original-v5.mjs';
import {refineV7} from './lib/original-v7.mjs';
import {sha} from './lib/original-triage-shadow.mjs';
import {loadPrimaryEvidenceContext,integratePrimaryEvidence} from '../src/lib/primary-evidence.mjs';
import {protectedSnapshot} from './pilot-retroactive-ten.mjs';
const mode=process.argv[2];assert.ok(['--freeze','--validate','--ai','--frozen'].includes(mode),'Choose an explicit simulation mode');
const before=await protectedSnapshot(),json=async p=>JSON.parse(await readFile(p,'utf8'));
const nd=async n=>(await readFile(`data/catalogo/${n}.ndjson`,'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const archive=await nd('arquivo-coletas'),texts=new Map((await nd('textos-artigos')).map(x=>[x.documento_id,x]));
const reviews=new Set((await nd('revisoes-eventos')).map(x=>x.documento_id));
const previous=(await json('docs/simulacao-v6-replay-resultado.json')).results;assert.equal(previous.length,118);
const pool=archive.map(row=>({row,p:prepareV6(row,texts.get(row.id))}));
const sampleFile='docs/simulacao-v7-amostra-nova.json';
if(mode==='--freeze'){
  const seen=new Set(previous.map(x=>x.textHash)),old=new Set(previous.map(x=>x.id));
  const available=pool.filter(x=>x.p.eligible&&!old.has(x.row.id)&&!seen.has(x.p.textHash))
    .sort((a,b)=>sha('v7-new-body:'+a.row.id).localeCompare(sha('v7-new-body:'+b.row.id)))
    .filter(x=>{if(seen.has(x.p.textHash))return false;seen.add(x.p.textHash);return true;});
  const selected=[],domains=new Map(),types=new Map();
  const take=(list,n)=>{for(const x of list){if(selected.length>=n)break;const d=new URL(x.p.item.articleUrl).hostname;
    if(selected.includes(x)||(domains.get(d)||0)>=2)continue;selected.push(x);domains.set(d,(domains.get(d)||0)+1);}};
  take(available.filter(x=>x.p.rule.category!=='GERAL').filter(x=>{const n=types.get(x.p.rule.category)||0;types.set(x.p.rule.category,n+1);return n<2;}),6);
  take(available.filter(x=>!reviews.has(x.row.id)),12);take(available,12);assert.equal(selected.length,12);
  const sample={frozenBeforeCalls:true,seed:'v7-new-body',caveat:'Textos do acervo fora dos 118 anteriores; podem representar fatos já conhecidos e conter revisões editoriais. Não são novas coletas.',
    cases:selected.map(({row,p})=>({id:row.id,title:row.titulo,url:p.item.articleUrl,textHash:p.textHash,inputHash:p.inputHash,rule:p.rule.category,hadEditorialReview:reviews.has(row.id)}))};
  await writeFile(sampleFile,JSON.stringify(sample,null,2)+'\n');console.log(sample);
}else{
  const sample=await json(sampleFile),context=await loadPrimaryEvidenceContext(),byId=new Map(pool.map(x=>[x.row.id,x]));
  const results=previous.map(x=>{
    const {p}=byId.get(x.id);assert.equal(p.textHash,x.textHash);assert.equal(p.inputHash,x.inputHash);
    // Prior model responses stay frozen; this measures integration separately.
    const proposal=x.children.length?decideV6(p):decideV6(p,x.review);
    const children=x.children.map(c=>{
      const segment=p.segments.find(s=>s.start===c.start&&s.end===c.end&&s.process===c.process);
      assert.ok(segment,'Stored segment must still bind to the full original body');
      return {...c,proposal:decideV6(prepareProcess(p,segment),c.review)};
    });
    assert.deepEqual(proposal,x.proposal);assert.deepEqual(children.map(c=>c.proposal),x.children.map(c=>c.proposal));
    const integrated=integratePrimaryEvidence({...x,group:'regression',proposal,children},context);
    if(!integrated.integrated.basis)integrated.integrated=refineV7(p,x.review,proposal);
    return integrated;
  });
  if(mode==='--validate'){
    assert.deepEqual(await protectedSnapshot(),before);
    const changed=results.filter(x=>x.integrated.basis==='approved_primary_document_review');
    assert.equal(changed.length,2);assert.equal(changed.find(x=>x.integrated.children)?.integrated.children.length,3);
    console.log(JSON.stringify({validatedRoots:118,documentaryRoots:2,whatsappCalls:0,protectedFilesUnchanged:true}));process.exit(0);
  }
  const frozen=mode==='--frozen'?new Map((await json('docs/simulacao-v7-resultado.json')).results.filter(x=>x.group==='additional').map(x=>[x.id,x])):null;
  if(mode==='--ai')assert.ok(process.env.DEEPSEEK_API_KEY);
  let index=0;await Promise.all(Array.from({length:2},async()=>{while(index<sample.cases.length){
    const t=sample.cases[index++],{row,p}=byId.get(t.id);assert.equal(p.textHash,t.textHash);assert.equal(p.inputHash,t.inputHash);
    // Additional sample must not silently require process segmentation.
    assert.equal(p.segments.length,0);
    const review=frozen?frozen.get(t.id)?.review:await readV6(p,{apiKey:process.env.DEEPSEEK_API_KEY}).catch(e=>({error:e.message}));
    assert.ok(review);const proposal=decideV6(p,review);
    const integrated=integratePrimaryEvidence({id:row.id,title:row.titulo,url:p.item.articleUrl,textHash:p.textHash,inputHash:p.inputHash,
      group:'additional',rule:p.rule,review,proposal,children:[]},context);
    if(!integrated.integrated.basis)integrated.integrated=refineV7(p,review,proposal);
    results.push(integrated);console.log(`[v7] ${results.length}/130`);
  }}));
  const count=(rows,key)=>rows.reduce((a,x)=>(a[x[key].decision]=(a[x[key].decision]||0)+1,a),{});
  const regression=results.filter(x=>x.group==='regression'),additional=results.filter(x=>x.group==='additional');
  const canonical=new Map();for(const row of results){const d=row.integrated;
    for(const f of d.children||[d.canonicalFact||d])if(f.decision==='aceito'&&f.basis==='approved_primary_document_review')canonical.set(f.canonicalId,f);}
  assert.equal(canonical.size,4);assert.deepEqual(await protectedSnapshot(),before);
  const report={generatedAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    integrationVersion:'primary-evidence-1',safetyVersion:'original-v7-safety-1',modelPolicy:VERSION,mode,productionActivated:false,whatsappCalls:0,protectedFilesUnchanged:true,
    calls:mode==='--ai'?12:0,reusedPrevious:118,errors:additional.filter(x=>x.review.error).length,
    usageReused:mode==='--frozen',
    usage:additional.reduce((a,x)=>({input:a.input+(x.review.usage?.prompt_tokens||0),output:a.output+(x.review.usage?.completion_tokens||0)}),{input:0,output:0}),
    regression:{total:118,before:count(regression,'proposal'),after:count(regression,'integrated')},
    additional:{total:12,decisions:count(additional,'integrated')},canonicalPrimaryFacts:[...canonical.values()],
    results:results.sort((a,b)=>a.id.localeCompare(b.id))};
  await mkdir('output/original-v7',{recursive:true});await writeFile('output/original-v7/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report,results:undefined,canonicalPrimaryFacts:report.canonicalPrimaryFacts.map(x=>({id:x.canonicalId,category:x.category,stage:x.stage}))},null,2));
}
assert.deepEqual(await protectedSnapshot(),before);
