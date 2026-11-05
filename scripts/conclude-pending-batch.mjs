// Apply only the requested batch, from preserved bodies and the GitHub reading artifact.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {loadCatalog,saveCatalog} from '../src/lib/catalog.mjs';
import {rowFingerprint,validOriginalTriage} from '../src/lib/simple-triage.mjs';
import {attachRecoveredText} from '../src/lib/recovery-policy.mjs';
import {reviewCatalogRow} from './reprocess-triage.mjs';
const directory='data/catalogo',sha=x=>createHash('sha256').update(x).digest('hex');
const nd=async n=>(await readFile(path.join(directory,n+'.ndjson'),'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const batch=JSON.parse(await readFile(path.join(directory,'triagem-38-alvos.json'),'utf8'));
const ids=new Set(batch.targets.map(t=>t.id));assert.equal(ids.size,batch.targets.length);
const input=process.argv.find(a=>a.startsWith('--study-file='))?.slice(13);assert.ok(input,'Indique o artefato do estudo GitHub');
const studyBytes=await readFile(input),study=JSON.parse(studyBytes);
assert.deepEqual([study.aiCalls,study.whatsappSends,study.productionWrites],[0,0,0]);
assert.deepEqual(new Set(study.archive.map(r=>r.id)),new Set(batch.targets.filter(t=>t.needsReading).map(t=>t.id)));
const frozen=[...(await readdir('state')).filter(n=>!n.startsWith('.')).map(n=>'state/'+n),
 ...['revisoes-eventos.ndjson','triagem-originais.ndjson','revisao-conjunta-39.json','reprocessamento-310.json',
 'conclusao-pendencias-26.json','conclusao-pendencias-51.json','admissibilidade-pendencias-5.json',
 'fontes-alternativas.ndjson','triagem-fontes-alternativas.ndjson'].map(n=>directory+'/'+n)];
const hashes=new Map(await Promise.all(frozen.map(async f=>[f,sha(await readFile(f))])));
const state=JSON.parse(await readFile('state/news-state.json','utf8'));
const records=await loadCatalog(path.join(directory,'arquivo-coletas.ndjson'));
const beforeRows=new Map([...records].map(([id,r])=>[id,JSON.stringify(r)]));
const texts=new Map((await nd('textos-artigos')).map(t=>[t.documento_id,t]));
const beforeTexts=new Map([...texts].map(([id,t])=>[id,JSON.stringify(t)]));
const decisions=new Map((await nd('triagem-reprocessada')).map(d=>[d.documentId,d]));
const beforeDecisions=new Map([...decisions].map(([id,d])=>[id,JSON.stringify(d)]));
const humans=new Set((await nd('revisoes-eventos')).map(r=>r.documento_id));
const outcomes=[];
for(const target of batch.targets){
 const row=records.get(target.id);assert.ok(row&&!humans.has(row.id));
 assert.equal(row.decisao_base,'processando','Não substituir uma decisão posterior: '+row.id);
 let updated={...row};const attempt=study.archive.find(r=>r.id===row.id);
 if(attempt){
  assert.ok(Date.parse(attempt.article_attempted_at)>Date.parse(row.article_attempted_at||'1970-01-01'));
  assert.ok(attempt.article_attempts>Number(row.article_attempts||0));
  for(const key of ['article_attempts','article_attempted_at','article_next_attempt_at','article_recovery_reason','article_recovery_status','article_resolved_url'])
   if(attempt[key]!==undefined)updated[key]=attempt[key];
  updated.article_recovery_reason=String(updated.article_recovery_reason||'').replace(/^falha:\s*(http_\d{3})$/,'$1');
 }
 const reading=study.texts.find(t=>t.documento_id===row.id);
 if(reading){assert.ok(!texts.has(row.id));assert.equal(sha(reading.texto),reading.texto_sha256);texts.set(row.id,reading);updated=attachRecoveredText(updated,reading);}
 const text=texts.get(row.id);if(text)assert.equal(sha(text.texto),text.texto_sha256);
 const d={...reviewCatalogRow(updated,state.observations?.[row.id]?.item,text),documentId:row.id,rowHash:rowFingerprint(updated),
  retroactive:true,reviewedAt:new Date().toISOString(),alertAllowed:false,weeklyAllowed:false};
 assert.ok(['confirmado','descartado'].includes(d.status),'Leitura não concluída: '+row.id+' '+d.reason);
 assert.ok(validOriginalTriage(updated,{...d,bodyMatches:true}));
 decisions.set(row.id,d);updated.triagem_automatica=d;
 if(d.method==='barreira_de_leitura')Object.assign(updated,{article_next_attempt_at:'',article_recovery_status:'barrada_na_entrada'});
 records.set(row.id,updated);outcomes.push(d);
}
if(process.argv.includes('--apply')){
 for(const[name,map]of[['textos-artigos',texts],['triagem-reprocessada',decisions]])
  await writeFile(path.join(directory,name+'.ndjson'),[...map.values()].sort((a,b)=>(a.documentId||a.documento_id).localeCompare(b.documentId||b.documento_id)).map(JSON.stringify).join('\n')+'\n');
 await saveCatalog(directory,records);
 const after=await loadCatalog(path.join(directory,'arquivo-coletas.ndjson'));
 for(const[id,before]of beforeRows)if(!ids.has(id))assert.equal(JSON.stringify(after.get(id)),before,'Registro externo alterado: '+id);
 await writeFile(path.join(directory,'conclusao-pendencias-38.json'),JSON.stringify({version:1,at:new Date().toISOString(),baseline:batch.baseline,
  studyRun:`https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/${study.runId}`,studySha256:sha(studyBytes),
  decisions:outcomes,aiCalls:0,whatsappSends:0},null,2)+'\n');
 await writeFile(path.join(directory,'recuperacao-lote-38.json'),JSON.stringify({version:1,runId:study.runId,at:study.at,studySha256:sha(studyBytes),
  attempts:study.archive.map(r=>({id:r.id,attempts:r.article_attempts,at:r.article_attempted_at,reason:r.article_recovery_reason,
   resolvedUrl:r.article_resolved_url,next:r.article_next_attempt_at})),pdfAudits:study.audits,aiCalls:0,whatsappSends:0},null,2)+'\n');
}
for(const[f,hash]of hashes)assert.equal(sha(await readFile(f)),hash,'Arquivo protegido mudou: '+f);
for(const[id,value]of beforeTexts)assert.equal(JSON.stringify(texts.get(id)),value);
for(const[id,value]of beforeDecisions)assert.equal(JSON.stringify(decisions.get(id)),value);
console.log(JSON.stringify({applied:process.argv.includes('--apply'),counts:outcomes.reduce((a,d)=>(a[d.status]=(a[d.status]||0)+1,a),{}),
 decisions:outcomes.map(d=>({id:d.documentId.slice(0,8),status:d.status,category:d.category,method:d.method})),protectedFiles:hashes.size,aiCalls:0,whatsappSends:0}));
