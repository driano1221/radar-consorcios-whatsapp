import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {prepareBatch,applyBatch} from '../scripts/review-historical-188.mjs';
import {urls,BATCH} from '../scripts/historical-188-definitions.mjs';
import {administrativeRoutine} from '../src/lib/administrative-routine.mjs';
import {classifyItem} from '../src/lib/classifier.mjs';
import {loadEditorialGuard,applyEditorialGuard} from '../src/lib/editorial-guard.mjs';
import {decidePublication,isNotifiable} from '../src/lib/publication-gate.mjs';
import {buildWeeklyReport} from '../src/lib/history.mjs';

test('188 URLs existentes recebem decisões com prova literal e sem inventar ingresso',async()=>{
  const batch=await prepareBatch();assert.equal(batch.decisions.length,188);
  assert.equal(batch.decisions.filter(d=>d.review.decisao==='confirmar_evento').length,16);
  assert.equal(batch.decisions.filter(d=>d.review.decisao==='duplicata').length,1);
  for(const {row,t,review:r}of batch.decisions){
    assert.equal(r.publicar,false);assert.ok(t.texto.includes(r.evidencia));assert.ok(r.trecho_sha256);
    for(const quote of r.evidencias_adicionais)assert.ok(t.texto.includes(quote));
    assert.equal(r.texto_evidencia_sha256,t.texto_sha256);assert.equal(r.lote_retroativo,BATCH);
    if(r.fatos.ano_ingresso)assert.equal(row.url,urls[91]);
  }
  const byN=new Map(batch.decisions.map(d=>[d.n,d.review]));
  assert.equal(byN.get(139).documento_relacionado,byN.get(154).documento_id);
  assert.equal(byN.get(140).categoria,'RATEIO');assert.equal(byN.get(173).categoria,'PROTOCOLO');
  assert.equal(byN.get(181).fatos.valor_pago_declarado_brl,5592.76);
  assert.equal(byN.get(185).fatos.atendimentos_relatados,519);
  assert.equal(byN.get(91).fatos.instrumentos.length,3);
  assert.equal(byN.get(91).fatos.instrumentos[2].valor_fonte,'-1.243.572,37');
});
test('simulação não altera arquivo, textos, revisões ou estado; aplicação já feita é idempotente',async()=>{
  const result=await applyBatch();assert.equal(result.total,188);assert.equal(result.whatsappCalls,0);
  assert.equal(result.documentsAdded,0);assert.equal(result.protectedStateUnchanged,true);
});
test('pessoal e suspensões internas não viram governança ou fiscalização externa',()=>{
  const common={kind:'gazette'};
  const cases=[{title:'ATO ADMINISTRATIVO Nº 84/2026',rawText:'Consórcio Público Intermunicipal CIDES. EXONERA DO CARGO DE GERENTE DE SERVIÇOS AMBIENTAIS a pessoa que menciona.'},
    {title:'Resolução 187/2026',rawText:'Consórcio Intermunicipal de Saúde. RESOLVE CONCEDER LICENÇA PARA TRATAMENTO DE SAÚDE à funcionária.'},
    {title:'Portaria 017/2026',rawText:'Consórcio Intermunicipal CIMOP DESIGNA SERVIDORES PARA EXERCEREM AS FUNÇÕES DE GESTOR E FISCAL DO CONTRATO.'},
    {title:'AVISO DE SUSPENSÃO',rawText:'O Consórcio Intermunicipal de Mobilidade Urbana suspende o chamamento público para realização de ajustes no instrumento convocatório.'}];
  for(const c of cases)assert.equal(classifyItem({...common,...c}).category,'GERAL');
  for(const c of [{title:'Portaria 3',rawText:'Consórcio Intermunicipal. Nomeia para o cargo de Presidente a pessoa eleita.'},
    {title:'AVISO DE SUSPENSÃO',rawText:'Consórcio Intermunicipal suspende licitação para ajustes no instrumento convocatório por decisão do TCE-SP.'},
    {title:'Lei 69/2026',rawText:'Consórcio Intermunicipal altera contrato de consórcio público e cria cargo de gerente.'},
    {title:'Notícia',rawText:'Consórcio Intermunicipal exonera gerente e homologa ingresso municipal.'}])assert.equal(administrativeRoutine(c),null);
});
test('os dois leitores reais de aviso de suspensão e o CIDES ficam protegidos',async()=>{
  const b=await prepareBatch();
  for(const n of [8,54,130]){
    const d=b.decisions[n-1];const c=classifyItem({title:d.row.titulo,rawText:d.t.texto,kind:'gazette'});
    assert.equal(c.category,'GERAL');assert.ok(c.reasons.some(r=>/rotineiro|administrativa/.test(r)));
  }
});
test('os 188 históricos seguem bloqueados no alerta e no resumo mesmo com data atual',async()=>{
  const b=await prepareBatch();assert.equal(b.alreadyApplied,true,'A aplicação deve estar concluída antes de publicar');
  const guard=await loadEditorialGuard('data/catalogo'),observations={};
  for(const {row,review}of b.decisions){
    const item=decidePublication(applyEditorialGuard({url:row.url,title:review.titulo,
      publishedAt:'2026-10-20T14:00:00Z',classification:{category:'ATUAÇÃO',score:12,reasons:[]}},guard),
      {now:new Date('2026-10-20T16:00:00Z')});
    assert.equal(isNotifiable(item),false,row.url);
    observations[row.id]={item,firstSeenAt:'2026-10-20T14:00:00Z',lastSeenAt:'2026-10-20T14:00:00Z'};
  }
  const summary=buildWeeklyReport({seen:{},pending:{},observations},
    {start:new Date('2026-10-19'),end:new Date('2026-10-22')});
  assert.equal(summary.events,0);assert.equal(summary.highlights.length,0);
});
