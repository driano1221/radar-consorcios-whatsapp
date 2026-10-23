import {triageBucket} from './triage-model.mjs?v=triagem20261023';

export function isQueuedForDelivery(item) {
  return Boolean(item.deliveryQueued && !item.sentAt && triageBucket(item)==='accepted' &&
    item.category!=='CONTROLE' && item.alertDecision!=='historico');
}

// The table and the downloadable main base use the same decision and fields.
export function newsRecord(item) {
  const facts=item.editorialReview?.facts||{};
  const decision={accepted:'Confirmada',rejected:'Rejeitada',pending:'Revisar comigo',processing:'Em processamento automático'}[triageBucket(item)];
  const whatsapp=item.sentAt?(decision==='Rejeitada'?'Enviada antes da revisão':'Enviada'):item.category==='CONTROLE'?'Só no painel':decision==='Rejeitada'?'Não enviar':
    item.alertDecision==='historico'?'Sem reenvio':isQueuedForDelivery(item)?'Na fila de envio':
    ['Revisar comigo','Em processamento automático'].includes(decision)?'Aguarda triagem':
      item.alertDecision==='elegivel'?'Elegível':'Sem envio registrado';
  return {id:item.id,publication:item.publishedAt||String(item.publishedYear||''),discovered:item.firstSeenAt||'',
    eventDate:item.eventAt||item.eventMonth||'',title:item.title,source:item.source||'',
    consortium:facts.sigla||facts.consorcio||item.consortiumAcronym||item.consortium||item.links?.map(l=>l.name).join('; ')||'',
    municipality:facts.municipio??item.municipality??'',uf:facts.uf??item.uf??'',
    category:decision==='Rejeitada'?'—':item.categoryFamily&&item.categoryFamily!=='ATUAÇÃO'?item.categoryFamily:item.categoryDisplay||item.category||'A conferir',
    stage:item.stage||'',decision,whatsapp,sentAt:item.sentAt||'',url:item.url,reason:item.reason||''};
}
export function newsCsv(items) {
  const fields={publication:'data_publicacao',discovered:'primeira_coleta',eventDate:'data_fato',title:'noticia',
    consortium:'consorcio',municipality:'municipio',uf:'uf',category:'classificacao',stage:'etapa',decision:'decisao',
    whatsapp:'whatsapp',sentAt:'enviado_em',source:'fonte',url:'link',reason:'motivo',id:'id'};
  const cell=value=>'"'+String(value??'').replace(/^[=+@-]/,"'$&").replaceAll('"','""')+'"';
  return '\uFEFF'+[Object.values(fields),...items.map(item=>Object.keys(fields).map(key=>newsRecord(item)[key]))]
    .map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
