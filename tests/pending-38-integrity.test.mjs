import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadOriginalTriage,validOriginalTriage} from '../src/lib/simple-triage.mjs';
import {locateQuote} from '../src/lib/quote-evidence.mjs';
import {mergeStateIntoCatalog} from '../src/lib/catalog.mjs';
const directory='data/catalogo',nd=async n=>(await readFile(`${directory}/${n}.ndjson`,'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);

test('recaptura com título normalizado não invalida o selo do lote; adulteração de título ou corpo continua inválida',async()=>{
 const rows=await nd('arquivo-coletas'),decisions=await loadOriginalTriage(directory);
 const row=rows.find(r=>r.id==='d38a2b2ec15e50412522ecce365a4a966de5358b247a848071c0b4c8fbc51288'),decision=decisions.get(row.id);
 const text=(await nd('textos-artigos')).find(t=>t.documento_id===row.id);
 assert.ok(validOriginalTriage(row,decision));
 const title=row.titulo.replace(/ \(CNM\)$/,'');assert.notEqual(title,row.titulo);
 const item={kind:'news',url:row.url,title,source:row.fonte,summary:text.texto,rawText:text.texto,
  triage:{...decision,retroactive:false}};
 const recapturedAt=new Date(Date.parse(row.ultima_coleta||row.primeira_coleta)+60000).toISOString();
 const state={observations:{recapture:{item,firstSeenAt:row.primeira_coleta,lastSeenAt:recapturedAt}}};
 const records=new Map([[row.id,structuredClone(row)]]);
 mergeStateIntoCatalog(records,state,{reviewedIds:new Set(decisions.keys())});
 const after=records.get(row.id);
 for(const key of ['id','url','titulo','trecho'])assert.equal(after[key],row[key],key);
 assert.ok(validOriginalTriage(after,decision));assert.equal(after.ultima_coleta,recapturedAt);
 mergeStateIntoCatalog(records,{observations:{older:{item,firstSeenAt:row.primeira_coleta,lastSeenAt:row.ultima_coleta}}},{reviewedIds:new Set(decisions.keys())});
 assert.equal(records.get(row.id).ultima_coleta,recapturedAt,'observação antiga não pode retroceder a data');
 assert.ok(validOriginalTriage(records.get(row.id),decision));
 assert.equal(state.observations.recapture.item.title,title,'a captura nova continua auditável');
 assert.equal(validOriginalTriage({...after,titulo:title},decision),false);
 assert.equal(validOriginalTriage(after,{...decision,bodyMatches:false}),false);
 const unsealed=new Map([[row.id,structuredClone(row)]]);mergeStateIntoCatalog(unsealed,state);
 assert.equal(unsealed.get(row.id).titulo,title,'não congelar observações sem decisão lacrada');
});
test('38 conclusões mantêm corpo/prova íntegros e bloqueios retroativos, inclusive após atualização de catálogo',async()=>{
 const batch=JSON.parse(await readFile(`${directory}/conclusao-pendencias-38.json`,'utf8'));
 assert.equal(batch.decisions.length,38);assert.deepEqual([batch.aiCalls,batch.whatsappSends],[0,0]);
 const rows=new Map((await nd('arquivo-coletas')).map(r=>[r.id,r]));
 const texts=new Map((await nd('textos-artigos')).map(r=>[r.documento_id,r]));
 const humans=new Set((await nd('revisoes-eventos')).map(r=>r.documento_id));
 const decisions=await loadOriginalTriage(directory);
 for(const original of batch.decisions){
  if(humans.has(original.documentId))continue;
  const row=rows.get(original.documentId),d=decisions.get(row.id),body=texts.get(row.id)?.texto||'';
  assert.ok(validOriginalTriage(row,d),row.id);assert.equal(d.bodyHash,createHash('sha256').update(body).digest('hex'));
  for(const field of ['status','category','stage','evidence','bodyHash','method'])assert.equal(d[field],original[field],field+' '+row.id);
  assert.ok(['confirmado','descartado'].includes(row.decisao_base));assert.equal(d.alertAllowed,false);assert.equal(d.weeklyAllowed,false);
  if(d.method==='barreira_de_leitura'){assert.equal(d.decisionBasis,'admissibilidade');assert.equal(d.evidence,'');assert.equal(row.article_next_attempt_at,'');}
  else assert.ok(locateQuote(d.evidence,[body]),row.id);
 }
});
