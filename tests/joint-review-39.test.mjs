import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {prepareJointReview} from '../scripts/apply-joint-review-39.mjs';
import {classifyItem} from '../src/lib/classifier.mjs';
import {refineEventProof} from '../src/lib/event-proof.mjs';
import {decideSimpleTriage} from '../src/lib/simple-triage.mjs';
import {loadEditorialGuard,applyEditorialGuard} from '../src/lib/editorial-guard.mjs';
import {isNotifiable} from '../src/lib/publication-gate.mjs';
import {prepareWeeklyState} from '../src/lib/weekly-selection.mjs';
import {buildWeeklyReport} from '../src/lib/history.mjs';
const dir=fileURLToPath(new URL('../data/catalogo/',import.meta.url));
const read=async name=>(await readFile(`${dir}/${name}.ndjson`,'utf8')).trim().split(/\r?\n/).map(JSON.parse);

test('revisão dos 39 tem fontes lacradas, numeração estável, um caso inconclusivo e duplicatas com principal',async()=>{
  const batch=await prepareJointReview(dir);
  assert.equal(batch.alreadyApplied,true);
  assert.equal(batch.resolved.length,38);
  assert.deepEqual(batch.manifest.cases.filter(c=>c.review.decisao==='pendente').map(c=>c.case),[31]);
  assert.deepEqual(batch.manifest.cases.filter(c=>c.review.decisao==='duplicata').map(c=>c.case),[16,29,36,39]);
  const r=n=>batch.manifest.cases[n-1].review;
  assert.equal(r(34).fatos.ano,2010); assert.equal(r(34).data_fato,'2010-05-11');
  assert.match(r(8).etapa,/autógrafo.*sanção.*não comprovadas/);
  assert.equal(r(33).fatos.sigla,'CIMINAS'); assert.match(r(33).motivo,/CIMARG.*somente contexto/);
  assert.ok(r(29).evidencias_relacionadas[0].trecho.includes('a Assembleia APROVOU a atualização do referido Anexo I'));
  assert.equal(r(37).fatos.uf,'SP'); assert.equal(r(37).decisao,'nao_evento');
  assert.equal(batch.addedText.paginas_documento,9); assert.deepEqual(batch.addedText.paginas_lidas,[5,6]);
});

test('as 39 revisões não liberam acervo no alerta nem no boletim, inclusive aliases e futuras recoletas',async()=>{
  const [{manifest},guard,archive]=await Promise.all([prepareJointReview(dir),loadEditorialGuard(dir),read('arquivo-coletas')]);
  const byId=new Map(archive.map(r=>[r.id,r]));
  const observations={};
  for(const c of manifest.cases) {
    const row=byId.get(c.id);
    for(const url of c.review.urls_documento) {
      const item=applyEditorialGuard({title:row.titulo,url,publishedAt:'2026-10-21T12:00:00Z',classification:{category:'RATEIO',score:99}},guard);
      assert.equal(isNotifiable(item),false,`caso ${c.case}: ${url}`);
    }
    observations[c.id]={firstSeenAt:'2026-10-21T12:00:00Z',lastSeenAt:'2026-10-21T12:00:00Z',item:{
      title:row.titulo,url:row.url,publishedAt:'2026-10-21T12:00:00Z',classification:{category:'RATEIO',score:99}}};
  }
  const state={seen:{},observations},window={start:new Date('2010-01-01T00:00:00Z'),end:new Date('2027-01-01T00:00:00Z')};
  const prepared=await prepareWeeklyState(state,dir,window);
  const report=buildWeeklyReport(prepared,window);
  const urls=new Set(manifest.cases.flatMap(c=>c.review.urls_documento));
  assert.ok(report.highlights.every(i=>!urls.has(i.url)));
  for(const c of manifest.cases.filter(c=>c.review.decisao==='confirmar_evento')) {
    const item=Object.values(prepared.observations).find(o=>o.item?.url===byId.get(c.id).url)?.item;
    assert.ok(item,`caso ${c.case} preservado na projeção`); assert.equal(item.weeklyDecision,'excluir');
  }
});

test('regras aprendidas distinguem LDO, cronograma, ratificação e conselho interno em texto real',async()=>{
  const {manifest,archive,texts}=await prepareJointReview(dir);
  for(const [n,category] of [[4,'PROTOCOLO'],[5,'GERAL'],[7,'GERAL'],[11,'GOVERNANÇA'],[13,'GERAL'],[25,'GERAL'],[28,'GERAL']]) {
    const c=manifest.cases[n-1],r=archive.find(r=>r.id===c.id),rawText=texts.find(t=>t.documento_id===c.id).texto;
    const item={kind:'gazette',title:r.titulo,url:r.url,rawText};
    const classification=classifyItem(item); assert.equal(classification.category,category,`caso ${n}`);
    const triage=decideSimpleTriage({...item,classification});
    // Long records still require a bounded review; they must not become a
    // positive event from a generic budget/reference mention.
    assert.equal(triage.status,category==='GERAL'?'descartado':'confirmado',`caso ${n}`);
  }
});

test('ratificação não nasce de considerando, título, negação ou rascunho e não vira ingresso',()=>{
  const base={category:'GERAL',score:0,reasons:[]};
  for(const rawText of ['Considerando que fica ratificado o protocolo de intenções do Consórcio, resolve convocar reunião.',
    'O projeto propõe ratificar o protocolo de intenções do Consórcio.',
    'A lei não ratificou o protocolo de intenções do Consórcio.']) {
    assert.notEqual(refineEventProof({title:'Nota informativa',rawText},base).proofKind,'ratified_protocol');
  }
  const rawText='O prefeito sanciona a seguinte lei. Art. 1º Fica ratificado, em todos os seus termos, o protocolo de intenções do Consórcio Nacional para gestão regional. Art. 2º Autoriza créditos para o rateio futuro.';
  const result=refineEventProof({title:'Lei nº 99/2026',rawText},base);
  assert.equal(result.category,'PROTOCOLO'); assert.match(result.stage,/ingresso.*não comprovados/);
  assert.notEqual(refineEventProof({title:'Lei nº 99/2026',summary:rawText},base).proofKind,'ratified_protocol');
  assert.notEqual(refineEventProof({title:'Lei nº 99/2026',rawText:'O prefeito sanciona a lei. Considerando que fica ratificado o protocolo de intenções do Consórcio. Art. 1º Fica convocada a reunião.'},base).proofKind,'ratified_protocol');
});

test('norma extensa com fundamento em protocolo não exige revisão por tamanho ou IA antiga divergente',async()=>{
  const {manifest,texts,archive}=await prepareJointReview(dir);
  const c=manifest.cases[18],row=archive.find(r=>r.id===c.id),body=texts.find(t=>t.documento_id===c.id).texto;
  const item={kind:'gazette',title:row.titulo,rawText:body};const classification=classifyItem(item);
  assert.equal(classification.category,'ATUAÇÃO');
  const d=decideSimpleTriage({...item,ruleClassification:classification,classification,aiReview:{status:'disputed',promptVersion:0}});
  assert.equal(d.status,'confirmado');assert.match(d.stage,/norma.*não comprova fiscalização/);
  assert.equal(decideSimpleTriage({...item,rawText:'Texto incompleto',classification}).status,'processando');
});
