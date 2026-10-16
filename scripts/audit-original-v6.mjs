import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {literal} from './lib/original-triage-shadow.mjs';
import {protectedSnapshot} from './pilot-retroactive-ten.mjs';
const before=await protectedSnapshot();
const report=JSON.parse(await readFile(process.argv[2]||'output/original-v6-ci/report.json','utf8'));
const reference=JSON.parse(await readFile('docs/simulacao-v6-referencia-previa.json','utf8'));
const texts=(await readFile('data/catalogo/textos-artigos.ndjson','utf8')).trim().split(/\r?\n/).map(JSON.parse);
assert.ok(['--ai','--frozen'].includes(report.mode));assert.equal(report.productionActivated,false);
assert.equal(report.whatsappCalls,0);assert.equal(report.protectedFilesUnchanged,true);
let locations=0,decided=0;
for(const row of report.results){const body=texts.find(x=>x.documento_id===row.id).texto;
  for(const e of row.children.length?row.children:[row]){
    const source=row.children.length?body.slice(e.start,e.end):body,p=e.proposal;
    if(['aceito','descartado'].includes(p.decision)){assert.ok(literal(source,p.evidence),row.id);decided++;}
    for(const l of [p.evidenceLocation,...(p.supportEvidence||[])].filter(Boolean)){
      assert.equal(source.slice(l.start,l.end),l.text);locations++;
    }
  }
}
const fresh=report.results.filter(x=>x.group==='additional').map(row=>{
  const expected=reference.cases.find(r=>row.id.startsWith(r.prefix));assert.ok(expected);
  assert.ok(literal(texts.find(x=>x.documento_id===row.id).texto,expected.quote));
  return {...row,expected,decisionMatches:row.proposal.decision===expected.decision};
});
const result={...report,initialReadingRun:'https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38978672314',
  referenceAuthor:reference.reviewer,referenceCaveat:reference.caveat,verifiedLocations:locations,decidedWithLiteralEvidence:decided,
  additional:{...report.additional,matches:fresh.filter(x=>x.decisionMatches).length,
    falseRejections:fresh.filter(x=>x.expected.decision==='aceito'&&x.proposal.decision==='descartado').length,
    falseAcceptances:fresh.filter(x=>x.expected.decision==='descartado'&&x.proposal.decision==='aceito').length},
  results:report.results.map(row=>fresh.find(x=>x.id===row.id)||row)};
await writeFile(report.mode==='--ai'?'docs/simulacao-v6-resultado.json':'docs/simulacao-v6-replay-resultado.json',JSON.stringify(result,null,2)+'\n');
assert.deepEqual(await protectedSnapshot(),before);
console.log(JSON.stringify({...result,results:undefined},null,2));
for(const row of result.results.filter(x=>x.group==='additional'||x.before?.decision!==x.proposal.decision))
  console.log(JSON.stringify({id:row.id.slice(0,8),title:row.title,expected:row.expected?.decision,before:row.before,
    proposal:row.proposal,answer:row.review?.answer,children:row.children.map(c=>({process:c.process,proposal:c.proposal}))}));
