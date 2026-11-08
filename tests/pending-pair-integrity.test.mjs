import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{createHash}from'node:crypto';
import{loadOriginalTriage,validOriginalTriage}from'../src/lib/simple-triage.mjs';import{validReadingAdmission}from'../src/lib/reading-admission.mjs';
import{recoveryDue}from'../src/lib/recovery-policy.mjs';import{locateQuote}from'../src/lib/quote-evidence.mjs';
test('as duas pendências revisadas mantêm prova de conteúdo ou barreira de acesso válida, sem liberar retroativos',async()=>{
 const directory='data/catalogo',nd=async name=>(await readFile(directory+'/'+name+'.ndjson','utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
 const manifest=JSON.parse(await readFile(directory+'/revisao-pendencias-2026-11-08.json','utf8'));
 assert.equal(manifest.outcomes.length,2);assert.deepEqual([manifest.aiCalls,manifest.whatsappSends],[0,0]);
 const rows=new Map((await nd('arquivo-coletas')).map(r=>[r.id,r])),texts=new Map((await nd('textos-artigos')).map(t=>[t.documento_id,t])),decisions=await loadOriginalTriage(directory);
 for(const outcome of manifest.outcomes){
  const id=outcome.decision.documentId,row=rows.get(id),text=texts.get(id),d=decisions.get(id);
  assert.ok(validOriginalTriage(row,d));assert.deepEqual([d.retroactive,d.alertAllowed,d.weeklyAllowed],[true,false,false]);
  assert.ok(['confirmado','descartado'].includes(row.decisao_base));
  if(text){assert.equal(createHash('sha256').update(text.texto).digest('hex'),d.bodyHash);assert.ok(locateQuote(d.evidence,[text.texto]));assert.notEqual(d.method,'leitura_sem_prova_delimitada');}
  else{assert.equal(d.method,'barreira_de_leitura');assert.equal(d.decisionBasis,'admissibilidade');assert.ok(validReadingAdmission(row,d.admission));assert.equal(d.evidence,'');assert.equal(row.article_next_attempt_at,'');assert.equal(recoveryDue(row),false);}
 }
});
