// Scoped maintenance from GitHub reading artifacts; never collect, call AI or send.
import assert from 'node:assert/strict';import{readFile,writeFile,readdir}from'node:fs/promises';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';
import{loadCatalog,saveCatalog}from'../src/lib/catalog.mjs';import{reviewCatalogRow}from'./reprocess-triage.mjs';
import{rowFingerprint,validOriginalTriage}from'../src/lib/simple-triage.mjs';import{attachRecoveredText}from'../src/lib/recovery-policy.mjs';
import{validReadingAdmission}from'../src/lib/reading-admission.mjs';import{formalActDate}from'../src/lib/publication-date.mjs';import{locateQuote}from'../src/lib/quote-evidence.mjs';
import{findIdentityMentions}from'../src/lib/consortium-identity.mjs';
const directory='data/catalogo',ids=new Set(['cb9ed2abbd7930c9ac25e7820e86061f934a61ae3331c6bfba4d42d6df009ac3','1d59dd103f2998d8461e3235ce1de5ba444f32ca7e67bfc2b32d19fb73937c5e']);
assert.notEqual(process.env.SEND_ENABLED,'true');assert.notEqual(process.env.PERSIST_STATE,'true');
const sha=x=>createHash('sha256').update(x).digest('hex'),nd=async n=>(await readFile(directory+'/'+n+'.ndjson','utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const input=process.argv.filter(a=>a.startsWith('--study-file=')).map(a=>a.slice(13));assert.ok(input.length);
const studies=await Promise.all(input.map(async file=>{const raw=await readFile(file),study=JSON.parse(raw);assert.deepEqual([study.aiCalls,study.whatsappSends,study.productionWrites],[0,0,0]);assert.ok(study.archive.every(r=>ids.has(r.id)));return{study,sha256:sha(raw)};}));
assert.ok([...ids].every(id=>studies.some(s=>s.study.archive.some(r=>r.id===id))),'Falta o estudo de um dos dois casos');
const frozen=[...(await readdir('state')).filter(n=>!n.startsWith('.')).map(n=>'state/'+n),...['revisoes-eventos','triagem-originais','fontes-alternativas','triagem-fontes-alternativas'].map(n=>directory+'/'+n+'.ndjson'),...['revisao-conjunta-39','reprocessamento-310','conclusao-pendencias-26','conclusao-pendencias-51','admissibilidade-pendencias-5','conclusao-pendencias-38'].map(n=>directory+'/'+n+'.json')];
const frozenHashes=new Map(await Promise.all(frozen.map(async f=>[f,sha(await readFile(f))]))),records=await loadCatalog(directory+'/arquivo-coletas.ndjson'),oldRows=new Map([...records].map(([id,r])=>[id,JSON.stringify(r)]));
const texts=new Map((await nd('textos-artigos')).map(t=>[t.documento_id,t])),oldTexts=new Map([...texts].map(([id,t])=>[id,JSON.stringify(t)]));
const decisions=new Map((await nd('triagem-reprocessada')).map(d=>[d.documentId,d])),oldDecisions=new Map([...decisions].map(([id,d])=>[id,JSON.stringify(d)]));
const humans=new Set((await nd('revisoes-eventos')).map(r=>r.documento_id)),state=JSON.parse(await readFile('state/news-state.json','utf8')),outcomes=[];
for(const id of ids){
 const original=records.get(id);assert.ok(original&&!humans.has(id),'Não substituir revisão humana');let row={...original};
 const attempts=studies.flatMap(s=>s.study.archive.filter(r=>r.id===id)).sort((a,b)=>(b.article_attempted_at||'').localeCompare(a.article_attempted_at||'')),attempt=attempts[0];
 if(Date.parse(attempt.article_attempted_at)>Date.parse(row.article_attempted_at||'1970-01-01'))for(const k of['article_attempted_at','article_attempts','article_next_attempt_at','article_recovery_reason','article_recovery_status','article_resolved_url'])if(attempt[k]!==undefined)row[k]=attempt[k];
 const recovered=studies.flatMap(s=>s.study.texts.filter(t=>t.documento_id===id)).at(-1);
 if(recovered){assert.equal(sha(recovered.texto),recovered.texto_sha256);assert.ok(recovered.texto.length>=100);if(texts.has(id))assert.equal(JSON.stringify(recovered),JSON.stringify(texts.get(id)),'Leitura posterior já existente');else texts.set(id,recovered);row=attachRecoveredText(row,recovered);}
 const text=texts.get(id),live=row.triagem_automatica;
 if(text)assert.equal(sha(text.texto),text.texto_sha256);
 const review=!text&&row.decisao_base==='descartado'&&live?.method==='barreira_de_leitura'&&validReadingAdmission(row,live.admission)?live:reviewCatalogRow(row,state.observations?.[id]?.item,text);
 const decision={...review,documentId:id,rowHash:rowFingerprint(row),retroactive:true,reviewedAt:new Date().toISOString(),alertAllowed:false,weeklyAllowed:false};
 assert.ok(['confirmado','descartado'].includes(decision.status),'Ainda sem conclusão concreta: '+id);
 assert.notEqual(decision.method,'leitura_sem_prova_delimitada','Não zerar por rejeição genérica');
 assert.ok(validOriginalTriage(row,{...decision,bodyMatches:true}));
 if(decision.method==='barreira_de_leitura'){assert.ok(validReadingAdmission(row,decision.admission));assert.equal(decision.evidence,'');row.article_next_attempt_at='';row.article_recovery_status='barrada_na_entrada';}
 else assert.ok(text&&locateQuote(decision.evidence,[text.texto]),'Prova deve pertencer ao corpo completo');
 const date=text&&formalActDate({title:row.titulo,rawText:text.texto});if(date){row.data_fato=date;row.mes_fato=date.slice(0,7);}
 const mentions=text&&decision.status==='confirmado'?findIdentityMentions({...row,tipo_evento:decision.category,trecho:text.texto}):[];
 if(mentions.length===1){const m=mentions[0];row.consorcio=m.name;row.sigla=m.acronym;row.curatedMentions=[{nome:m.name,sigla:m.acronym,cnpj:m.cnpj,evidencia:m.evidence,fonte_evidencia:text.url_artigo}];}
 row.triagem_automatica=decision;row.decisao_base=decision.status;decisions.set(id,decision);records.set(id,row);outcomes.push({decision,reading:text?{sha256:text.texto_sha256,chars:text.texto.length,reader:text.leitor,url:text.url_artigo}:null,attempt:{count:row.article_attempts,at:row.article_attempted_at,reason:row.article_recovery_reason,next:row.article_next_attempt_at},eventAt:row.data_fato||''});
}
if(process.argv.includes('--apply')){
 for(const[name,map]of[['textos-artigos',texts],['triagem-reprocessada',decisions]])await writeFile(directory+'/'+name+'.ndjson',[...map.values()].sort((a,b)=>(a.documentId||a.documento_id).localeCompare(b.documentId||b.documento_id)).map(JSON.stringify).join('\n')+'\n');
 await saveCatalog(directory,records);const after=await loadCatalog(directory+'/arquivo-coletas.ndjson');
 for(const[id,value]of oldRows)if(!ids.has(id))assert.equal(JSON.stringify(after.get(id)),value,'Registro externo alterado: '+id);
 await writeFile(directory+'/revisao-pendencias-2026-11-08.json',JSON.stringify({version:1,at:new Date().toISOString(),baseline:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),studies:studies.map(s=>({runId:s.study.runId,at:s.study.at,sha256:s.sha256})),outcomes,aiCalls:0,whatsappSends:0},null,2)+'\n');
}
for(const[f,hash]of frozenHashes)assert.equal(sha(await readFile(f)),hash,'Arquivo protegido alterado: '+f);
for(const[id,value]of oldTexts)assert.equal(JSON.stringify(texts.get(id)),value,'Texto anterior alterado');
for(const[id,value]of oldDecisions)assert.equal(JSON.stringify(decisions.get(id)),value,'Decisão anterior alterada');
console.log(JSON.stringify({applied:process.argv.includes('--apply'),protectedFiles:frozenHashes.size,aiCalls:0,whatsappSends:0,outcomes:outcomes.map(o=>({id:o.decision.documentId,status:o.decision.status,category:o.decision.category,method:o.decision.method,eventAt:o.eventAt,attempt:o.attempt,reading:o.reading}))}));
