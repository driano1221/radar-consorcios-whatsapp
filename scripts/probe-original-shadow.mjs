// A bounded supplementary experiment after an explicit user policy decision.
// One case only, no production cache/writer/sender. No retry-until-agreement.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {prepareOriginal,reviewOriginal,decideOriginal,VERSION} from './lib/original-triage-shadow.mjs';
import {protectedSnapshot} from './pilot-retroactive-ten.mjs';
const prefix=process.argv[2];
if(!/^[a-f0-9]{8}$/.test(prefix||'')||process.argv.length!==3)throw new Error('One eight-character document ID required; no apply mode.');
const before=await protectedSnapshot();
const rows=async name=>(await readFile(`data/catalogo/${name}.ndjson`,'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const matches=(await rows('arquivo-coletas')).filter(x=>x.id.startsWith(prefix));
if(matches.length!==1)throw new Error('Unknown/ambiguous ID');
const row=matches[0], stored=(await rows('textos-artigos')).find(x=>x.documento_id===row.id);
const p=prepareOriginal(row,stored);
const ai=await reviewOriginal(p,{apiKey:process.env.DEEPSEEK_API_KEY});
const proposal=decideOriginal(p,ai);
if(JSON.stringify(before)!==JSON.stringify(await protectedSnapshot()))throw new Error('Protected files changed');
const result={version:VERSION,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  id:row.id,title:row.titulo,url:p.item.articleUrl,inputHash:p.inputHash,textHash:p.textHash,
  rule:p.rule,ai,proposal,protectedFilesUnchanged:true,whatsappCalls:0,productionActivated:false};
await mkdir('output/original-shadow-probe',{recursive:true});
await writeFile(`output/original-shadow-probe/${prefix}.json`,JSON.stringify(result,null,2));
console.log(JSON.stringify({id:row.id,proposal,protectedFilesUnchanged:true,productionActivated:false},null,2));
