import test from'node:test';
import assert from'node:assert/strict';
import{mkdtemp,mkdir,writeFile,rm}from'node:fs/promises';
import{createHash}from'node:crypto';
import os from'node:os';
import path from'node:path';
import{approvedWeeklyMessages,loadApprovedWeekly}from'../src/lib/approved-weekly.mjs';
import{sendMessages}from'../src/lib/whatsapp.mjs';

test('edição aprovada mantém texto fixo e recusa prova, decisão ou arquivo divergentes',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'radar-approved-weekly-'));
 try{
  await mkdir(path.join(root,'data/weekly-approved'),{recursive:true});
  const item={id:'a'.repeat(64),category:'PROTOCOLO',bodyHash:'b'.repeat(64),date:'2026-10-27T15:00:00Z',url:'https://exemplo.gov.br/lei',label:'Município ratifica protocolo; ingresso não comprovado'};
  const edition={version:1,start:'2026-10-24T12:00:00Z',end:'2026-10-31T12:00:00Z',items:[item]};
  const messages=approvedWeeklyMessages(edition.items,edition.start,edition.end);
  edition.messagesSha256=createHash('sha256').update(JSON.stringify(messages)).digest('hex');
  const file='data/weekly-approved/2026-10-31.json',save=()=>writeFile(path.join(root,file),JSON.stringify(edition));await save();
  const eligible=[{url:item.url,weeklyDate:item.date,weeklyEvidence:{documentId:item.id},triage:{status:'confirmado',category:item.category,bodyHash:item.bodyHash}}];
  assert.deepEqual((await loadApprovedWeekly(root,file,eligible)).messages,messages);
  await assert.rejects(loadApprovedWeekly(root,'../state/news-state.json',eligible),/inválido/);
  await assert.rejects(loadApprovedWeekly(root,file,[]),/mudou/);
  await assert.rejects(loadApprovedWeekly(root,file,[{...eligible[0],triage:{...eligible[0].triage,bodyHash:'c'.repeat(64)}}]),/mudou/);
  edition.items[0].label+=' Texto alterado.';await save();
  await assert.rejects(loadApprovedWeekly(root,file,eligible),/hash/);
 }finally{await rm(root,{recursive:true,force:true});}
});

test('destino divergente impede transmissão; destino correto preserva ID e recibo',async()=>{
 const sent=[],receipts=[];let closed=0;
 const socket={groupMetadata:async()=>({subject:'Radar Consórcios - Teste'}),sendMessage:async(...args)=>sent.push(args),end:()=>closed++};
 const options={groupId:'123456789@g.us',authDir:'unused',messages:[{text:'Resumo aprovado',messageId:'FIXED-APPROVED-ID'}],delayMs:0,connectImpl:async()=>socket,onSent:async m=>receipts.push(m.messageId)};
 await assert.rejects(sendMessages({...options,expectedGroupName:'Outro grupo'}),/nenhuma mensagem/);
 assert.equal(sent.length,0);assert.equal(receipts.length,0);assert.equal(closed,1);
 await sendMessages({...options,expectedGroupName:'Radar Consórcios - Teste'});
 assert.equal(sent.length,1);assert.equal(sent[0][2].messageId,'FIXED-APPROVED-ID');
 assert.deepEqual(receipts,['FIXED-APPROVED-ID']);assert.equal(closed,2);
});
