import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fetchWebScrapers} from '../src/lib/sources/web-scrapers.mjs';
import {loadState,saveState} from '../src/lib/dedupe.mjs';
import {commitGazetteCursors} from './commit-gazette-cursors.mjs';

for(const key of ['SEND_ENABLED','PERSIST_STATE','AI_REVIEW_ENABLED','AI_PREVIEW'])assert.notEqual(process.env[key],'true');
const config=JSON.parse(await readFile('config/default.json','utf8'));
const state=JSON.parse(await readFile('state/news-state.json','utf8'));
const before=JSON.stringify(state);
const sites=config.webScrapers.sites.filter(s=>s.resumePagination);
assert.deepEqual(sites.map(s=>s.stateCode).sort(),['MG','PE']);
const since=new Date(Date.now()-config.lookbackHours*3600000);
const report={startedAt:new Date().toISOString(),rounds:[],whatsappSends:0,aiCalls:0,stateUntouched:false};
const directory=await mkdtemp(path.join(tmpdir(),'sigpub-pagination-'));
try{
  let context=state;
  const fixture=path.join(directory,'state.json');
  await saveState(fixture,{version:4,seen:{},pending:{},gazetteCursors:state.gazetteCursors});
  for(let round=1;round<=2;round++){
    const result=await fetchWebScrapers({...config.webScrapers,sites,gazetteState:context},since);
    report.rounds.push({round,sources:result.diagnostics,nextPages:Object.fromEntries(
      sites.map(s=>[s.stateCode,result.gazetteCursors[s.url]?.nextPage]))});
    for(const site of sites){
      const diagnostic=result.diagnostics.find(d=>d.name===site.name);
      const old=context.gazetteCursors?.[site.url];
      const next=result.gazetteCursors[site.url];
      assert.ok(next,`${site.stateCode}: marcador não retornado`);
      assert.ok(diagnostic.fullTextCount>0,`${site.stateCode}: nenhuma íntegra real`);
      assert.equal(diagnostic.partialTextCount,0,`${site.stateCode}: leitura da amostra incompleta`);
      assert.ok(['ok','degraded'].includes(diagnostic.status));
      assert.ok(diagnostic.status==='ok'||diagnostic.limited,`${site.stateCode}: falha real além da paginação`);
      if(old&&!old.complete){
        assert.ok(diagnostic.resumePages.length>0,`${site.stateCode}: nenhuma página retomada`);
        assert.equal(diagnostic.resumePages[0],old.nextPage);
        assert.ok(next.nextPage>old.nextPage||next.complete,`${site.stateCode}: marcador não avançou`);
      }
    }
    // Reopen only the public checkpoints, simulating another Actions runner without touching production.
    await writeFile(path.join(directory,'gazette-cursors.json'),JSON.stringify(result.gazetteCursors));
    await commitGazetteCursors({persistState:true,stateFile:fixture,outputDir:directory,webScrapers:{sites}});
    context=await loadState(fixture);
    console.log(JSON.stringify(report.rounds.at(-1)));
  }
}catch(error){report.error=error.message;process.exitCode=1;}
finally{
  report.stateUntouched=JSON.stringify(state)===before&&
    JSON.stringify(JSON.parse(await readFile('state/news-state.json','utf8')))===before;
  assert.equal(report.stateUntouched,true,'Marcador de produção foi alterado pela validação');
  report.completedAt=new Date().toISOString();
  await mkdir('output/gazette-pagination',{recursive:true});
  await writeFile('output/gazette-pagination/report.json',JSON.stringify(report,null,2)+'\n');
  assert.equal(path.dirname(directory),tmpdir());
  await rm(directory,{recursive:true,force:true});
  console.log(JSON.stringify({stateUntouched:report.stateUntouched,whatsappSends:0,aiCalls:0,error:report.error||null}));
}
