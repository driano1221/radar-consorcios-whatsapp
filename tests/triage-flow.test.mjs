import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {classifyItem} from '../src/lib/classifier.mjs';
import {applySimpleTriage} from '../src/lib/simple-triage.mjs';
import {observeRun} from '../src/lib/history.mjs';
import {recordRunDecisions} from '../src/lib/decision-ledger.mjs';
import {catalogRecord,mergeStateIntoCatalog,mergeCatalogRecord,saveCatalog} from '../src/lib/catalog.mjs';
import {buildDashboardData} from '../scripts/build-dashboard.mjs';
import {newsRecord,newsCsv} from '../dashboard/src/news-view.mjs';
import {isNotifiable} from '../src/lib/publication-gate.mjs';
import {loadOriginalTriage,validOriginalTriage} from '../src/lib/simple-triage.mjs';
import {loadEditorialGuard,applyEditorialGuard,loadConfirmedEventRegistry} from '../src/lib/editorial-guard.mjs';
import {reprocessTriage,upgradeLegacyTriage} from '../scripts/reprocess-triage.mjs';
import {persistArticleTexts} from '../src/lib/article-text-store.mjs';
import {formalEventKey} from '../src/lib/event-identity.mjs';
import {canonicalUrl} from '../src/lib/dedupe.mjs';
import {fileURLToPath} from 'node:url';
const classify=item=>applySimpleTriage({...item,classification:classifyItem(item)});

test('duas rodadas completas não reabrem rejeição nem convertem fila de envio em revisão humana',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'radar-triage-flow-'));
 try {
  const at='2026-10-22T06:08:00Z';
  const item=classify({kind:'gazette',title:'Extrato de contratação',url:'https://diario.exemplo/contrato',
   rawText:'O Consórcio Intermunicipal de Saúde publicou o extrato do contrato de manutenção de computadores com a empresa XYZ Ltda. O objeto é o suporte técnico dos equipamentos da sede administrativa. O prazo é de doze meses.',publishedAt:at});
  assert.equal(item.triage.status,'descartado');
  const state={seen:{},pending:{},observations:{}};
  const records=new Map();
  for(let round=0;round<2;round++) {
   recordRunDecisions(state,[item],{now:new Date(at),runId:String(round)});
   observeRun(state,[item],[],5,new Date(at),String(round));
   mergeStateIntoCatalog(records,state);
   await saveCatalog(directory,records,{now:new Date(at)});
   const row=[...records.values()][0];
   assert.equal(row.decisao_base,'descartado');
   const data=buildDashboardData({archive:[row],events:[],consortia:[],links:[],pendingIdentity:[],decisions:{[row.id]:{status:'fila',reason:'Na fila persistente para a próxima seleção.'}}});
   assert.equal(data.items[0].baseDecision,'descartado');
   assert.equal(newsRecord(data.items[0]).decision,'Rejeitada');
   assert.doesNotMatch(newsCsv(data.items),/Revisar comigo/);
  }
  const row=[...records.values()][0],retry=catalogRecord(classify({...item,triage:undefined,rawText:'',summary:'Consórcio Intermunicipal de Saúde'}),at,at);
  assert.equal(retry.triagem_automatica.status,'processando');
  assert.equal(mergeCatalogRecord(row,retry).decisao_base,'descartado');
  assert.equal(mergeCatalogRecord(row,{...retry,triagem_automatica:{version:1,status:'revisao',bodyHash:'cache_antigo'}}).decisao_base,'descartado');
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('rodada que terminou na versão antiga é migrada sem fila humana e sem alterar estado operacional',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'radar-triage-legacy-'));
 try {
  const rawText='O Consórcio Intermunicipal de Saúde publicou aviso para manutenção de computadores da sede administrativa. A empresa contratada fará o suporte técnico dos equipamentos, pelo prazo de doze meses.';
  const source={kind:'gazette',url:'https://diario.exemplo/legacy',title:'Extrato de manutenção',triage:{version:1,status:'revisao',bodyHash:'old'},classification:{category:'GERAL',score:0},summary:rawText.slice(0,100)};
  const row=catalogRecord(source,'2026-10-22','2026-10-22'),records=new Map([[row.id,row]]);
  const state={seen:{},pending:{},observations:{[row.id]:{item:source,firstSeenAt:'2026-10-22',lastSeenAt:'2026-10-22'}}};const before=JSON.stringify(state);
  await persistArticleTexts(directory,[{...source,triage:undefined,rawText,articleUrl:source.url,contentProvenance:'pagina_original'}]);
  assert.equal(await upgradeLegacyTriage(directory,records,state),1);assert.equal(records.get(row.id).decisao_base,'descartado');
  mergeStateIntoCatalog(records,state);assert.equal(records.get(row.id).decisao_base,'descartado');
  assert.equal(await upgradeLegacyTriage(directory,records,state),0);assert.equal(JSON.stringify(state),before);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('falha técnica permanece visível como processamento, sem pergunta humana ou permissão de envio',()=>{
 const item=classify({kind:'news',title:'Consórcio ratifica protocolo',url:'https://exemplo.org/ato',extractionError:'HTTP 503'});
 assert.equal(item.triage.status,'processando'); assert.deepEqual(item.triage.checks,[]); assert.equal(isNotifiable(item),false);
 const r=catalogRecord(item,'2026-10-22','2026-10-22');
 const data=buildDashboardData({archive:[r],events:[],consortia:[],links:[],pendingIdentity:[]});
 assert.equal(newsRecord(data.items[0]).decision,'Em processamento automático');
 assert.match(newsCsv(data.items),/Em processamento automático/);
});

test('uma manchete geral de feed não exige leitor, segunda leitura ou revisão humana',()=>{
 const item=classify({kind:'news',source:'Agência Brasil',title:'Brasil disputa o mundial de ginástica',url:'https://noticia.exemplo/esporte',summary:'A seleção brasileira disputou nesta quarta-feira a final por equipes do campeonato mundial de ginástica artística. A equipe terminou a competição em quinto lugar, com atletas de diversas regiões do país.'});
 assert.equal(item.triage.status,'descartado'); assert.equal(item.triage.method,'filtro_de_escopo');
});

test('autorização no artigo inicial prevalece sobre saída hipotética no anexo extenso',()=>{
 const rawText='LEI Nº 542/2026. Autoriza o ingresso municipal no Consórcio Intermunicipal de Saúde. A prefeita sanciona a seguinte lei: Art. 1º Fica autorizado o ingresso do Município de Sítio Novo no Consórcio Intermunicipal de Saúde do Seridó. Art. 2º O contrato fica ratificado. '+ 'Anexo: a retirada do município do consórcio dependerá de pedido formal. '.repeat(500);
 const item=classify({kind:'gazette',title:'LEI Nº 542/2026',url:'https://diario.exemplo/lei',rawText});
 assert.equal(item.classification.category,'ADESÃO AUTORIZADA');assert.equal(item.triage.status,'confirmado');
 assert.match(item.triage.stage,/efetiva não comprovada/); assert.ok(rawText.includes(item.triage.evidence));
});

test('duas denominações divergentes na lei geram pergunta específica, e não uma saída inventada',()=>{
 const rawText='LEI Nº 20/2026. Autoriza a participação no Consórcio de Desenvolvimento do Sertão. O prefeito sanciona a seguinte lei. Art. 1º Fica o Poder Executivo Municipal autorizado a formalizar a participação do Município de Azul no Consórcio Intermunicipal de Saúde da Serra. Art. 2º Poderá haver retirada futura.';
 const item=classify({kind:'gazette',title:'LEI Nº 20/2026',url:'https://diario.exemplo/lei20',rawText});
 assert.equal(item.triage.status,'revisao');assert.match(item.triage.reason,/ementa.*art\. 1º/);assert.equal(item.triage.checks.length,2);
});

test('assinatura por extenso confirma somente o aditivo de rateio; minuta continua bloqueada',()=>{
 const rawText='EXTRATO DO TERMO ADITIVO AO CONTRATO DE RATEIO Nº 13/2026. Contratante: Consórcio Intermunicipal de Saúde. Contratado: Município de Parelhas. OBJETO: acréscimo de recursos ao contrato. DATA DA ASSINATURA: 20 de outubro de 2026. SIGNATÁRIOS: prefeito e presidente do Consórcio.';
 const item=classify({kind:'gazette',title:'EXTRATO DO TERMO ADITIVO AO CONTRATO DE RATEIO Nº 13/2026',url:'https://diario.exemplo/rateio',rawText});
 assert.equal(item.triage.status,'confirmado');assert.match(item.triage.stage,/aditivo.*não comprova pagamento/);
 const draft=classify({...item,triage:undefined,rawText:rawText.replace('20 de outubro de 2026','___ de ______ de ____')});
 assert.notEqual(draft.triage.status,'confirmado');
});

test('parecer de comissão e minuta com fórmula de sanção não se tornam ratificações consumadas',()=>{
 for(const rawText of [
  '[Página 1] CÂMARA MUNICIPAL. PARECER DA COMISSÀO DE JUSTIÇA E REDAÇÃO. O projeto ratifica o protocolo de intenções do consórcio público. A comissão é de parecer que seja encaminhado ao prefeito. A CÂMARA APROVA: Art. 1º Fica ratificado o protocolo.',
  'PROJETO DE LEI Nº 027/2026. Ratifica a participação no Consórcio Intermunicipal. O prefeito faz saber que sanciona a seguinte lei: Art. 1º Fica ratificada a participação. JUSTIFICATIVA: contamos com o apoio para a aprovação do presente projeto e sua consequente conversão em lei.'
 ]) {
  const i=classify({kind:'gazette',title:'Documento legislativo',url:'https://camara.exemplo/documento',rawText});
  assert.equal(i.triage.status,'descartado');assert.match(i.triage.reason,/parecer|projeto/);
 }
});

test('texto recuperado retoma automaticamente a decisão e conserva bloqueio de acervo',async()=>{
 const directory=await mkdtemp(path.join(os.tmpdir(),'radar-triage-recovery-'));
 try {
  const row=catalogRecord({kind:'gazette',title:'CONTRATO DE RATEIO Nº 4/2026',url:'https://diario.exemplo/4',classification:{category:'RATEIO',score:10}},'2026-10-21','2026-10-21');
  await writeFile(path.join(directory,'arquivo-coletas.ndjson'),JSON.stringify(row)+'\n');
  await writeFile(path.join(directory,'textos-artigos.ndjson'),'');
  const first=await reprocessTriage(directory,{ids:[row.id],apply:true});assert.equal(first[0].status,'processando');
  await persistArticleTexts(directory,[{url:row.url,articleUrl:row.url,contentProvenance:'pagina_original',rawText:'CONTRATO DE RATEIO Nº 4/2026. Município de Serra Azul e Consórcio Intermunicipal de Saúde. Objeto: custeio regional. Data da assinatura: 20/10/2026. Assinantes: prefeito e presidente do consórcio.'}]);
  const second=await reprocessTriage(directory,{apply:true});assert.equal(second[0].status,'confirmado');assert.equal(second[0].retroactive,true);
  const guard=await loadEditorialGuard(directory);const item=applyEditorialGuard({url:row.url,classification:{category:'RATEIO',score:99}},guard);
  assert.equal(isNotifiable(item),false);assert.equal(item.publicationDecision,'historico');
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('os 310 preservam fonte e prova, não viram alertas e registram atos formais contra reenvio por outra URL',async()=>{
 const directory=fileURLToPath(new URL('../data/catalogo/',import.meta.url));
 const manifest=JSON.parse(await readFile(path.join(directory,'reprocessamento-310.json'),'utf8'));
 assert.equal(manifest.length,310);assert.equal(new Set(manifest.map(r=>r.id)).size,310);
 const archive=(await readFile(path.join(directory,'arquivo-coletas.ndjson'),'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
 const byId=new Map(archive.map(r=>[r.id,r]));
 const decisions=await loadOriginalTriage(directory),guard=await loadEditorialGuard(directory),registry=await loadConfirmedEventRegistry(directory);
 const texts=(await readFile(path.join(directory,'textos-artigos.ndjson'),'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
 const byText=new Map(texts.map(t=>[t.documento_id,t]));let checked=0;
 for(const m of manifest) {
  const row=byId.get(m.id),d=decisions.get(m.id);assert.ok(row&&d);assert.ok(validOriginalTriage(row,d),m.id);
  assert.equal(d.retroactive,true);if(d.status==='confirmado')assert.ok(d.evidence);
  const item=applyEditorialGuard({url:row.url,articleUrl:row.article_url,title:row.titulo,publishedAt:'2030-01-01',classification:{category:'RATEIO',score:99}},guard);
  assert.equal(isNotifiable(item),false,m.id);
  if(d.status==='confirmado'){
   const key=formalEventKey({title:row.titulo,rawText:byText.get(m.id)?.texto||'',publishedAt:row.data_noticia_original||row.data_publicacao,classification:{category:d.category,evidenceText:d.evidence}});
   if(key){assert.ok(registry.get(key)?.has(canonicalUrl(row.url)));checked++;}
  }
 }
 assert.ok(checked>0,'Atos formais devem ter bloqueio independente da URL');
});
