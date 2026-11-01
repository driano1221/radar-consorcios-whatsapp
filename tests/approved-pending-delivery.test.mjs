import test from 'node:test';
import assert from 'node:assert/strict';
import {selectApprovedPending,deliverApprovedPending} from '../scripts/send-approved-pending.mjs';
import {itemId} from '../src/lib/dedupe.mjs';
import {applyEditorialGuard} from '../src/lib/editorial-guard.mjs';
import {applySimpleTriage,wasQueuedAsConfirmed} from '../src/lib/simple-triage.mjs';
import {classifyItem} from '../src/lib/classifier.mjs';
import {reclassifyPending} from '../src/lib/dedupe.mjs';

function fixture() {
  const rawText='CONVÊNIO Nº 02/2026 QUE ENTRE SI CELEBRAM O MUNICÍPIO DE TESTE E O CONSÓRCIO INTERMUNICIPAL DE SAÚDE. O MUNICÍPIO DE TESTE, CONTRATANTE, e de outro lado o CONSÓRCIO INTERMUNICIPAL DE SAÚDE resolvem celebrar o presente convênio para a prestação compartilhada de serviços de saúde. DATA DA ASSINATURA: 01/11/2026.';
  const item={title:'CONVÊNIO Nº 02/2026',url:'https://fonte.gov.br/convenio/2',articleUrl:'https://fonte.gov.br/convenio/2',
    rawText,kind:'gazette',publishedAt:new Date().toISOString(),contentProvenance:'pagina_original'};
  item.id=itemId(item);
  return {item,state:{seen:{},pending:{[item.id]:{item,attempts:0}}},options:{guard:new Map(),confirmedEvents:new Map()}};
}
test('alias novo do Google respeita decisão retroativa da URL original, sem bloquear a fonte inteira',()=>{
  const original='https://fonte.gov.br/convenio/2';
  const guard=new Map([[original,{origin:'original_automatic',decision:{status:'confirmado',category:'ATUAÇÃO',retroactive:true}}]]);
  const alias={url:'https://news.google.com/rss/articles/novo-alias',articleUrl:original,classification:{category:'ATUAÇÃO',score:5}};
  assert.equal(applyEditorialGuard(alias,guard).publicationDecision,'historico');
  const other={...alias,articleUrl:'https://fonte.gov.br/convenio/3',sourceUrl:original};
  assert.equal(applyEditorialGuard(other,guard).publicationDecision,undefined);
});

test('correção de regra não libera lead legado que entrou em processamento na fila de envio',()=>{
  const item={title:'LEI MUNICIPAL Nº 474/2026',url:'https://fonte.gov.br/lei/474',kind:'gazette',
    rawText:'A Câmara aprovou e eu sanciono. Art. 1º Os valores repassados pelo Município de Orós ao Consórcio Público de Saúde, mediante contrato de rateio, serão reajustados anualmente pelo IPCA. Art. 2º Os contratos de programa terão vigência regulada nesta Lei.',
    classification:{category:'ADESÃO',score:5}};
  assert.equal(wasQueuedAsConfirmed(item),false);
  const current=applySimpleTriage({...item,classification:classifyItem(item)});
  assert.equal(current.catalogDecision,'confirmado');assert.equal(current.classification.category,'GOVERNANÇA');
  assert.equal(wasQueuedAsConfirmed(current),true);
  assert.equal(wasQueuedAsConfirmed({...current,triage:{status:'processando'}}),false);
  const state={seen:{},pending:{old:{item}}};
  assert.equal(reclassifyPending(state,5,null,wasQueuedAsConfirmed),1);
  assert.deepEqual(state.pending,{});assert.deepEqual(state.seen,{});
});
test('envio dirigido seleciona só confirmação atual; preserva estado e ignora recibos/aliases',()=>{
  const {state,item,options}=fixture(),before=JSON.stringify(state);
  const selected=selectApprovedPending(state,[item.id],options);
  assert.equal(selected.length,1);assert.equal(selected[0].catalogDecision,'confirmado');
  assert.equal(JSON.stringify(state),before);
  state.seen[item.id]={url:item.url,sentAt:new Date().toISOString()};
  assert.equal(selectApprovedPending(state,[item.id],options).length,0);
  state.seen={alias:{url:item.url,articleUrl:item.articleUrl,sentAt:new Date().toISOString()}};
  assert.equal(selectApprovedPending(state,[item.id],options).length,0);
  assert.throws(()=>selectApprovedPending(state,['invalid'],options));
  assert.throws(()=>selectApprovedPending(state,[item.id,item.id],options));
  state.seen={};
  options.guard.set(item.url,{origin:'original_automatic',decision:{status:'confirmado',category:'ATUAÇÃO',retroactive:true}});
  assert.throws(()=>selectApprovedPending(state,[item.id],options),/confirmação/);
});
test('envio salva cada recibo, mantém falha parcial e não reenvia o primeiro item',async()=>{
  const {item,state,options}=fixture();
  const second={...item,title:'CONVÊNIO Nº 03/2026: ENSINO REGIONAL EM PORTO',url:'https://fonte.gov.br/convenio/3',articleUrl:'https://fonte.gov.br/convenio/3',
    summary:'Plano educacional escolar para estudantes, merenda, formação docente, material didático, bibliotecas, inclusão digital, alfabetização e transporte da rede de ensino regional.'};
  second.id=itemId(second);state.pending[second.id]={item:second,attempts:0};
  const config={maxPostsPerRun:3,maxPostsPerDay:72},saved=[];
  const selected=selectApprovedPending(state,[item.id,second.id],options);
  // Distinct documents are explicit requests, not a collector's broad candidate list.
  assert.equal(selected.length,2);
  const send=async({messages,onSent})=>{assert.equal(new Set(messages.map(m=>m.messageId)).size,2);await onSent(messages[0]);throw new Error('conexão perdida');};
  await assert.rejects(deliverApprovedPending(state,selected,{send,save:async s=>saved.push(JSON.stringify(s)),config}),/conexão/);
  assert.ok(state.seen[item.id]);assert.equal(state.pending[item.id],undefined);
  assert.equal(state.pending[second.id].attempts,1);assert.equal(saved.length,2);
  assert.equal(selectApprovedPending(state,[item.id,second.id],options).length,1);
  assert.equal(await deliverApprovedPending(state,[],{send:()=>assert.fail('sem conexão'),config}),0);
});
