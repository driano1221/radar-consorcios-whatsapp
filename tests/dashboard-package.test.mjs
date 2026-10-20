import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {partitionDashboard} from '../scripts/dashboard-package.mjs';
import {hydrateSnapshot,hydrateTable,fetchSnapshot,loadParts} from '../dashboard/src/snapshot-loader.mjs';

function fixture(){
  const data={generatedAt:'2026-10-20T13:00:00.000Z',stats:{documents:20},
    items:Array.from({length:20},(_,i)=>({id:String(i),title:'Conselho e município: ação '+i,text:'ç'.repeat(100)})),
    baseTables:[{id:'arquivo',rows:Array.from({length:30},(_,i)=>({id:i,value:'dados'.repeat(30)}))},{id:'vazia',rows:[]}]};
  const {manifest,files}=partitionDashboard(data,{maxBytes:1000}),requests=[];
  const mock=async url=>{requests.push(url);if(url.startsWith('./snapshot.json'))return new Response(JSON.stringify(manifest));
    const raw=files.get(url.replace(/^\.\//,''));return new Response(raw||'',{status:raw?200:404});};
  return {data,manifest,files,mock,requests};
}
test('manifesto mantém todas as linhas e carrega tabelas somente por demanda',async()=>{
  const f=fixture();const hydrated=await fetchSnapshot('',f.mock);
  assert.deepEqual(hydrated.items,f.data.items);assert.ok(f.manifest.itemParts.length>1);
  assert.equal(hydrated.baseTables[0].rows.length,0);assert.equal(hydrated.baseTables[0].rowCount,30);
  assert.ok(!f.requests.some(r=>r.includes('table-')));
  const table=await hydrateTable(hydrated.baseTables[0],hydrated.generatedAt,f.mock);
  assert.deepEqual(table.rows,f.data.baseTables[0].rows);assert.equal(table.rowsLoaded,true);
  const count=f.requests.length;assert.equal(await hydrateTable(table,hydrated.generatedAt,f.mock),table);assert.equal(count,f.requests.length);
  assert.equal((await hydrateTable(hydrated.baseTables[1],hydrated.generatedAt,f.mock)).rowsLoaded,true);
  for(const part of [...f.manifest.itemParts,...f.manifest.baseTables.flatMap(t=>t.rowParts)])assert.ok(part.bytes<=1000);
});
test('não troca versão, não oculta falhas nem aceita partes adulteradas',async()=>{
  const f=fixture(),part=f.manifest.itemParts[0];
  await assert.rejects(loadParts([part],'outro horário',f.mock),/Versão/);
  await assert.rejects(loadParts([part],f.data.generatedAt,async()=>new Response('x')),/Integridade/);
  await assert.rejects(loadParts([part],f.data.generatedAt,async()=>new Response('',{status:503})),/503/);
  for(const bad of [{...part,url:'../state/session.json'},{...part,bytes:-1},{...part,sha256:'0'.repeat(64)}])
    await assert.rejects(loadParts([bad],f.data.generatedAt,f.mock),/formato público/);
  await assert.rejects(hydrateSnapshot({...f.manifest,itemCount:999},f.mock),/Contagem/);
  await assert.rejects(hydrateTable({...f.manifest.baseTables[0],rowCount:999},f.data.generatedAt,f.mock),/Contagem/);
});
test('duplicatas, linhas grandes e contagem adulterada são recusadas, sem truncar',async()=>{
  const f=fixture();assert.throws(()=>partitionDashboard({...f.data,items:[{id:'x',text:'x'.repeat(2000)}]},{maxBytes:1000}),/não truncar/);
  const dup=partitionDashboard({...f.data,items:[{id:'x'},{id:'x'}]});
  await assert.rejects(hydrateSnapshot(dup.manifest,async url=>new Response(dup.files.get(url.slice(2)))),/identidade/);
  const raw=JSON.stringify({generatedAt:f.data.generatedAt,rows:[]})+'\n',sha256=createHash('sha256').update(raw).digest('hex');
  await assert.rejects(loadParts([{url:`parts/items-${sha256}.json`,sha256,count:1,bytes:Buffer.byteLength(raw)}],f.data.generatedAt,async()=>new Response(raw)),/contagem/);
});
test('snapshot antigo continua funcionando e fallback só acontece no 404',async()=>{
  const f=fixture();assert.equal(await hydrateSnapshot(f.data),f.data);
  const data=await fetchSnapshot('',async url=>url.includes('snapshot')?new Response('',{status:404}):new Response(JSON.stringify(f.data)));
  assert.deepEqual(data,f.data);
  await assert.rejects(fetchSnapshot('',async()=>new Response('',{status:500})),/500/);
});
