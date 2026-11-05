import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadOriginalTriage,validOriginalTriage} from '../src/lib/simple-triage.mjs';
import {locateQuote} from '../src/lib/quote-evidence.mjs';
const directory='data/catalogo',nd=async n=>(await readFile(`${directory}/${n}.ndjson`,'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
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
