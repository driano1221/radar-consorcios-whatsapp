// Isolated experiment: no imports of senders, catalog writers or apply scripts.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {prepareOriginal,decideOriginal,reviewOriginal,bindContentReview,contentReviewKey,sha,VERSION,RULE_VERSION} from './lib/original-triage-shadow.mjs';
import {protectedSnapshot} from './pilot-retroactive-ten.mjs';
import {applyEditorialGuard,loadEditorialGuard} from '../src/lib/editorial-guard.mjs';
import {isNotifiable} from '../src/lib/publication-gate.mjs';

const mode=process.argv[2]||'--replay';
assert.ok(['--freeze','--replay','--ai'].includes(mode),'No apply or send mode');
const protectedBefore=await protectedSnapshot();
const rows=async n=>(await readFile(`data/catalogo/${n}.ndjson`,'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const archive=await rows('arquivo-coletas'),texts=new Map((await rows('textos-artigos')).map(x=>[x.documento_id,x]));
const reviews=new Map((await rows('revisoes-eventos')).map(x=>[x.documento_id,x]));
const saved=JSON.parse(await readFile('docs/simulacao-v31-respostas-congeladas.json','utf8'));
const baseline=JSON.parse(await readFile('docs/simulacao-originais-v32-2026-10-16-resumo.json','utf8'));
const prior=new Map(baseline.sample.map(x=>[x.id,x]));
const prepared=archive.map(row=>({row,p:prepareOriginal(row,texts.get(row.id))}));
const byId=new Map(prepared.map(x=>[x.row.id,x]));
const samplePath='docs/simulacao-v4-amostra-nova.json';
const count=a=>a.reduce((acc,d)=>(acc[d.decision]=(acc[d.decision]||0)+1,acc),{});

if(mode==='--freeze') {
  // Selection precedes reading results. Max two per domain to avoid a cohort
  // made mostly of recruitment notices or judgment metadata from one portal.
  const seen=new Set(saved.answers.map(x=>x.textHash)),oldIds=new Set(saved.answers.map(x=>x.id));
  const pool=prepared.filter(x=>x.p.eligible&&!reviews.has(x.row.id)&&!oldIds.has(x.row.id))
    .sort((a,b)=>sha('v4-independent:'+a.row.id).localeCompare(sha('v4-independent:'+b.row.id)))
    .filter(x=>{if(seen.has(x.p.textHash))return false;seen.add(x.p.textHash);return true;});
  const selected=[],domains=new Map();
  const take=(candidates,limit)=>{let n=0;for(const x of candidates){
    const domain=new URL(x.p.item.articleUrl).hostname.replace(/^www\./,'');
    if(n>=limit)break;if((domains.get(domain)||0)>=2||selected.includes(x))continue;
    domains.set(domain,(domains.get(domain)||0)+1);selected.push(x);n++;
  }};
  take(pool.filter(x=>x.p.rawRule.category!=='GERAL'&&x.p.rawRule.score>=5),6);
  take(pool.filter(x=>x.p.rawRule.category==='GERAL'||x.p.rawRule.score<5),12-selected.length);
  assert.equal(selected.length,12);
  const sample={seed:'v4-independent',policy:VERSION,ruleVersion:RULE_VERSION,selectedBeforeAi:true,
    productionActivated:false,pool:pool.length,selection:'Até seis positivos pela regra de produção; completar com negativos; máximo dois por domínio; corpos distintos e fora dos 82 anteriores.',
    cases:selected.map(({row,p})=>({id:row.id,textHash:p.textHash,inputHash:p.inputHash,title:row.titulo,url:p.item.articleUrl,
      productionRule:p.rawRule.category,firstSeen:row.primeira_coleta,chars:p.item.rawText.length}))};
  await writeFile(samplePath,JSON.stringify(sample,null,2)+'\n');
  console.log(JSON.stringify(sample,null,2));
} else {
  const oldResults=saved.answers.map(a=>{
    const {row,p}=byId.get(a.id)||{}; assert.ok(p?.eligible,a.id);
    assert.equal(p.textHash,a.textHash);
    if(!a.review.error)assert.equal(contentReviewKey(p),a.review.contentReviewKey);
    // The model saw only the full body. Rebind unchanged content when current
    // metadata was corrected, recording this rather than hiding a changed hash.
    const metadataRebound=p.inputHash!==a.inputHash;
    assert.ok(!metadataRebound||!a.review.error,'Cannot rebind an invalid answer');
    const review=metadataRebound?bindContentReview(p,a.review):a.review;
    const proposal=decideOriginal(p,review);
    const r=reviews.get(row.id);
    return {id:row.id,title:row.titulo,url:p.item.articleUrl,before:prior.get(row.id).proposal,proposal,metadataRebound,
      currentReview:r?{decision:r.decisao,evidenceUrl:r.fonte_evidencia,category:r.categoria}:null,
      savedReadingError:a.review.error||null};
  });
  assert.equal(oldResults.length,82);
  const frozen=JSON.parse(await readFile(samplePath,'utf8'));
  const selected=frozen.cases.map(c=>{const x=byId.get(c.id);assert.equal(x?.p.textHash,c.textHash);assert.equal(x.p.inputHash,c.inputHash);return x;});
  const fresh=[]; const cache=new Map();
  if(mode==='--ai')assert.ok(process.env.DEEPSEEK_API_KEY,'API key unavailable');
  let next=0;
  await Promise.all(Array.from({length:2},async()=>{while(next<selected.length){
    const {row,p}=selected[next++]; let review;
    if(mode==='--ai') {
      const key=contentReviewKey(p);
      if(!cache.has(key))cache.set(key,reviewOriginal(p,{apiKey:process.env.DEEPSEEK_API_KEY}).catch(e=>({error:e.message})));
      const shared=await cache.get(key);review=shared.error?shared:bindContentReview(p,shared);
    }
    fresh.push({id:row.id,title:row.titulo,url:p.item.articleUrl,textHash:p.textHash,inputHash:p.inputHash,
      productionRule:p.rawRule.category,rule:p.rule,proposal:decideOriginal(p,review),review:review||null});
    console.log(`[simulação v4] ${fresh.length}/${selected.length}`);
  }}));
  fresh.sort((a,b)=>a.id.localeCompare(b.id));
  // Documentary corrections are a SEPARATE audit layer, never answers inserted
  // into the original-text model, nor extra automatic successes in the 82.
  const manifest=JSON.parse(await readFile('data/catalogo/documentos-primarios-2026-10-16.json','utf8'));
  const guard=await loadEditorialGuard('data/catalogo');let checkedProofs=0;
  for(const r of manifest.appliedReviews){
    assert.deepEqual(reviews.get(r.documento_id),r);assert.equal(r.publicar,false);
    for(const d of r.documentos_primarios){
      const doc=manifest.documents.find(x=>x.sha256===d.pdf_sha256);
      assert.ok(doc.pages[d.pagina-1].includes(d.trecho));checkedProofs++;
    }
    for(const url of r.urls_documento||[])assert.equal(isNotifiable(applyEditorialGuard({url,
      classification:{category:'CONTROLE',score:12,reasons:[]}},guard)),false);
  }
  assert.deepEqual(await protectedSnapshot(),protectedBefore);
  const fullCounts=prepared.reduce((a,x)=>(a[x.p.eligible?'elegivel':x.p.reason]=(a[x.p.eligible?'elegivel':x.p.reason]||0)+1,a),{});
  const report={generatedAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
    readingVersion:VERSION,ruleVersion:RULE_VERSION,productionActivated:false,whatsappCalls:0,protectedFilesUnchanged:true,
    archive:archive.length,storedTexts:texts.size,eligibility:fullCounts,
    historical:{total:82,before:count(oldResults.map(x=>x.before)),after:count(oldResults.map(x=>x.proposal)),
      changed:oldResults.filter(x=>JSON.stringify(x.before)!==JSON.stringify(x.proposal)).length,results:oldResults},
    documentary:{canonicalFacts:4,reviews:6,pdfs:manifest.documents.length,checkedProofs,
      conclusion:'Correções documentais preservadas e sem envio; não contam como decisões autônomas dos textos originais.'},
    fresh:{total:fresh.length,calls:cache.size,decisions:count(fresh.map(x=>x.proposal)),errors:fresh.filter(x=>x.review?.error).length,
      usage:[...cache.values()].length?fresh.reduce((a,x)=>({input:a.input+(x.review?.usage?.prompt_tokens||0),output:a.output+(x.review?.usage?.completion_tokens||0)}),{input:0,output:0}):{input:0,output:0},results:fresh}};
  await mkdir('output/original-v4',{recursive:true});
  await writeFile('output/original-v4/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report,historical:{...report.historical,results:undefined},fresh:{...report.fresh,results:undefined}},null,2));
}
assert.deepEqual(await protectedSnapshot(),protectedBefore);
