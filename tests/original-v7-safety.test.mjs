import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareV6} from '../scripts/lib/original-v6.mjs';
import {refineV7} from '../scripts/lib/original-v7.mjs';
import {sha} from '../scripts/lib/original-triage-shadow.mjs';
const nd=async n=>(await readFile(`data/catalogo/${n}.ndjson`,'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const archive=await nd('arquivo-coletas'),texts=await nd('textos-artigos');
const report=JSON.parse(await readFile('docs/simulacao-v7-resultado.json','utf8'));
function setup(prefix){const x=report.results.find(x=>x.id.startsWith(prefix));return {x,p:prepareV6(archive.find(a=>a.id===x.id),texts.find(t=>t.documento_id===x.id))};}
test('v7 eleição concluída não vira posse futura ou mudança de estatuto',()=>{
  const {x,p}=setup('dcec74f9'),r=refineV7(p,x.review,x.proposal);
  assert.equal(r.decision,'aceito');assert.equal(r.factType,'eleicao_realizada');assert.match(r.stage,/não significa posse/);
  assert.equal(p.item.rawText.slice(r.evidenceLocation.start,r.evidenceLocation.end),r.evidence);
});
test('v7 eleição exige leitura válida e prova de conclusão, não apenas palavra-chave',()=>{
  const {x,p}=setup('dcec74f9');
  for(const review of [{...x.review,textHash:'stale'},{...x.review,answer:{...x.review.answer,incerto:true}},
    {...x.review,answer:{...x.review.answer,multiplos_atos:true}},
    {...x.review,answer:{...x.review.answer,evidencia:'será reconduzido à presidência'}}])assert.equal(refineV7(p,review,x.proposal).decision,'pendente');
  const body=p.item.rawText.replaceAll('foi reconduzido','não foi reconduzido').replaceAll('foi escolhido por unanimidade','será escolhido');
  const changed={...p,item:{...p.item,rawText:body},textHash:sha(body)};
  assert.equal(refineV7(changed,{...x.review,textHash:changed.textHash},x.proposal).decision,'pendente');
});
test('v7 convênio histórico não prova o chamamento atual, mesmo com categoria igual',()=>{
  const {x,p}=setup('b999516d');assert.equal(x.proposal.decision,'aceito');
  assert.equal(refineV7(p,x.review,x.proposal).reason,'prova_da_ia_nao_sustenta_chamamento_atual');
});
test('v7 fragmento cortado não é descarte temático nem aceite, mesmo se a IA concluir',()=>{
  const {x,p}=setup('f5b8ae64');
  for(const decision of ['aceito','descartado','pendente'])assert.equal(refineV7(p,x.review,{decision}).reason,'texto_curto_sem_fechamento_recuperar_integra');
  const closed={...p,item:{...p.item,rawText:'Este é um texto curto completo, que termina com pontuação.'}};
  assert.deepEqual(refineV7(closed,x.review,{decision:'descartado'}),{decision:'descartado'});
});
test('v7 protocolo com local divergente no título e corpo exige conferência da origem',()=>{
  const {x,p}=setup('74fb6772'),r=refineV7(p,x.review,x.proposal);
  assert.equal(r.decision,'pendente');assert.equal(r.provenanceWarning.titleState,'Santa Catarina');assert.equal(r.provenanceWarning.bodyState,'Paraná');
  const coherent={...p,item:{...p.item,title:p.item.title.replace('Santa Catarina','Paraná')}};
  assert.equal(refineV7(coherent,x.review,x.proposal).decision,'aceito');
});
