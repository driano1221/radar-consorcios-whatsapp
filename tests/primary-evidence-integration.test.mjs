import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createPrimaryEvidenceContext,loadPrimaryEvidenceContext,integratePrimaryEvidence} from '../src/lib/primary-evidence.mjs';
const json=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
const nd=async n=>(await readFile(new URL('../data/catalogo/'+n+'.ndjson',import.meta.url),'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const manifest=await json('data/catalogo/documentos-primarios-2026-10-16.json');
const archive=await nd('arquivo-coletas'),definitions=await nd('atos-identificados'),reviews=await nd('revisoes-eventos');
const pdfBytes=new Map(await Promise.all(manifest.documents.map(async d=>[d.file,await readFile(new URL('../data/documentos-primarios/'+d.file,import.meta.url))])));
const data={archive,definitions,reviews,manifest,pdfBytes},context=createPrimaryEvidenceContext(data);
const previous=(await json('docs/simulacao-v6-replay-resultado.json')).results;
const div=previous.find(x=>x.id.startsWith('da010f90')),tce=previous.find(x=>x.id.startsWith('4ad8ed86'));
test('v7 Divinópolis: duplicata remete ao fato já confirmado, não cria saída/extinção',()=>{
  const r=integratePrimaryEvidence(div,context);assert.equal(r.integrated.decision,'duplicata');
  assert.equal(r.integrated.canonicalFact.decision,'aceito');assert.match(r.integrated.canonicalFact.stage,/sem extinção efetiva/);
  assert.equal(r.integrated.canonicalFact.facts.ano,2026);assert.equal(r.integrated.canonicalFact.evidenceLocation.page,1);
  assert.deepEqual(r.integrated.originalAssessment,div.proposal);assert.equal(r.publicationAllowed,false);
});
test('v7 TCE: três atos com prova própria e preservação da divergência CONSANE',()=>{
  const r=integratePrimaryEvidence(tce,context);assert.equal(r.integrated.decision,'desdobrar');
  const children=r.integrated.children;assert.equal(children.length,3);assert.ok(children.every(x=>x.decision==='aceito'));
  assert.equal(new Set(children.map(x=>x.canonicalId)).size,3);
  const fine=children.find(x=>x.primaryProcess==='1210770');assert.equal(fine.facts.multa_aplicada_reais,10000);
  assert.equal(fine.facts.destinatario_multa,'Frederico Ozanan Rangel');assert.match(fine.stage,/sem resolução de mérito/);
  const c=children.find(x=>x.primaryProcess==='1217968');assert.equal(c.originalProcess,'1217068');
  assert.equal(c.entity,'Consórcio Regional de Saneamento Básico');assert.ok(c.sourceDivergence.criterio);
  assert.match(c.relationship,/editorial_explicito/);assert.ok(children.every(x=>x.evidenceLocation.page===2));
});
test('v7 idempotência e nenhum outro registro alterado pela camada documental',()=>{
  const a=previous.map(x=>integratePrimaryEvidence(x,context)),b=a.map(x=>integratePrimaryEvidence(x,context));
  assert.deepEqual(a,b);assert.equal(a.filter(x=>x.integrated.basis==='approved_primary_document_review').length,2);
  for(const x of a.filter(x=>x.id!==div.id&&x.id!==tce.id))assert.deepEqual(x.integrated,x.proposal);
});
test('v7 documento pai, ID e revisão explícita são obrigatórios, sem fuzzy match',()=>{
  assert.equal(context.resolve('inventado',{}),null);
  const altered={...tce,children:tce.children.map(x=>x.process==='1217068'?{...x,process:'1217069'}:x)};
  assert.equal(integratePrimaryEvidence(altered,context).integrated.decision,'pendente');
  const noLink=structuredClone(manifest);const r=noLink.appliedReviews.find(x=>x.fatos?.numero_na_noticia);delete r.divergencia_fonte;
  const changed=reviews.map(x=>x.documento_id===r.documento_id?r:x),ctx=createPrimaryEvidenceContext({...data,manifest:noLink,reviews:changed});
  assert.equal(integratePrimaryEvidence(tce,ctx).integrated.decision,'pendente');
});
test('v7 PDF adulterado, ausente ou de outra URL bloqueia integração',()=>{
  for(const bytes of [new Map(),new Map([...pdfBytes].map(([k])=>[k,Buffer.from('invalid')]))]){
    const ctx=createPrimaryEvidenceContext({...data,pdfBytes:bytes});assert.equal(integratePrimaryEvidence(div,ctx).integrated.decision,'pendente');}
  const m=structuredClone(manifest);m.documents[0].url='https://example.org/other.pdf';
  assert.equal(integratePrimaryEvidence(div,createPrimaryEvidenceContext({...data,manifest:m})).integrated.decision,'pendente');
});
test('v7 página errada e evidência não literal não passam',()=>{
  for(const edit of [r=>r.documentos_primarios[0].pagina=999,r=>r.documentos_primarios[0].trecho='trecho inventado',r=>r.evidencia='fato inventado com mais de vinte e cinco caracteres']){
    const m=structuredClone(manifest),r=m.appliedReviews.find(x=>x.documento_id===div.id);edit(r);
    const ctx=createPrimaryEvidenceContext({...data,manifest:m,reviews:reviews.map(x=>x.documento_id===r.documento_id?r:x)});
    assert.equal(integratePrimaryEvidence(div,ctx).integrated.decision,'pendente');
  }
});
test('v7 revisão modificada, lacre antigo e remoção do bloqueio de envio não passam',()=>{
  const changed=reviews.map(x=>x.documento_id===div.id?{...x,motivo:'alterado'}:x);
  assert.equal(integratePrimaryEvidence(div,createPrimaryEvidenceContext({...data,reviews:changed})).integrated.decision,'pendente');
  const alteredArchive=archive.map(x=>x.id===div.id?{...x,trecho:x.trecho+' alterado'}:x);
  assert.equal(integratePrimaryEvidence(div,createPrimaryEvidenceContext({...data,archive:alteredArchive})).integrated.decision,'pendente');
  const m=structuredClone(manifest),r=m.appliedReviews.find(x=>x.documento_id===div.id);r.publicar=true;
  assert.equal(integratePrimaryEvidence(div,createPrimaryEvidenceContext({...data,manifest:m,reviews:reviews.map(x=>x.documento_id===r.documento_id?r:x)})).integrated.decision,'pendente');
});
test('v7 loader real confere bytes dos cinco PDFs e referências, sem chamar rede',async()=>{
  const ctx=await loadPrimaryEvidenceContext();assert.deepEqual(integratePrimaryEvidence(tce,ctx),integratePrimaryEvidence(tce,context));
  for(const r of manifest.appliedReviews)assert.ok(!ctx.validate(r.documento_id).error);
});
