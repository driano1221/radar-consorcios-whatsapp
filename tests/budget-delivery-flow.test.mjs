import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {classifyItem} from '../src/lib/classifier.mjs';
import {documentaryCorrection} from '../src/lib/documentary-corrections.mjs';
import {applyAiReview,AI_PROMPT_VERSION} from '../src/lib/ai-review.mjs';
import {decideSimpleTriage,TRIAGE_VERSION} from '../src/lib/simple-triage.mjs';
import {upgradeLegacyTriage} from '../scripts/reprocess-triage.mjs';
import {buildDashboardData} from '../scripts/build-dashboard.mjs';
import {newsRecord,isQueuedForDelivery,newsCsv} from '../dashboard/src/news-view.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const nd=async name=>(await readFile(new URL('../data/catalogo/'+name,import.meta.url),'utf8')).trim().split(/\r?\n/).map(JSON.parse);
async function budget(){
 const row=(await nd('arquivo-coletas.ndjson')).find(r=>r.url==='https://amm.diariomunicipal.org/publicacao/1929786/');
 const text=(await nd('textos-artigos.ndjson')).find(t=>t.documento_id===row.id);
 assert.equal(hash(text.texto),text.texto_sha256);
 return {row,text,item:{kind:'gazette',title:row.titulo,url:row.url,rawText:text.texto}};
}

test('crédito de Juara com rubrica de rateio é rejeitado por prova, mesmo com releitura antiga',async()=>{
 const {item}=await budget();const rule=classifyItem(item);
 assert.equal(rule.category,'GERAL');assert.equal(rule.proofKind,'documentary_exclusion');
 for(const status of ['approved','rejected']){
  const triage=decideSimpleTriage(applyAiReview({...item,classification:rule,ruleClassification:rule},
   {status,category:'RATEIO',evidence:rule.evidenceText,promptVersion:AI_PROMPT_VERSION}));
  assert.equal(triage.status,'descartado');assert.deepEqual(triage.checks,[]);
  assert.ok(item.rawText.includes(triage.evidence));assert.match(triage.reason,/rubrica|abertura de crédito/);
 }
 const renamed={...item,url:'https://outro.exemplo/lei',rawText:item.rawText.replaceAll('Juara','Azul')};
 assert.equal(classifyItem(renamed).category,'GERAL');
 assert.notEqual(documentaryCorrection('Extrato de contrato de rateio',item.rawText)?.proofKind,'documentary_exclusion');
 assert.notEqual(documentaryCorrection(item.title,item.rawText+' Extrato do contrato de rateio: Município e consórcio firmam o contrato de rateio.')?.proofKind,'documentary_exclusion');
 const preview={...item,summary:item.rawText,rawText:''};
 assert.equal(decideSimpleTriage({...preview,classification:classifyItem(preview)}).status,'processando');
});

test('divergência sem prova positiva específica fica com o bot, conflito documental explícito permanece humano',()=>{
 const evidence='O documento apresenta rubricas contábeis e referências a contratos de rateio, sem instrumento celebrado ou assinatura identificada.';
 const item={title:'Publicação municipal',url:'https://exemplo.org/ato',rawText:evidence+' Texto completo do ato disponível para a próxima delimitação automática.',
  classification:{category:'RATEIO',score:20,evidenceText:evidence}};
 for(const status of ['disputed','approved']){
  const triage=decideSimpleTriage({...item,aiReview:{status,category:'PROTOCOLO',evidence,promptVersion:AI_PROMPT_VERSION}});
  assert.equal(triage.status,'processando');assert.deepEqual(triage.checks,[]);
 }
 assert.equal(decideSimpleTriage({...item,aiReview:{status:'rejected',evidence,promptVersion:AI_PROMPT_VERSION}}).status,'descartado');
 const conflict={...item,classification:{...item.classification,documentConflict:{reason:'Ementa e art. 1º identificam consórcios diferentes.',checks:['Conferir os dois nomes no protocolo anexo.']}}};
 assert.equal(decideSimpleTriage(conflict).status,'revisao');
});

test('fila é eixo de entrega: só confirmadas aguardam envio, leitura pendente e rejeição não viram confirmação',()=>{
 const row=(id,status)=>({id,url:'https://fonte.exemplo/'+id,titulo:'Ato '+id,trecho:'Trecho do documento',tipo_evento:'ATUAÇÃO',decisao_base:status});
 const archive=[row('confirmed','confirmado'),row('reading','processando'),row('rejected','descartado')];
 const data=buildDashboardData({archive,events:archive,consortia:[],links:[],pendingIdentity:[],
  deliveryQueue:archive,decisions:{confirmed:{status:'fila',triage:{version:2,status:'processando',category:'ATUAÇÃO',reason:'Leitura antiga pendente'}},
   reading:{status:'fila',reason:'Na fila persistente',triage:{version:TRIAGE_VERSION,status:'processando',category:'ATUAÇÃO',reason:'Recuperar texto',checks:[]}}}});
 const byId=new Map(data.items.map(i=>[i.id,i]));
 assert.equal(newsRecord(byId.get('confirmed')).whatsapp,'Na fila de envio');
 assert.equal(newsRecord(byId.get('reading')).decision,'Em processamento automático');
 assert.equal(newsRecord(byId.get('reading')).reason,'Recuperar texto');
 assert.equal(newsRecord(byId.get('reading')).whatsapp,'Aguarda triagem');
 assert.equal(newsRecord(byId.get('rejected')).decision,'Rejeitada');
 assert.deepEqual(data.items.filter(isQueuedForDelivery).map(i=>i.id),['confirmed']);
 assert.match(newsCsv(data.items),/Na fila de envio/);
 assert.equal(isQueuedForDelivery({...byId.get('confirmed'),alertDecision:'historico'}),false);
 assert.equal(isQueuedForDelivery({...byId.get('confirmed'),category:'CONTROLE'}),false);
 assert.equal(isQueuedForDelivery({...byId.get('confirmed'),sentAt:'2026-10-22T18:00:00Z'}),false);
});

test('migração só conclui pendências antigas, preserva decisões humanas/seladas e não toca entregas',async()=>{
 const {row,text}=await budget();const dir=await mkdtemp(path.join(os.tmpdir(),'radar-budget-'));
 try{
  const old={version:2,status:'revisao',category:'RATEIO',bodyHash:text.texto_sha256,reason:'pergunta genérica'};
  const records=new Map([['open',{...row,id:'open',triagem_automatica:old}],['human',{...row,id:'human',triagem_automatica:old}],
   ['sealed',{...row,id:'sealed',triagem_automatica:{...old,retroactive:true}}],['settled',{...row,id:'settled',triagem_automatica:{...old,status:'confirmado'}}],
   ['settledWithoutTriage',{...row,id:'settledWithoutTriage',decisao_base:'confirmado',triagem_automatica:undefined}]]);
  await writeFile(path.join(dir,'textos-artigos.ndjson'),[...records.keys()].map(id=>JSON.stringify({...text,documento_id:id})).join('\n')+'\n');
  const state={pending:{one:{item:{url:row.url}}},seen:{one:{sentAt:'2026-10-22T18:00:00Z'}},observations:{},decisions:{settledWithoutTriage:{triage:old}}};
  const before=JSON.stringify(state),preserved=[...records].slice(1).map(([id,r])=>[id,JSON.stringify(r)]);
  assert.equal(await upgradeLegacyTriage(dir,records,state,new Set(['human'])),1);
  assert.equal(records.get('open').triagem_automatica.status,'descartado');
  assert.equal(records.get('open').triagem_automatica.version,TRIAGE_VERSION);
  for(const [id,value] of preserved)assert.equal(JSON.stringify(records.get(id)),value);
  assert.equal(JSON.stringify(state),before);
 }finally{await rm(dir,{recursive:true,force:true});}
});
