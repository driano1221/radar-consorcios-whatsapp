import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {loadOriginalTriage,validOriginalTriage} from '../src/lib/simple-triage.mjs';
import {loadAlternativeDecisionData,validAlternativeDecision} from '../src/lib/alternative-triage.mjs';
import {triageAlternativeTexts} from '../scripts/triage-alternative-texts.mjs';
import {loadCatalog,saveCatalog,mergeStateIntoCatalog} from '../src/lib/catalog.mjs';
import {canonicalUrl} from '../src/lib/dedupe.mjs';

const directory='data/catalogo';
const nd=async name=>(await readFile(path.join(directory,name),'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);

test('lote de 51 preserva conclusões, provas e bloqueio retroativo; acesso pendente tem tentativa durável',async()=>{
  const batch=JSON.parse(await readFile(path.join(directory,'conclusao-pendencias-51.json'),'utf8'));
  assert.equal(batch.decisions.length,51);assert.equal(new Set(batch.ids).size,51);
  assert.equal(batch.aiCalls,0);assert.equal(batch.whatsappSends,0);
  const archive=new Map((await nd('arquivo-coletas.ndjson')).map(r=>[r.id,r]));
  const humanIds=new Set((await nd('revisoes-eventos.ndjson')).map(r=>r.documento_id));
  const originals=await loadOriginalTriage(directory),auxiliary=await loadAlternativeDecisionData(directory);
  for(const original of batch.decisions){
    const row=archive.get(original.id);assert.ok(row);
    if(humanIds.has(row.id))continue; // A later explicit human correction remains authoritative.
    const decision=originals.get(row.id),alternative=auxiliary.decisions.get(row.id);
    if(decision){
      assert.ok(validOriginalTriage(row,decision));assert.equal(decision.alertAllowed,false);assert.equal(decision.weeklyAllowed,false);
      if(original.status!=='processando')for(const field of ['status','category','stage','evidence','bodyHash','relatedDocumentId'])
        assert.equal(decision[field]||'',original[field]||'',field+' mudou no caso '+original.case);
      if(decision.status==='processando'){
        assert.equal(decision.nextAction,'recuperar_texto');
        assert.ok(row.article_attempted_at&&row.article_next_attempt_at);
        assert.ok(row.article_recovery_reason);
      }
    }else{
      assert.ok(validAlternativeDecision(row,alternative,auxiliary.sources,humanIds));
      assert.equal(alternative.status,'descartado');assert.equal(alternative.alertAllowed,false);assert.equal(alternative.weeklyAllowed,false);
    }
  }
});

test('conclusão de CISGA usa prova/cache existentes e não volta à fila de IA paga',async t=>{
  const auxiliary=await loadAlternativeDecisionData(directory);
  const id='23fb9982fefd6dd05ce76eb49b1c5272a9b482e4593a763faa8712ce666cdd64';
  const row=(await nd('arquivo-coletas.ndjson')).find(r=>r.id===id);
  const temp=await mkdtemp(path.join(os.tmpdir(),'radar-sealed-alternative-'));
  t.after(()=>rm(temp,{recursive:true,force:true}));
  for(const [name,rows]of [['arquivo-coletas',[row]],['fontes-alternativas',auxiliary.sources.filter(s=>s.documento_id===id)],
    ['triagem-fontes-alternativas',[auxiliary.decisions.get(id)]],['revisoes-eventos',[]],['triagem-alternativa-uso',[]]])
    await writeFile(path.join(temp,name+'.ndjson'),rows.map(JSON.stringify).join('\n')+'\n');
  const result=await triageAlternativeTexts({directory:temp,review:async()=>assert.fail('não consultar IA novamente')});
  assert.equal(result.calls,0);assert.equal(result.attempted,0);
});

test('recaptura com cache antigo não muda classificação/etapa canônicas gravadas na base principal',async t=>{
  const batch=JSON.parse(await readFile(path.join(directory,'conclusao-pendencias-51.json'),'utf8'));
  const selected=batch.decisions.filter(d=>[1,34].includes(d.case)),ids=new Set(selected.map(d=>d.id));
  const records=await loadCatalog(path.join(directory,'arquivo-coletas.ndjson'));
  for(const id of records.keys())if(!ids.has(id))records.delete(id);
  const urls=new Set([...records.values()].map(r=>canonicalUrl(r.url)));
  const state=JSON.parse(await readFile('state/news-state.json','utf8'));
  const observations=Object.fromEntries(Object.entries(state.observations).filter(([,r])=>urls.has(canonicalUrl(r.item?.url))));
  mergeStateIntoCatalog(records,{observations,decisions:state.decisions,seen:{}},{reviewedIds:ids});
  const temp=await mkdtemp(path.join(os.tmpdir(),'radar-canonical-reread-'));
  t.after(()=>rm(temp,{recursive:true,force:true}));
  for(const name of ['triagem-reprocessada.ndjson','textos-artigos.ndjson','fontes-alternativas.ndjson','triagem-fontes-alternativas.ndjson']) {
    const rows=(await nd(name)).filter(r=>ids.has(r.documentId||r.documento_id));
    await writeFile(path.join(temp,name),rows.map(JSON.stringify).join('\n')+'\n');
  }
  await saveCatalog(temp,records);
  const persisted=await loadCatalog(path.join(temp,'arquivo-coletas.ndjson'));
  for(const expected of selected) {
    const row=persisted.get(expected.id);
    assert.equal(row.decisao_base,expected.status);assert.equal(row.tipo_evento,expected.category);
    assert.equal(row.etapa,expected.stage);assert.ok(['historico','descartado'].includes(row.decisao_alerta));
  }
});
