// Evaluate the first unseen-text run against the reference committed BEFORE
// the model call. Never reads references from the prediction workflow.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {protectedSnapshot} from './pilot-retroactive-ten.mjs';
import {literal} from './lib/original-triage-shadow.mjs';
const before=await protectedSnapshot();
const report=JSON.parse(await readFile(process.argv[2]||'output/original-v4-ci/report.json','utf8'));
const reference=JSON.parse(await readFile('docs/simulacao-v4-referencia-cega.json','utf8'));
const texts=(await readFile('data/catalogo/textos-artigos.ndjson','utf8')).trim().split(/\r?\n/).map(JSON.parse);
assert.equal(report.productionActivated,false);assert.equal(report.whatsappCalls,0);
assert.equal(report.protectedFilesUnchanged,true);
const comparison=report.fresh.results.map(r=>{
  const refs=reference.cases.filter(x=>r.id.startsWith(x.prefix));assert.equal(refs.length,1);
  const expected=refs[0],text=texts.find(x=>x.documento_id===r.id);
  assert.equal(text.texto_sha256,r.textHash);
  assert.ok(literal(text.texto,expected.quote),`Reference quote must exist: ${r.id}`);
  return {...r,expected,decisionMatches:expected.decision===r.proposal.decision};
});
assert.equal(comparison.length,12);
const result={run:'https://github.com/driano1221/radar-consorcios-whatsapp/actions/runs/38975839429',
  commit:report.commit,generatedAt:report.generatedAt,reviewer:reference.reviewer,
  caveat:'Amostra exploratória pequena, não aleatória representativa; decisão concordante não valida automaticamente motivo, prova, identidade ou novidade.',
  productionActivated:false,whatsappCalls:0,protectedFilesUnchanged:true,
  historical:{...report.historical,results:undefined},documentary:report.documentary,
  fresh:{total:12,decisions:report.fresh.decisions,decisionMatches:comparison.filter(x=>x.decisionMatches).length,
    falseRejections:comparison.filter(x=>x.expected.decision==='aceito'&&x.proposal.decision==='descartado').length,
    unexpectedAbstentions:comparison.filter(x=>x.expected.decision!=='pendente'&&x.proposal.decision==='pendente').length,
    apiErrors:report.fresh.errors,calls:report.fresh.calls,usage:report.fresh.usage,results:comparison},
  defects:[
    'ABC Agora: descartou cerimônia futura e perdeu a capacitação já concluída; concordância regra/IA não impediu falso negativo.',
    'CIS-VERDE: decisão de descarte plausível, mas IA alterou o artigo inicial de o para O no trecho; prova literal falhou. Não relaxar a prova sem preservar localização exata.',
    'TCE-MG: retenção segura por ausência de etapa na regra, mas IA marcou multiplos_atos=false e misturou dois processos. Não contar como segmentação correta.',
    'CONSUD: IA tentou aceitar ficha sem resultado; exclusão determinística impediu falso positivo.',
    'CISGA: conteúdo válido já tem episódio canônico no acervo; relevância não é novidade.'
  ]};
await writeFile('docs/simulacao-v4-resultado.json',JSON.stringify(result,null,2)+'\n');
assert.deepEqual(await protectedSnapshot(),before);
console.log(JSON.stringify({...result,fresh:{...result.fresh,results:undefined}},null,2));
