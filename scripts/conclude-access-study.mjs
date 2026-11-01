// Offline application of the bounded GitHub study. Never connect messaging/AI.
import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {reviewCatalogRow} from './reprocess-triage.mjs';
import {loadCatalog,saveCatalog} from '../src/lib/catalog.mjs';
import {rowFingerprint,validOriginalTriage} from '../src/lib/simple-triage.mjs';
import {redactPublicText} from '../src/lib/article-text-store.mjs';
import {bulletinLaw} from '../src/lib/bulletin-law.mjs';
const sha=x=>createHash('sha256').update(x).digest('hex'),directory='data/catalogo';
const nd=async name=>(await readFile(path.join(directory,name),'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const input=process.argv.find(a=>a.startsWith('--study-dir='))?.slice(12);
assert.ok(input,'Indique o diretório do artefato public-recovery-validation');
const studyBytes=await readFile(path.join(input,'pending-access-study.json'));
const study=JSON.parse(studyBytes),readings=JSON.parse(await readFile(path.join(input,'pending-access-readings.json'),'utf8'));
assert.deepEqual([study.aiCalls,study.whatsappSends,study.archiveWrites],[0,0,0]);
const batch=JSON.parse(await readFile(path.join(directory,'conclusao-pendencias-51.json'),'utf8'));
const ids=new Set(batch.decisions.filter(d=>d.status==='processando').map(d=>d.id));
assert.equal(ids.size,5);assert.deepEqual(new Set(study.reports.map(r=>r.id)),ids);
const protectedPaths=[...(await readdir('state')).filter(n=>!n.startsWith('.')).map(n=>'state/'+n),
  ...['revisoes-eventos.ndjson','triagem-originais.ndjson','revisao-conjunta-39.json','reprocessamento-310.json',
    'conclusao-pendencias-26.json','conclusao-pendencias-51.json'].map(n=>directory+'/'+n)];
const protectedHashes=new Map(await Promise.all(protectedPaths.map(async p=>[p,sha(await readFile(p))])));
const records=await loadCatalog(path.join(directory,'arquivo-coletas.ndjson'));
const beforeRows=new Map([...records].map(([id,row])=>[id,JSON.stringify(row)]));
const texts=new Map((await nd('textos-artigos.ndjson')).map(t=>[t.documento_id,t]));
const beforeTexts=new Map([...texts].map(([id,t])=>[id,JSON.stringify(t)]));
const decisions=new Map((await nd('triagem-reprocessada.ndjson')).map(d=>[d.documentId,d]));
const beforeDecisions=new Map([...decisions].map(([id,d])=>[id,JSON.stringify(d)]));
const humanIds=new Set((await nd('revisoes-eventos.ndjson')).map(r=>r.documento_id));
const state=JSON.parse(await readFile('state/news-state.json','utf8'));
let context;
for(const report of study.reports){
  const row=records.get(report.id);assert.ok(row&&!humanIds.has(row.id));
  assert.equal(row.decisao_base,'processando','Não sobrescrever decisão posterior');
  assert.equal(Number(row.article_attempts),report.previousAttempts,'Estudo ficou desatualizado');
  assert.ok(report.routes.every(r=>r.attemptedAt>row.article_attempted_at&&r.status));
  assert.ok(!texts.has(row.id),'Não substituir íntegra já existente');
  const last=report.routes.at(-1),reading=readings.find(r=>r.id===row.id);
  let updated={...row,article_attempts:report.previousAttempts+report.routes.length,
    article_attempted_at:last.attemptedAt,article_next_attempt_at:'',article_recovery_reason:last.failure||'',
    article_recovery_status:reading?'recuperado':'barrada_na_entrada'};
  if(reading){
    assert.equal(reading.bodyHash,sha(reading.text));
    assert.equal(reading.sourceUrl,'https://www2.itanhaem.sp.gov.br/wp-content/uploads/2023/10/829.pdf');
    assert.ok(report.routes.find(r=>r.url===reading.sourceUrl&&r.complete&&r.pendingPages.length===0));
    assert.equal(reading.pages.length,20);
    const unit=bulletinLaw(reading.pages,{number:4696,year:2023,municipality:'Itanhaém'});
    assert.match(row.article_resolved_url,/\/4696-2023\/Arquivos\/2$/);
    const texto=redactPublicText(unit.text),textHash=sha(texto);
    context={version:1,studyRun:'https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/41337003818',
      sourceUrl:reading.sourceUrl,pdfSha256:reading.pdfSha256,complete:true,originalReadingSha256:reading.bodyHash,
      pages:reading.pages.map(p=>({...p,texto:redactPublicText(p.texto)})),unit:{...unit,text:texto,bodyHash:textHash}};
    texts.set(row.id,{documento_id:row.id,url_original:row.url,url_artigo:reading.sourceUrl,
      recuperado_em:last.attemptedAt,leitor:'pdf_oficial_ato_delimitado',texto_sha256:textHash,texto,
      titulo_documento:unit.title,paginas:[unit.page],contexto:'leituras-boletins/itanhaem-829-2023.json'});
    updated={...updated,titulo_descoberto:row.titulo,titulo:unit.title,data_indexacao:row.data_publicacao,
      data_publicacao:'',data_fato:'2023-10-18',periodo_publicacao:'20 a 24/10/2023',
      article_url:reading.sourceUrl,article_resolved_url:reading.sourceUrl,
      article_reader:'pdf_oficial_ato_delimitado',article_text_sha256:textHash};
  }else assert.ok(report.routes.every(r=>r.failure&&!r.characters),'Leitura disponível não pode ser barrada');
  const decision={...reviewCatalogRow(updated,state.observations?.[row.id]?.item,texts.get(row.id)),
    documentId:row.id,rowHash:rowFingerprint(updated),retroactive:true,reviewedAt:study.at,
    alertAllowed:false,weeklyAllowed:false};
  assert.equal(decision.status,'descartado');
  assert.equal(decision.method,reading?'filtro_de_data':'barreira_de_leitura');
  assert.ok(validOriginalTriage(updated,{...decision,bodyMatches:true}));
  decisions.set(row.id,decision);records.set(row.id,{...updated,triagem_automatica:decision});
}
const result={version:1,studyRun:'https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/41337003818',
  studySha256:sha(studyBytes),at:study.at,reports:study.reports,
  decisions:[...ids].map(id=>decisions.get(id)),aiCalls:0,whatsappSends:0};
if(process.argv.includes('--apply')){
  await mkdir(path.join(directory,'leituras-boletins'),{recursive:true});
  await writeFile(path.join(directory,'leituras-boletins/itanhaem-829-2023.json'),JSON.stringify(context,null,2)+'\n');
  for(const [name,map]of[['textos-artigos',texts],['triagem-reprocessada',decisions]])
    await writeFile(path.join(directory,name+'.ndjson'),[...map.values()].sort((a,b)=>(a.documentId||a.documento_id).localeCompare(b.documentId||b.documento_id)).map(JSON.stringify).join('\n')+'\n');
  await saveCatalog(directory,records);
  await writeFile(path.join(directory,'admissibilidade-pendencias-5.json'),JSON.stringify(result,null,2)+'\n');
  const after=await loadCatalog(path.join(directory,'arquivo-coletas.ndjson'));
  for(const [id,value]of beforeRows)if(!ids.has(id))assert.equal(JSON.stringify(after.get(id)),value,'Registro externo ao lote mudou: '+id);
}
for(const [p,hash]of protectedHashes)assert.equal(sha(await readFile(p)),hash,'Arquivo protegido alterado: '+p);
for(const [id,value]of beforeTexts)assert.equal(JSON.stringify(texts.get(id)),value);
for(const [id,value]of beforeDecisions)if(!ids.has(id))assert.equal(JSON.stringify(decisions.get(id)),value);
console.log(JSON.stringify({applied:process.argv.includes('--apply'),decisions:result.decisions.map(d=>({id:d.documentId.slice(0,8),status:d.status,method:d.method,reason:d.reason})),
  protectedFiles:protectedHashes.size,humanReviews:humanIds.size,preservedBodies:beforeTexts.size,aiCalls:0,whatsappSends:0},null,2));
