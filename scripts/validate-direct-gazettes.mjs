import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fetchWebScrapers, parseRncp } from '../src/lib/sources/web-scrapers.mjs';
import { classifyItem } from '../src/lib/classifier.mjs';
import { decidePublication, isNotifiable } from '../src/lib/publication-gate.mjs';
import { canonicalUrl, selectUnseen } from '../src/lib/dedupe.mjs';
import { redactPublicText } from '../src/lib/article-text-store.mjs';

assert.notEqual(process.env.SEND_ENABLED,'true');
assert.notEqual(process.env.PERSIST_STATE,'true');
const config=JSON.parse(await readFile('config/default.json','utf8'));
const state=JSON.parse(await readFile('state/news-state.json','utf8'));
const protectedState=JSON.stringify(state);
const archive=(await readFile('data/catalogo/arquivo-coletas.ndjson','utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const known=new Set(archive.flatMap(r=>[r.url,r.article_url]).filter(Boolean).map(canonicalUrl));
const sites=config.webScrapers.sites.filter(s=>s.adapter==='sigpub'||s.adapter==='rncp');
const since=new Date(Date.now()-168*3600000);
const report={at:new Date().toISOString(),since:since.toISOString(),sources:[],samples:[],stateUntouched:false,whatsappSends:0};
const all=[];
try {
  // Run the exact production limits/readers on the four independent diary portals.
  const diaries=await fetchWebScrapers({...config.webScrapers,sites:sites.filter(s=>s.adapter==='sigpub')},since);
  report.sources.push(...diaries.diagnostics); all.push(...diaries.items);
  report.readingGaps=diaries.items.filter(i=>i.extractionError&&!/adiada/.test(i.extractionError))
    .map(i=>({source:i.source,title:i.title,url:i.url,error:i.extractionError}));
  for(const site of sites.filter(s=>s.adapter==='sigpub')) {
    const rows=diaries.items.filter(i=>i.source===site.name);
    assert.ok(rows.some(i=>i.contentProvenance==='pagina_original'),`${site.name}: nenhuma íntegra real`);
    assert.equal(rows.filter(i=>i.extractionError&&!/adiada/.test(i.extractionError)).length,0,
      `${site.name}: erro de leitura real: ${JSON.stringify(report.readingGaps.filter(i=>i.source===site.name))}`);
  }
  const rncp=sites.find(s=>s.adapter==='rncp');
  const response=await fetch(rncp.url,{signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200,'RNCP: índice público bloqueado');
  const html=await response.text();
  const historical=parseRncp(html,rncp,new Date('2000-01-01'));
  assert.ok(historical.length>0,'RNCP: lista histórica vazia');
  const current=parseRncp(html,rncp,since);
  // Latest articles are older than the normal lookback. Test the real reader on
  // a historical sample without importing it or releasing it for notifications.
  const sampleSince=new Date(new Date(historical[0].publishedAt).getTime()-90*86400000);
  const rncpRead=await fetchWebScrapers({...config.webScrapers,sites:[rncp]},sampleSince);
  assert.ok(rncpRead.items.filter(i=>i.contentProvenance==='pagina_original').length>=3,'RNCP: menos de três íntegras verificadas');
  report.sources.push(...rncpRead.diagnostics.map(d=>({...d,historicalIndexCount:historical.length,
    currentWindowCount:current.length,latestPublishedAt:historical[0].publishedAt,historicalTest:true})));
  all.push(...rncpRead.items);
  const classified=all.map(item=>decidePublication({...item,classification:classifyItem(item)},
    {sourceActivations:sites,lookbackHours:168}));
  report.summary={discovered:classified.length,fullTexts:classified.filter(i=>i.contentProvenance==='pagina_original').length,
    indexOnly:classified.filter(i=>i.contentProvenance!=='pagina_original').length,
    alreadyArchived:classified.filter(i=>known.has(canonicalUrl(i.url))).length,
    categories:Object.fromEntries([...new Set(classified.map(i=>i.classification.category))].map(c=>
      [c,classified.filter(i=>i.classification.category===c).length])),
    historicalAlertsBlocked:classified.filter(i=>i.publicationDecision==='historico').length,
    eligible:classified.filter(i=>isNotifiable(i)&&!i.previewOnly).length};
  const old=classified.filter(i=>new Date(i.sourcePublishedAt||i.publishedAt)<new Date(sites[0].alertsFrom));
  assert.equal(old.filter(i=>isNotifiable(i)&&!i.previewOnly).length,0,'Histórico não pode ser liberado');
  const eligible=classified.filter(i=>isNotifiable(i)&&!i.previewOnly);
  report.summary.unseenEligible=selectUnseen(eligible,state).length;
  for(const site of sites) {
    report.samples.push(...classified.filter(i=>i.source===site.name&&i.contentProvenance==='pagina_original')
      .map(i=>({title:i.title,url:i.url,publishedAt:i.publishedAt,stateCode:i.stateCode||'',
        category:i.classification.category,stage:i.classification.stage||'',
        reason:i.classification.reasons?.join('; ')||'',alert:i.publicationDecision,
        reader:i.articleReader,chars:i.rawText.length,
        sha256:createHash('sha256').update(i.rawText).digest('hex'),
        evidence:redactPublicText(i.classification.evidenceText||''),text:redactPublicText(i.rawText)})));
  }
  assert.equal(JSON.stringify(state),protectedState,'Estado em memória alterado');
  report.stateUntouched=true;
  console.log(JSON.stringify({sources:report.sources,summary:report.summary,stateUntouched:true,whatsappSends:0},null,2));
} catch(error) { report.error=error.message;process.exitCode=1;console.error(error.message); }
finally {
  await mkdir('output/direct-gazettes',{recursive:true});
  await writeFile('output/direct-gazettes/report.json',JSON.stringify(report,null,2)+'\n');
}
