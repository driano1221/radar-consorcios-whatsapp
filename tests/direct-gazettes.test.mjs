import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { sigpubDate, sigpubSearchUrl, parseSigpubIndex, parseSigpubArticle,
  fetchDirectGazette } from '../src/lib/sources/direct-gazettes.mjs';
import { fetchWebScrapers, parseRncp, parseRncpArticle } from '../src/lib/sources/web-scrapers.mjs';
import { reuseArticleTexts } from '../src/lib/article-text-store.mjs';
import { classifyItem } from '../src/lib/classifier.mjs';
import { decidePublication, isNotifiable } from '../src/lib/publication-gate.mjs';
import { itemId, selectUnseen, titleFingerprint } from '../src/lib/dedupe.mjs';
import { inputFor } from '../src/lib/ai-review.mjs';
import { catalogRecord } from '../src/lib/catalog.mjs';
import { buildWeeklyReport } from '../src/lib/history.mjs';

const site = { name: 'Diário Municipal AMM-MG', adapter: 'sigpub',
  url: 'https://www.diariomunicipal.com.br/amm-mg/pesquisar', stateCode: 'MG', publish: true,
  alertsFrom: '2026-10-20T00:00:00-03:00' };
const since = new Date('2026-10-12T03:00:00Z');
const now = new Date('2026-10-19T22:00:00Z');
const proof = 'Fica autorizado o ingresso do Município de Exemplo no Consórcio Intermunicipal de Saúde Regional. A participação depende da assinatura dos instrumentos necessários.';
function index(code = 'AABBCCDD', extra = '') {
  return `<main><input name="busca_avancada[texto]" value="consórcio"><li class="materia-card">
    <h2 class="materia-card__titulo"><a href="/amm-mg/materia/${code}">Lei nº 99/2026 autoriza ingresso no consórcio</a></h2>
    <span class="materia-card__entidade">Prefeitura Municipal de Exemplo</span>
    <p class="materia-card__trecho">${proof.slice(0,60)}…</p><dl>
    <div><dt>Circulação</dt><dd>19/10/2026</dd></div><div><dt>Edição</dt><dd>4383</dd></div>
    <div><dt>Código identificador</dt><dd>${code}</dd></div></dl></li>${extra}</main>`;
}
function article(code = 'AABBCCDD', text = proof) {
  return `<article><nav>NÃO LEIA MENU</nav><div id="materia"><p>${text}</p>
    <div align="right">Publicado por: operadora</div><script>lixo()</script></div>
    <dl class="verificacao__dados"><dt>Publicada em</dt><dd>19/10/2026</dd></dl>
    <dd class="verificacao__codigo">${code}</dd><footer>Autenticação digital não é prova</footer></article>`;
}
const response = (html, status = 200) => new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
const config = { now, retries: 0, reuseCache: false, requestDelayMs: 0 };

test('SIGPub usa formulário público GET com data de Brasília, sem tokens nem autenticação', () => {
  const u = sigpubSearchUrl(site, since, now, 2);
  assert.equal(u.searchParams.get('busca_avancada[texto]'), 'consórcio');
  assert.equal(u.searchParams.get('busca_avancada[ordenacao]'), 'recente');
  assert.equal(u.searchParams.get('busca_avancada[dataInicio]'), '2026-10-12');
  assert.equal(u.searchParams.get('busca_avancada[pagina]'), '2');
  assert.equal(sigpubDate('31/02/2026'), '');
  assert.equal(sigpubDate('01/10/26'), '');
});

test('SIGPub diferencia resumo do índice, publicação individual, UF e código', () => {
  const parsed = parseSigpubIndex(index(), site, since, now);
  assert.equal(parsed.items.length, 1);
  const item = parsed.items[0];
  assert.equal(item.gazetteCode, 'AABBCCDD'); assert.equal(item.stateCode, 'MG');
  assert.equal(item.territoryName, 'Exemplo'); assert.equal(item.rawText, '');
  assert.equal(item.previewOnly, true);
  const read = parseSigpubArticle(article(), item, site);
  assert.equal(read.rawText, proof); assert.equal(read.previewOnly, false);
  assert.equal(read.articleReader, 'sigpub_materia_original');
  assert.doesNotMatch(read.rawText, /menu|autentica|operadora|lixo/i);
  assert.equal(inputFor(read).corpo, proof);
  assert.equal(catalogRecord({ ...read, classification: classifyItem(read) }).uf, 'MG');
});

test('SIGPub rejeita código/data trocados, corpo ausente e busca não aplicada', () => {
  const item = parseSigpubIndex(index(), site, since, now).items[0];
  assert.throws(() => parseSigpubArticle(article('DEADBEEF'), item, site), /divergem/);
  assert.throws(() => parseSigpubArticle(article().replace('19/10/2026','18/10/2026'), item, site), /divergem/);
  assert.throws(() => parseSigpubArticle(article('AABBCCDD','Resumo curto'), item, site), /curto/);
  assert.throws(() => parseSigpubIndex(index().replace('value="consórcio"','value=""'), site, since, now), /filtro/);
  assert.throws(() => parseSigpubIndex('<main>Just a moment</main>', site, since, now), /não reconhecida/);
});

test('SIGPub recusa links externos, outra associação/UF e paginação externa', () => {
  assert.throws(() => parseSigpubIndex(index().replace('/amm-mg/materia/', 'https://outro.org/materia/'), site, since, now), /fora/);
  assert.throws(() => sigpubSearchUrl({ ...site, stateCode: 'AL' }, since), /portal\/UF/);
  assert.throws(() => parseSigpubIndex(index('AABBCCDD','<a href="https://outro.org/">Próxima</a>'), site, since, now), /paginação/);
});

test('SIGPub só aceita zero resultados com a mensagem explícita da busca', () => {
  const empty='<div class="busca-avancada"><input name="busca_avancada[texto]" value="consórcio"><p>Nenhuma matéria encontrada com esses filtros.</p></div>';
  assert.equal(parseSigpubIndex(empty,site,since,now).items.length,0);
  assert.throws(()=>parseSigpubIndex(empty.replace('Nenhuma matéria encontrada com esses filtros.','Falha ao consultar'),site,since,now),/sem confirmação/);
});

test('SIGPub elimina repetição na paginação sem confundir limite com cobertura completa', async () => {
  const calls = [];
  const result = await fetchDirectGazette({ ...site, maxPages: 2 }, since, config, async url => {
    calls.push(String(url));
    return response(String(url).includes('/materia/') ? article() : index('AABBCCDD',
      '<a href="/amm-mg/pesquisar?busca_avancada%5Bpagina%5D=3">Próxima</a>'));
  });
  assert.equal(result.items.length, 1); assert.equal(result.diagnostic.fullTextCount, 1);
  assert.equal(result.diagnostic.truncated, true); assert.equal(result.diagnostic.status, 'degraded');
  assert.equal(result.diagnostic.limited, true);
  assert.equal(calls.filter(u => u.includes('/materia/')).length, 1);
});

test('falha/limite de íntegra não libera ementa para WhatsApp nem some do diagnóstico', async () => {
  const result = await fetchDirectGazette(site, since, config,
    async url => response(String(url).includes('/materia/') ? 'indisponível' : index(), String(url).includes('/materia/') ? 403 : 200));
  assert.equal(result.diagnostic.status, 'degraded'); assert.equal(result.diagnostic.partialTextCount, 1);
  assert.equal(result.diagnostic.limited, false);
  assert.equal(result.items[0].previewOnly, true); assert.equal(result.items[0].rawText, '');
});

test('SIGPub sobrepõe no máximo duas leituras para completar a amostra dentro do orçamento', async t => {
  let clock=0, active=0, maximum=0;
  t.mock.method(Date,'now',()=>clock);
  const codes=Array.from({length:6},(_,i)=>String(i+1).padStart(8,'0'));
  const result=await fetchDirectGazette({...site,maxDurationMs:50},since,config,async url=>{
    const started=clock;
    active++;maximum=Math.max(maximum,active);
    await new Promise(resolve=>setTimeout(resolve,0));
    clock=Math.max(clock,started+10);active--;
    const code=new URL(url).pathname.match(/materia\/([A-F0-9]+)/)?.[1];
    return response(code?article(code):codes.map(code=>index(code)).join(''));
  });
  assert.equal(result.diagnostic.fullTextCount,6);
  assert.equal(result.diagnostic.partialTextCount,0);
  assert.equal(maximum,2);
  assert.deepEqual(result.items.map(i=>i.gazetteCode),codes,'preservar ordem da amostra');
  assert.ok(result.diagnostic.durationMs<50);
});

test('SIGPub mantém o teto de documentos com dois leitores e preserva prévias pendentes', async () => {
  let reads=0;
  const codes=Array.from({length:6},(_,i)=>String(i+1).padStart(8,'0'));
  const result=await fetchDirectGazette({...site,maxDocuments:3},since,config,async url=>{
    const code=new URL(url).pathname.match(/materia\/([A-F0-9]+)/)?.[1];
    if(code)reads++;
    return response(code?article(code):codes.map(code=>index(code)).join(''));
  });
  assert.equal(reads,3);
  assert.equal(result.diagnostic.fullTextCount,3);
  assert.equal(result.diagnostic.partialTextCount,3);
  assert.equal(result.diagnostic.limited,false);
  assert.ok(result.items.slice(3).every(i=>i.previewOnly&&i.extractionError&&!i.rawText));
});

test('SIGPub espaça inícios de requisições entre portais no mesmo host', async () => {
  const starts=[];
  const al={...site,name:'AL',url:'https://www.diariomunicipal.com.br/ama/pesquisar',stateCode:'AL'};
  const result=await fetchWebScrapers({...config,requestDelayMs:350,enabled:true,sites:[site,al]},since,async url=>{
    starts.push(Date.now());
    const portal=new URL(url).pathname.split('/')[1];
    return response(String(url).includes('/materia/')?article():index().replaceAll('/amm-mg/',`/${portal}/`));
  });
  assert.equal(result.items.length,2);
  assert.equal(starts.length,4);
  assert.ok(starts.slice(1).every((time,index)=>time-starts[index]>=300),JSON.stringify(starts));
});

test('CE, PB e PE leem fonte oficial independente do QD e bloqueiam o acervo anterior à ativação', async () => {
  const cfg=JSON.parse(await readFile(new URL('../config/default.json',import.meta.url),'utf8'));
  const sources=cfg.webScrapers.sites.filter(s=>['CE','PB','PE'].includes(s.stateCode));
  assert.equal(sources.length,3);
  for(const source of sources){
    const portal=new URL(source.url).pathname.split('/')[1];
    assert.equal(source.maxPages,1);assert.equal(source.maxDocuments,25);
    const fetched=await fetchDirectGazette(source,since,config,async url=>response(
      String(url).includes('/materia/')?article():index().replaceAll('/amm-mg/',`/${portal}/`)));
    const item=fetched.items[0];
    assert.equal(item.stateCode,source.stateCode);assert.equal(item.rawText,proof);
    assert.equal(item.contentProvenance,'pagina_original');
    const classified={...item,classification:classifyItem(item)};
    assert.equal(decidePublication(classified,{now:new Date('2026-10-23T22:00:00Z'),sourceActivations:sources}).publicationDecision,'historico');
    const current={...classified,sourcePublishedAt:'2026-10-23T15:00:00.000Z',publishedAt:'2026-10-23T15:00:00.000Z'};
    assert.equal(isNotifiable(decidePublication(current,{now:new Date('2026-10-23T22:00:00Z'),sourceActivations:sources})),true);
  }
});

test('paginação com erro de rede permanece falha mesmo quando a primeira página foi lida', async () => {
  const result = await fetchDirectGazette(site, since, config, async url => {
    const target = new URL(url);
    if (target.searchParams.get('busca_avancada[pagina]') === '2') return response('', 503);
    return response(target.pathname.includes('/materia/') ? article() : index('AABBCCDD',
      '<a href="/amm-mg/pesquisar?busca_avancada%5Bpagina%5D=2">Próxima</a>'));
  });
  assert.equal(result.diagnostic.status, 'degraded');
  assert.equal(result.diagnostic.fullTextCount, 1);
  assert.equal(result.diagnostic.limited, false);
  assert.match(result.diagnostic.message, /Página 2: SIGPub HTTP 503/);
});

test('quatro páginas leem documentos distintos e o agregado distingue limite de erro de extração', async () => {
  const fetchImpl = async url => {
    const target = new URL(url);
    const page = Number(target.searchParams.get('busca_avancada[pagina]') || 1);
    const code = target.pathname.includes('/materia/') ? target.pathname.split('/').at(-1) : String(page).padStart(8, '0');
    return response(target.pathname.includes('/materia/') ? article(code) : index(code,
      `<a href="/amm-mg/pesquisar?busca_avancada%5Bpagina%5D=${page + 1}">Próxima</a>`));
  };
  const result = await fetchWebScrapers({ ...config, enabled: true, sites: [{ ...site, maxPages: 4 }] }, since, fetchImpl);
  assert.equal(result.items.length, 4);
  assert.equal(new Set(result.items.map(item => item.url)).size, 4);
  assert.equal(result.diagnostics[0].pages, 4);
  assert.equal(result.diagnostics[0].fullTextCount, 4);
  assert.equal(result.degraded, true);
  assert.equal(result.limited, true);
  const failed = await fetchWebScrapers({ ...config, enabled: true, sites: [site] }, since,
    async url => response(String(url).includes('/materia/') ? '' : index(), String(url).includes('/materia/') ? 403 : 200));
  assert.equal(failed.limited, false);
});

test('diários independentes continuam quando um portal está indisponível', async () => {
  const result = await fetchWebScrapers({ ...config, enabled: true, sites: [site, {
    ...site, name:'AL', url:'https://www.diariomunicipal.com.br/ama/pesquisar', stateCode:'AL' }] }, since,
  async url => String(url).includes('/ama/') ? response('',503) : response(String(url).includes('/materia/') ? article() : index()));
  assert.equal(result.ok, true); assert.equal(result.degraded, true); assert.equal(result.items.length,1);
  assert.equal(result.diagnostics.find(d=>d.name==='AL').status,'error');
});

test('cache de íntegra de ato é explícito, com hash, mesma origem e não altera ID', async () => {
  const directory = await mkdtemp(path.join(tmpdir(),'sigpub-test-'));
  try {
    const item = parseSigpubIndex(index(),site,since,now).items[0];
    await writeFile(path.join(directory,'textos-artigos.ndjson'),JSON.stringify({url_original:item.url,
      url_artigo:item.url,texto:proof,texto_sha256:createHash('sha256').update(proof).digest('hex'),leitor:'sigpub_materia_original',data_publicacao:item.publishedAt})+'\n');
    assert.equal((await reuseArticleTexts(directory,[item])).reused,0);
    const cached = await reuseArticleTexts(directory,[item],{includeGazettes:true});
    assert.equal(cached.reused,1); assert.equal(cached.items[0].rawText,proof);
    assert.equal(itemId(cached.items[0]),itemId(item));
  } finally { await rm(directory,{recursive:true,force:true}); }
});

test('novos portais não reenviam histórico, inclusive reindexado pelo Google', async () => {
  const cfg=JSON.parse(await readFile(new URL('../config/default.json',import.meta.url),'utf8'));
  const sources=cfg.webScrapers.sites.filter(s=>s.adapter==='sigpub'||s.adapter==='rncp');
  assert.equal(sources.length,8); assert.ok(sources.every(s=>s.publish&&s.alertsFrom));
  assert.ok(sources.filter(s=>s.adapter==='sigpub').every(s=>s.enabled!==false));
  assert.equal(sources.find(s=>s.adapter==='rncp').enabled,false);
  const row=parseSigpubArticle(article(),parseSigpubIndex(index(),site,since,now).items[0],site);
  const classification=classifyItem(row); assert.equal(classification.category,'ADESÃO AUTORIZADA');
  assert.equal(decidePublication({...row,classification},{now,sourceActivations:sources}).publicationDecision,'historico');
  assert.equal(isNotifiable(decidePublication({...row,classification},{now,sourceActivations:sources})),false);
  assert.equal(decidePublication({...row,classification,url:'https://news.google.com/rss/articles/x',articleUrl:row.url,
    publishedAt:'2026-10-21T12:00:00-03:00'},{now:new Date('2026-10-21T22:00:00Z'),sourceActivations:sources}).publicationDecision,'historico');
  const current={...row,classification,sourcePublishedAt:'2026-10-21T12:00:00-03:00',publishedAt:'2026-10-21T12:00:00-03:00'};
  assert.equal(isNotifiable(decidePublication(current,{now:new Date('2026-10-21T22:00:00Z'),sourceActivations:sources})),true);
  const state={seen:{[itemId(current)]:{url:current.url,title:current.title,titleFingerprint:titleFingerprint(current)}},pending:{}};
  assert.equal(selectUnseen([current,current],state).length,0);
  const googleState={seen:{old:{url:'https://news.google.com/rss/articles/old',articleUrl:current.url,
    title:current.title+' - Diário Municipal',sentAt:'2026-10-21T18:00:00Z'}},pending:{}};
  assert.equal(selectUnseen([current],googleState).length,0,'URL oficial já enviada via Google não pode reaparecer');
  const historical=decidePublication({...row,classification},{now,sourceActivations:sources});
  const weekly=buildWeeklyReport({seen:{},observations:{old:{firstSeenAt:'2026-10-22T12:00:00Z',item:historical}}},
    {start:new Date('2026-10-19T00:00:00Z'),end:new Date('2026-10-26T00:00:00Z')});
  assert.equal(weekly.events,0,'Recuperação histórica também deve ficar fora do resumo');
  const al={...site,name:'AL',url:'https://www.diariomunicipal.com.br/ama/pesquisar',stateCode:'AL',alertsFrom:'2026-10-22T00:00:00-03:00'};
  const alItem={...current,source:'Outro editor',sourceUrl:al.url,url:'https://www.diariomunicipal.com.br/ama/materia/DEADBEEF',articleUrl:''};
  assert.equal(decidePublication(alItem,{now:new Date('2026-10-21T22:00:00Z'),sourceActivations:[site,al]}).publicationDecision,'historico');
});

const rncp={name:'Rede Nacional de Consórcios Públicos',adapter:'rncp',url:'https://www.rncp.org.br/noticias',publish:true,articleSelector:'.the_content_wrapper'};
const rnIndex='<div class="post-item"><span class="post-date updated">08/09/2026</span><h2 class="entry-title"><a href="noticia/pleitos/114">Rede apresenta pleitos</a></h2></div>';
const rnBody='<h1>Rede apresenta pleitos</h1><div class="the_content_wrapper"><p>08/09/2026<br></p><div class="big"><p>Em audiência com o presidente do Tribunal de Contas, a Rede Nacional de Consórcios Públicos apresentou os pleitos dos consórcios do estado. Foi sugerida a realização de um seminário.</p><script>menu e desafio passivo</script></div></div>';

test('RNCP distingue índice/íntegra, exclui script e não é cadastrada como consórcio', () => {
  const rows=parseRncp(rnIndex+rnIndex,rncp,new Date('2026-01-01'));
  assert.equal(rows.length,1); assert.equal(rows[0].url,'https://www.rncp.org.br/noticia/pleitos/114');
  const read=parseRncpArticle(rnBody,rows[0],rncp);
  assert.equal(read.contentProvenance,'pagina_original'); assert.equal(read.previewOnly,false);
  assert.doesNotMatch(read.rawText,/menu e desafio|08\/09/);
  assert.equal(read.entityName,undefined);
  assert.throws(()=>parseRncpArticle(rnBody.replace('08/09/2026','09/09/2026'),rows[0],rncp),/conferem/);
});

test('RNCP bloqueia HTML de desafio e itens sem íntegra pelo limite de leitura', async () => {
  const second=rnIndex.replaceAll('114','115').replace('pleitos/','outros/');
  const result=await fetchWebScrapers({enabled:true,retries:0,sites:[{...rncp,maxArticles:1}]},new Date('2026-01-01'),
    async url=>response(String(url).endsWith('/noticias')?rnIndex+second:'<h1>Just a moment</h1>'));
  assert.equal(result.items.length,2); assert.ok(result.items.every(i=>i.previewOnly&&i.extractionError));
  assert.equal(result.diagnostics[0].status,'degraded');
});
