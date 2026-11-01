// Deliver only explicitly requested, already queued approvals; no collection or AI.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {loadConfig} from '../src/config.mjs';
import {loadState,saveState,selectUnseen,markSeen,markPendingFailure,countSentToday} from '../src/lib/dedupe.mjs';
import {loadEditorialGuard,applyEditorialGuard,loadConfirmedEventRegistry} from '../src/lib/editorial-guard.mjs';
import {reuseArticleTexts} from '../src/lib/article-text-store.mjs';
import {classifyItem} from '../src/lib/classifier.mjs';
import {applySimpleTriage} from '../src/lib/simple-triage.mjs';
import {decidePublication,isNotifiable} from '../src/lib/publication-gate.mjs';
import {isWhatsAppCategoryAllowed} from '../src/lib/whatsapp-policy.mjs';
import {formatWhatsAppMessage} from '../src/lib/format.mjs';

export function selectApprovedPending(state,ids,{guard,confirmedEvents,minimumScore=5,lookbackHours=168}={}) {
  assert.ok(ids.length && ids.length<=10 && ids.every(id=>/^[a-f0-9]{64}$/.test(id)),'Informe até dez IDs completos');
  assert.equal(new Set(ids).size,ids.length,'IDs repetidos');
  const items=[];
  for(const id of ids) {
    if(state.seen?.[id])continue;
    const queued=state.pending?.[id]?.item;
    assert.ok(queued,'Notícia não está na fila');
    const classified={...queued,classification:classifyItem(queued),ruleClassification:undefined};
    const item=applySimpleTriage(decidePublication(applyEditorialGuard(classified,guard),{lookbackHours,minimumScore}));
    assert.ok(item.catalogDecision==='confirmado'&&isNotifiable(item,minimumScore)&&isWhatsAppCategoryAllowed(item),
      'Envio exige confirmação canônica atual e permissão de publicação');
    items.push(item);
  }
  // Compare with every saved receipt/alias, without treating this same queue as sent.
  return selectUnseen(items,{...state,pending:{}},{confirmedEvents});
}

export async function deliverApprovedPending(state,items,{send,save,config}) {
  if(!items.length)return 0;
  assert.ok(items.length<=config.maxPostsPerRun && items.length<=config.maxPostsPerDay-countSentToday(state),'Limite de envio atingido');
  const messages=items.map(item=>({item,text:formatWhatsAppMessage(item),
    messageId:'3EB0'+createHash('sha256').update('radar-alert:'+item.id).digest('hex').slice(0,18).toUpperCase()}));
  try {
    const sent=await send({authDir:config.authDir,groupId:config.groupId,messages,delayMs:config.messageDelayMs,
      onSent:async entry=>{markSeen(state,entry.item);await save(state);}});
    return sent.length;
  } catch(error) {
    markPendingFailure(state,items.filter(item=>!state.seen[item.id]),error);await save(state);throw error;
  }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const config=await loadConfig();
  const state=await loadState(config.stateFile);
  const directory=fileURLToPath(new URL('../data/catalogo/',import.meta.url));
  const [guard,confirmedEvents]=await Promise.all([loadEditorialGuard(directory),loadConfirmedEventRegistry(directory)]);
  const ids=(process.env.PENDING_DELIVERY_IDS||'').split(',').filter(Boolean);
  const pending=ids.map(id=>state.pending[id]?.item).filter(Boolean);
  const restored=await reuseArticleTexts(directory,pending,{includeGazettes:true});
  const selectionState={...state,pending:{...state.pending}};
  for(const item of restored.items)selectionState.pending[item.id]={...state.pending[item.id],item};
  const items=selectApprovedPending(selectionState,ids,{guard,confirmedEvents,...config});
  console.log(`[envio dirigido] ${items.length} confirmação(ões) ainda sem recibo; coleta=0; IA=0.`);
  if(!config.sendEnabled)process.exit(0);
  assert.ok(config.persistState&&config.groupId,'Envio exige persistência e grupo configurados');
  const {sendMessages}=await import('../src/lib/whatsapp.mjs');
  const sent=await deliverApprovedPending(state,items,{send:sendMessages,save:s=>saveState(config.stateFile,s),config});
  console.log(`[envio dirigido] ${sent} mensagem(ns) publicada(s); recibos salvos individualmente.`);
}
