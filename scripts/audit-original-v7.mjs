import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {literal} from './lib/original-triage-shadow.mjs';
import {protectedSnapshot} from './pilot-retroactive-ten.mjs';
const before=await protectedSnapshot();
const report=JSON.parse(await readFile(process.argv[2]||'output/original-v7-ci/report.json','utf8'));
const ref=JSON.parse(await readFile('docs/simulacao-v7-referencia-previa.json','utf8'));
const texts=(await readFile('data/catalogo/textos-artigos.ndjson','utf8')).trim().split(/\r?\n/).map(JSON.parse);
const manifest=JSON.parse(await readFile('data/catalogo/documentos-primarios-2026-10-16.json','utf8'));
assert.equal(report.productionActivated,false);assert.equal(report.whatsappCalls,0);assert.equal(report.protectedFilesUnchanged,true);
let literalDecisions=0,pdfProofs=0;
function validatePdf(f){
  assert.equal(f.publicationAllowed,false);
  for(const p of f.primaryEvidence||[]){const d=manifest.documents.find(d=>d.sha256===p.pdf_sha256);assert.ok(d);assert.equal(d.url,p.url);
    assert.equal(d.pages[p.pagina-1].slice(p.start,p.end),p.trecho);pdfProofs++;}
  if(f.evidenceLocation?.sourceKind==='primary_pdf'){
    const l=f.evidenceLocation,d=manifest.documents.find(d=>d.sha256===l.pdfHash);assert.equal(d.pages[l.page-1].slice(l.start,l.end),f.evidence);
  }
  for(const c of f.children||[])validatePdf(c);if(f.canonicalFact)validatePdf(f.canonicalFact);
}
for(const row of report.results){
  const body=texts.find(x=>x.documento_id===row.id).texto;assert.equal(row.publicationAllowed,false);
  for(const entry of row.children.length?row.children:[row])if(['aceito','descartado'].includes(entry.proposal.decision)){
    assert.ok(literal(row.children.length?body.slice(entry.start,entry.end):body,entry.proposal.evidence));literalDecisions++;}
  if(row.integrated.basis==='approved_primary_document_review')validatePdf(row.integrated);
  else if(['aceito','descartado'].includes(row.integrated.decision))assert.ok(literal(body,row.integrated.evidence));
}
const fresh=report.results.filter(x=>x.group==='additional').map(row=>{
  const expected=ref.cases.find(x=>row.id.startsWith(x.prefix));assert.ok(expected);
  assert.ok(literal(texts.find(x=>x.documento_id===row.id).texto,expected.quote));
  return {...row,expected,decisionMatches:row.integrated.decision===expected.decision};
});
const result={...report,reference:ref.caveat,pdfProofs,literalDecisions,
  additional:{...report.additional,matches:fresh.filter(x=>x.decisionMatches).length,
    falseAcceptances:fresh.filter(x=>x.expected.decision==='descartado'&&x.integrated.decision==='aceito').length,
    falseRejections:fresh.filter(x=>x.expected.decision==='aceito'&&x.integrated.decision==='descartado').length,
    incompleteConcluded:fresh.filter(x=>x.expected.decision==='pendente'&&x.integrated.decision!=='pendente').length},
  results:report.results.map(x=>fresh.find(y=>y.id===x.id)||x)};
await writeFile(report.mode==='--ai'?'docs/simulacao-v7-resultado.json':'docs/simulacao-v7-replay-resultado.json',JSON.stringify(result,null,2)+'\n');
assert.deepEqual(await protectedSnapshot(),before);
console.log(JSON.stringify({...result,results:undefined,canonicalPrimaryFacts:undefined},null,2));
for(const r of fresh)console.log(JSON.stringify({id:r.id.slice(0,8),title:r.title,expected:r.expected.decision,proposal:r.proposal,integrated:r.integrated.decision,answer:r.review.answer}));
