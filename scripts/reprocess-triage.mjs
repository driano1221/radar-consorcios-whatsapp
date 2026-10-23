// Offline reconciliation: reuse original texts, never call AI or messaging clients.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {classifyItem} from '../src/lib/classifier.mjs';
import {decideSimpleTriage,rowFingerprint,TRIAGE_VERSION} from '../src/lib/simple-triage.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const nd=async(directory,name)=>{try{return (await readFile(path.join(directory,name),'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);}catch(e){if(e.code==='ENOENT')return [];throw e;}};

export function reviewCatalogRow(row,observation={},text) {
  const item={...observation,triage:undefined,editorialDecision:undefined,
    title:row.titulo,url:row.url,articleUrl:text?.url_artigo||row.article_url||observation.articleUrl,
    source:row.fonte,sourceUrl:observation.sourceUrl||row.url,
    kind:observation.kind||(/diariomunicipal|\.pdf(?:[?#]|$)/.test(row.url)?'gazette':'news'),
    publishedAt:row.data_publicacao,summary:observation.summary||row.trecho,
    rawText:text?.texto||'',excerpts:undefined,
    ...(text?{contentProvenance:'pagina_original',extractionError:undefined}:{}),
  };
  item.classification=classifyItem(item);item.ruleClassification=item.classification;
  return decideSimpleTriage(item);
}

// Migrate old generic reviews, including runs that finished during deployment.
// This changes the catalog decision only; delivery state and alert dates stay intact.
export async function upgradeLegacyTriage(directory,records,state,reviewedIds=new Set()) {
  const texts=new Map((await nd(directory,'textos-artigos.ndjson')).filter(t=>sha(t.texto||'')===t.texto_sha256).map(t=>[t.documento_id,t]));
  let updated=0;
  for(const row of records.values()) {
    const old=row.triagem_automatica||(!['confirmado','descartado'].includes(row.decisao_base)?state.decisions?.[row.id]?.triage:null),text=texts.get(row.id);
    if(reviewedIds.has(row.id)||old?.retroactive||!(old?.version<TRIAGE_VERSION&&['revisao','processando'].includes(old.status)||old?.status==='processando'&&text&&text.texto_sha256!==old.bodyHash))continue;
    const triage=reviewCatalogRow(row,state.observations?.[row.id]?.item,text);
    records.set(row.id,{...row,triagem_automatica:triage,decisao_base:triage.status,tipo_evento:triage.category,etapa:triage.stage});updated++;
  }
  return updated;
}

export async function reprocessTriage(directory,{state={},ids,apply=false}={}) {
  const [archive,texts,reviews,originals,previous]=await Promise.all(['arquivo-coletas.ndjson','textos-artigos.ndjson',
    'revisoes-eventos.ndjson','triagem-originais.ndjson','triagem-reprocessada.ndjson'].map(n=>nd(directory,n)));
  const protectedIds=new Set([...reviews,...originals].map(r=>r.documento_id||r.documentId));
  const byText=new Map(texts.filter(t=>sha(t.texto||'')===t.texto_sha256).map(t=>[t.documento_id,t]));
  const stored=new Map(previous.map(d=>[d.documentId,d]));
  const targets=ids?new Set(ids):new Set(previous.filter(d=>d.status==='processando').map(d=>d.documentId));
  const results=[];
  for(const row of archive.filter(r=>targets.has(r.id))) {
    if(protectedIds.has(row.id)) {results.push({documentId:row.id,preserved:true});continue;}
    const text=byText.get(row.id),old=stored.get(row.id),observation=state.observations?.[row.id]?.item||{};
    if(!ids&&(!text||old?.bodyHash===text.texto_sha256))continue;
    const decision={...reviewCatalogRow(row,observation,text),documentId:row.id,rowHash:rowFingerprint(row),retroactive:true,
      reviewedAt:new Date().toISOString(),alertAllowed:false,weeklyAllowed:false};
    const failure=row.article_recovery_reason||observation.extractionError;
    if (decision.status==='processando'&&decision.nextAction==='recuperar_texto'&&failure) {
      const message=/403/.test(failure)?'A fonte bloqueou a leitura':/destino_pdf/.test(failure)?'O PDF original aguarda leitura completa':/limite/.test(failure)?'O documento ultrapassa o limite de leitura desta fonte':'O texto original ainda não foi recuperado';
      decision.reason=`${message}. O bot mantém a recuperação pendente, com tentativas limitadas; não exige decisão sua.`;
    }
    assert.ok(decision.status!=='confirmado'||decision.evidence,'Confirmação sem prova');
    stored.set(row.id,decision); results.push(decision);
  }
  if(apply)await writeFile(path.join(directory,'triagem-reprocessada.ndjson'),[...stored.values()]
    .sort((a,b)=>a.documentId.localeCompare(b.documentId)).map(JSON.stringify).join('\n')+'\n');
  return results;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const stateFile=path.join(root,'state/news-state.json'),before=await readFile(stateFile);
  const idsFile=process.argv.find(a=>a.startsWith('--ids-file='))?.slice(11);
  const ids=idsFile?JSON.parse(await readFile(idsFile,'utf8')).map(r=>typeof r==='string'?r:r.id):undefined;
  const results=await reprocessTriage(path.join(root,'data/catalogo'),{state:JSON.parse(before),ids,apply:process.argv.includes('--apply')});
  assert.deepEqual(await readFile(stateFile),before,'O reprocessamento não pode alterar filas ou recibos');
  console.log(JSON.stringify({targets:results.length,counts:Object.fromEntries(['confirmado','descartado','revisao','processando','preserved'].map(s=>[s,results.filter(d=>s==='preserved'?d.preserved:d.status===s).length])),
    unresolved:results.filter(d=>['revisao','processando'].includes(d.status)).map(d=>({id:d.documentId,category:d.category,reason:d.reason,nextAction:d.nextAction})),whatsappSends:0,aiCalls:0}));
}
