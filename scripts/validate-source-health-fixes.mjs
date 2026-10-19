// Live diagnostics run without WhatsApp/session credentials or catalogue writes.
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fetchQueridoDiario } from '../src/lib/sources/querido-diario.mjs';
import { fetchWebScrapers, parseAmmMtPublication } from '../src/lib/sources/web-scrapers.mjs';
import { readAmmPages } from '../src/lib/amm-pages.mjs';
import { enrichArticle } from '../src/lib/article-enrichment.mjs';
import { classifyItem } from '../src/lib/classifier.mjs';
import { inputFor, reviewQueue } from '../src/lib/ai-review.mjs';
import { reuseArticleTexts } from '../src/lib/article-text-store.mjs';
import { findAlternativeTexts, searchPublicWordpress } from '../src/lib/public-document-recovery.mjs';

const config = JSON.parse(await readFile('config/default.json', 'utf8'));
const archive = (await readFile('data/catalogo/arquivo-coletas.ndjson','utf8')).trim().split('\n').map(JSON.parse);
const since = new Date(Date.now()-7*86400000);
const results = [];
const ammIds = [1927112,1927082,1927079,1927075,1927072,1927071,1927061,1927058,1927051,1927049,1927042,1927041,1927040];
for (const id of ammIds) {
  const item = { kind:'gazette',url:`https://amm.diariomunicipal.org/publicacao/${id}/`,source:'Jornal Oficial AMM-MT' };
  const response = await fetch(item.url,{signal:AbortSignal.timeout(12000)});
  assert.ok(response.ok, `AMM ${id}: HTTP ${response.status}`);
  const html = await response.text();
  let before = '';
  try { before = parseAmmMtPublication(html,item).rawText; } catch { /* old missing-body failure */ }
  const read = await readAmmPages(html,item);
  assert.ok(read?.rawText.length >= 100, `AMM ${id}: leitura integral ausente`);
  results.push({kind:'amm_svg',id,beforeCharacters:before.length,afterCharacters:read.rawText.length,
    pages:read.documentPages.length,reader:read.articleReader,category:classifyItem(read).category});
}
const ammSite = config.webScrapers.sites.find(x=>x.adapter==='amm-mt');
const amm = await fetchWebScrapers({...config.webScrapers,sites:[ammSite]},since);
assert.ok(amm.ok);
assert.ok(amm.items.every(x=>!x.extractionError),'O coletor AMM ainda deixou publicações sem leitura');
results.push({kind:'amm_collector',items:amm.items.length,diagnostics:amm.diagnostics});

const qd = await fetchQueridoDiario({...config.queridoDiario,queryGroups:config.queridoDiario.queryGroups.slice(0,2)},since);
// An external outage must stay explicit, never turn an empty result into success.
assert.equal(qd.degraded,qd.diagnostics.some(d=>d.status!=='ok'));
results.push({kind:'querido_diario',items:qd.items.length,ok:qd.ok,diagnostics:qd.diagnostics});

const semana = archive.find(x=>x.id.startsWith('0783e43a'));
const cached = await reuseArticleTexts('data/catalogo',[{kind:'news',url:semana.url,title:semana.titulo,sourceUrl:'https://www.semana7.com.br'}]);
assert.equal(cached.reused,1,'Semana 7: leitura original preservada não foi reutilizada');
results.push({kind:'semana7_original_cache',reader:cached.items[0].articleReader,characters:cached.items[0].rawText.length,
  source:cached.items[0].articleUrl,reused:true});

const cnm = archive.find(x=>x.id.startsWith('26f6e6e1'));
const ama = await searchPublicWordpress(cnm,fetch,'ama-al.com.br');
const alternate = await findAlternativeTexts(cnm,[],{ search:async()=>ama, searchEvenWithArchive:true });
assert.ok(alternate.alternatives.some(x=>x.url_fonte.startsWith('https://ama-al.com.br/')),
  'CNM: íntegra alternativa via API AMA não recuperada');
results.push({kind:'cnm_alternative',original:'https://cnm.org.br/comunicacao/noticias/cnm-orienta-gestores-sobre-posicao-da-receita-federal-que-trata-de-consorcios-publicos',
  alternatives:alternate.alternatives.map(x=>({url:x.url_fonte,reader:x.leitor,characters:x.texto.length,
    independent:x.independencia,equivalenceConfirmed:x.equivalencia_confirmada}))});

const araguaia = await enrichArticle({kind:'news',title:'Consórcio de Saúde fará em breve visita técnica para definir gestão regional do Hospital de Barra do Garças',
  source:'Araguaia Notícia',url:'https://araguaianoticia.com.br/noticia/79633/consorcio-de-saude-fara-em-breve-visita-tecnica-para-definir-gestao-regional-do-hospital'});
results.push({kind:'araguaia_original',characters:araguaia.rawText?.length||0,reader:araguaia.articleReader||'',
  category:araguaia.rawText?classifyItem(araguaia).category:'sem texto'});

const tce = await enrichArticle({kind:'news',title:'Erros em editais levam TCEMG a suspender licitações de consórcios em Minas Gerais',
  source:'TCE-MG',url:'https://www.tce.mg.gov.br/noticia/Detalhe/1111629256'});
assert.ok(tce.rawText?.length>2000,'Caso TCE-MG sem íntegra');
const classified = {...tce,classification:classifyItem(tce)};
const input = inputFor(classified);
assert.equal(input.corpo_parcial,false);
assert.ok(input.corpo.includes('consórcios'));
if(process.env.DEEPSEEK_API_KEY){
  const isolated = {};
  const reviewed = await reviewQueue([classified],isolated,{apiKey:process.env.DEEPSEEK_API_KEY,maxCallsRun:2,maxCallsDay:2});
  const approval = reviewed.selected[0];
  results.push({kind:'tce_ai_review',inputCharacters:input.corpo.length,calls:reviewed.callsRun,audit:reviewed.audit,
    evidence:approval?.aiReview?.evidence||''});
  assert.ok(approval,'DeepSeek ainda não concluiu a revisão real do TCE-MG');
  assert.equal(approval.classification.category,'CONTROLE');
  assert.ok(tce.rawText.includes(approval.aiReview.evidence),'Prova não existe literalmente no corpo');
  const again = await reviewQueue([classified],isolated,{apiKey:'not-used',maxCallsRun:2});
  assert.equal(again.callsRun,0,'A mesma revisão não deve pagar duas vezes');
}else results.push({kind:'tce_ai_review',status:'sem chave local; testar no Actions'});

const report={at:new Date().toISOString(),environment:process.env.GITHUB_ACTIONS?'github_actions':'local',
  whatsappCalls:0,results};
await mkdir('output/source-health-fixes',{recursive:true});
await writeFile('output/source-health-fixes/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
