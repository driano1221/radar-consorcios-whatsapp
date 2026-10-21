import test from 'node:test';
import assert from 'node:assert/strict';
import {newsRecord,newsCsv} from '../dashboard/src/news-view.mjs';

test('base principal distingue data original, descoberta e envio e preserva a etapa',()=>{
  const item={id:'1',title:'Conselho recomenda o rateio',publishedAt:'2026-10-19T12:00:00Z',firstSeenAt:'2026-10-21T12:00:00Z',
    category:'RATEIO EM TRAMITAÇÃO',categoryDisplay:'RATEIO EM TRAMITAÇÃO',stage:'parecer; não assinado',baseDecision:'confirmado',
    alertDecision:'historico',uf:'PR',links:[{name:'CIEDEPAR'}],url:'https://example.org/ato'};
  const r=newsRecord(item);
  assert.equal(r.publication,'2026-10-19T12:00:00Z');assert.equal(r.discovered,'2026-10-21T12:00:00Z');
  assert.equal(r.stage,'parecer; não assinado');assert.equal(r.whatsapp,'Sem reenvio');assert.equal(r.consortium,'CIEDEPAR');
  const csv=newsCsv([item]);assert.match(csv,/'?data_publicacao/);assert.match(csv,/parecer; não assinado/);
  assert.match(csv,/Confirmada/);assert.match(csv,/Sem reenvio/);
});
test('a decisão da triagem governa a base; entrega anterior não torna rejeição em confirmação',()=>{
  const item={id:'2',title:'Nomeação de fiscal',baseDecision:'descartado',category:'GERAL',sentAt:'2026-10-20T12:00:00Z'};
  assert.equal(newsRecord(item).decision,'Rejeitada');assert.equal(newsRecord(item).whatsapp,'Enviada antes da revisão');
  assert.equal(newsRecord({...item,sentAt:'',category:'CONTROLE',baseDecision:'confirmado'}).whatsapp,'Só no painel');
  assert.equal(newsRecord({...item,sentAt:'',baseDecision:'revisao'}).whatsapp,'Aguarda triagem');
});
test('CSV preserva aspas, quebra de linha e impede execução de fórmula em títulos',()=>{
  const csv=newsCsv([{title:'=1+1',reason:'Trecho "citado"\ne complemento',baseDecision:'descartado'}]);
  assert.ok(csv.includes('"\'=1+1"'));assert.ok(csv.includes('"Trecho ""citado""\ne complemento"'));
});
