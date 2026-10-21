// Read only the exact CIGA production entry point; never import a sender or a model.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {fetchWebScrapers} from '../src/lib/sources/web-scrapers.mjs';

assert.notEqual(process.env.SEND_ENABLED,'true');
assert.notEqual(process.env.PERSIST_STATE,'true');
assert.notEqual(process.env.AI_REVIEW_ENABLED,'true');
const config=JSON.parse(await readFile('config/default.json','utf8'));
const site=config.webScrapers.sites.find(source=>source.adapter==='ciga-open-data');
assert.ok(site,'Fonte CIGA ausente');
const started=Date.now();
const report={startedAt:new Date().toISOString(),generalTimeoutMs:config.webScrapers.timeoutMs,
  sourceTimeoutMs:site.timeoutMs,requests:[],whatsappSends:0,aiCalls:0};
const observedFetch=async(url,options)=>{
  const attempt={stage:String(url).includes('/api/')?'catalog':'zip',url:String(url),startedAt:new Date().toISOString()};
  report.requests.push(attempt);
  const at=Date.now();
  try{
    const response=await fetch(url,options);
    attempt.status=response.status;attempt.headersMs=Date.now()-at;
    return response;
  }catch(error){
    attempt.failedAfterMs=Date.now()-at;attempt.error=error.name;
    throw error;
  }
};
try{
  const result=await fetchWebScrapers({...config.webScrapers,sites:[site]},
    new Date(Date.now()-config.lookbackHours*3600000),observedFetch);
  report.sources=result.diagnostics;
  report.items=result.items.length;
  report.fullTexts=result.items.filter(item=>item.contentProvenance==='pagina_original').length;
  assert.equal(result.diagnostics[0]?.status,'ok','CIGA: leitura real incompleta; consultar diagnóstico do relatório');
  assert.equal(result.diagnostics[0]?.timeoutMs,site.timeoutMs);
  assert.ok(report.fullTexts>0,'CIGA: nenhum texto real recuperado');
  report.functional=true;
}catch(error){report.functional=false;report.error=error.message;process.exitCode=1;}
finally{
  report.completedAt=new Date().toISOString();report.durationMs=Date.now()-started;
  await mkdir('output/ciga-timeout',{recursive:true});
  await writeFile('output/ciga-timeout/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
