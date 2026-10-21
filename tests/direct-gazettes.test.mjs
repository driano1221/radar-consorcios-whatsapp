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
import { loadState, saveState } from '../src/lib/dedupe.mjs';
import { inputFor } from '../src/lib/ai-review.mjs';
import { catalogRecord } from '../src/lib/catalog.mjs';
import { buildWeeklyReport } from '../src/lib/history.mjs';
import {commitGazetteCursors} from '../scripts/commit-gazette-cursors.mjs';

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
    assert.equal(source.maxPages,source.stateCode==='PE'?2:1);assert.equal(source.maxDocuments,25);
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

const resumeSite={...site,resumePagination:true,maxPages:4,maxDocuments:100};
const codeFor=page=>String(page).padStart(8,'0');
function resumeState(overrides={},source=resumeSite){
  const portal=new URL(source.url).pathname.split('/')[1];
  return {seen:{},pending:{},gazetteCursors:{[source.url]:{query:'consórcio',from:'2026-10-12',to:'2026-10-19',
    nextPage:5,complete:false,pending:[],...overrides}},
  observations:{head:{item:{sourceUrl:source.url,url:`https://www.diariomunicipal.com.br/${portal}/materia/${codeFor(1)}`}}}};
}
function pageFixture(calls,{last=12,badPage,badCode,newHead=false}={}){
  return async url=>{
    const u=new URL(url),portal=u.pathname.split('/')[1];
    const code=u.pathname.match(/materia\/([A-F0-9]+)/)?.[1];
    if(code)return response(code===badCode?'bloqueado':article(code),code===badCode?403:200);
    const page=Number(u.searchParams.get('busca_avancada[pagina]'));
    calls.push({page,from:u.searchParams.get('busca_avancada[dataInicio]'),to:u.searchParams.get('busca_avancada[dataFim]')});
    if(page===badPage)return response('',503);
    const contents=index(newHead&&page===1?codeFor(99):codeFor(page),page<last?`<a href="/${portal}/pesquisar">Próxima</a>`:'');
    return response(contents.replaceAll('/amm-mg/',`/${portal}/`));
  };
}

test('MG retoma 5/6/7 após conferir novidades; marcador sobrevive a salvar e reabrir estado',async()=>{
  const state=resumeState(),before=JSON.stringify(state),calls=[];
  const first=await fetchWebScrapers({...config,enabled:true,sites:[resumeSite],gazetteState:state},since,pageFixture(calls));
  assert.deepEqual(calls.map(c=>c.page),[1,5,6,7]);
  assert.equal(first.gazetteCursors[site.url].nextPage,8);
  assert.equal(JSON.stringify(state),before,'coletor não deve alterar o estado recebido');
  const directory=await mkdtemp(path.join(tmpdir(),'sigpub-cursor-'));
  try{
    const file=path.join(directory,'state.json');
    await saveState(file,{...state,gazetteCursors:first.gazetteCursors});
    const reopened=await loadState(file),nextCalls=[];
    const second=await fetchDirectGazette(resumeSite,since,{...config,gazetteState:reopened},pageFixture(nextCalls));
    assert.deepEqual(nextCalls.map(c=>c.page),[1,8,9,10]);
    assert.equal(second.checkpoint.nextPage,11);
    assert.equal(second.items.length,new Set(second.items.map(i=>i.url)).size);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('PE usa uma página para novidades e outra para continuar da página 2',async()=>{
  const pe={...resumeSite,name:'PE',url:'https://www.diariomunicipal.com.br/amupe/pesquisar',stateCode:'PE',maxPages:2,maxDocuments:25};
  const state=resumeState({nextPage:2},pe),calls=[];
  const result=await fetchDirectGazette(pe,since,{...config,gazetteState:state},pageFixture(calls));
  assert.deepEqual(calls.map(c=>c.page),[1,2]);
  assert.equal(result.checkpoint.nextPage,3);
  assert.equal(result.diagnostic.partialTextCount,0);
});

test('novos resultados são lidos antes de continuar, sem duplicar o item conhecido',async()=>{
  const state=resumeState(),calls=[];
  const result=await fetchDirectGazette(resumeSite,since,{...config,gazetteState:state},pageFixture(calls,{newHead:true}));
  assert.deepEqual(calls.map(c=>c.page),[1,2,3,4]);
  assert.ok(result.items.some(i=>i.gazetteCode===codeFor(99)&&i.rawText===proof));
  assert.equal(result.checkpoint.nextPage,5,'não avançar o lote que ainda não foi consultado');
});

test('a janela do lote pendente não muda quando chega o dia seguinte',async()=>{
  const state=resumeState(),calls=[];
  await fetchDirectGazette(resumeSite,new Date('2026-10-13T03:00:00Z'),{...config,now:new Date('2026-10-20T22:00:00Z'),gazetteState:state},pageFixture(calls));
  assert.deepEqual(calls[0],{page:1,from:'2026-10-13',to:'2026-10-20'});
  assert.deepEqual(calls.slice(1),[5,6,7].map(page=>({page,from:'2026-10-12',to:'2026-10-19'})));
});

test('página de índice que falha é mantida para retentativa e conta no orçamento',async()=>{
  const state=resumeState(),calls=[];
  const result=await fetchDirectGazette(resumeSite,since,{...config,gazetteState:state},pageFixture(calls,{badPage:6}));
  assert.deepEqual(calls.map(c=>c.page),[1,5,6]);
  assert.equal(result.checkpoint.nextPage,6);
  assert.equal(result.diagnostic.pages,3);
  assert.equal(result.diagnostic.limited,false);
  assert.match(result.diagnostic.message,/Retomada página 6/);
});

function interruptedHtml(fragment = '', name = 'TimeoutError') {
  let sent = false;
  return new Response(new ReadableStream({ pull(controller) {
    if (!sent) { sent = true; controller.enqueue(Buffer.from(fragment)); }
    else controller.error(typeof name === 'string' ? new DOMException('HTML interrompido', name) : name);
  } }), { headers: { 'content-type': 'text/html' } });
}

test('MG repete o HTML interrompido da página 7 e descarta fragmentos antes de avançar', async () => {
  const calls = [], fixture = pageFixture(calls);
  let attempts = 0;
  const result = await fetchDirectGazette({ ...resumeSite, retries: 1 }, since,
    { ...config, gazetteState: resumeState({ nextPage: 7 }) }, async url => {
      if (new URL(url).searchParams.get('busca_avancada[pagina]') === '7' && ++attempts === 1) {
        return interruptedHtml(index(codeFor(99)), 'AbortError');
      }
      return fixture(url);
    });
  assert.equal(attempts, 2);
  assert.deepEqual(calls.map(c => c.page), [1, 7, 8, 9]);
  assert.equal(result.checkpoint.nextPage, 10);
  assert.equal(result.diagnostic.fullTextCount, 4);
  assert.equal(result.diagnostic.limited, true);
  assert.ok(result.items.every(i => i.gazetteCode !== codeFor(99)));
});

test('timeout persistente do corpo tem uma repetição e conserva o cursor da página 7', async () => {
  let attempts = 0;
  const fixture = pageFixture([]);
  const result = await fetchDirectGazette({ ...resumeSite, retries: 1 }, since,
    { ...config, gazetteState: resumeState({ nextPage: 7 }) }, async url => {
      if (new URL(url).searchParams.get('busca_avancada[pagina]') === '7') {
        attempts++; return interruptedHtml();
      }
      return fixture(url);
    });
  assert.equal(attempts, 2);
  assert.equal(result.checkpoint.nextPage, 7);
  assert.equal(result.diagnostic.limited, false);
  assert.match(result.diagnostic.message, /Retomada página 7:.*corpo HTTP.*HTML interrompido/);
});

test('SIGPub honra retries=0 da fonte sem herdar a repetição geral', async () => {
  let calls = 0;
  await assert.rejects(fetchDirectGazette({ ...site, retries: 0 }, since,
    { ...config, retries: 1 }, async () => {
      calls++; throw new DOMException('índice lento', 'TimeoutError');
    }), /índice lento/);
  assert.equal(calls, 1);
});

test('SIGPub recupera corpo de íntegra interrompido sem publicar fragmentos', async () => {
  let attempts = 0;
  const result = await fetchDirectGazette({ ...site, retries: 1 }, since, config, async url => {
    if (!String(url).includes('/materia/')) return response(index());
    return ++attempts === 1 ? interruptedHtml(article('DEADBEEF')) : response(article());
  });
  assert.equal(attempts, 2);
  assert.equal(result.items[0].rawText, proof);
  assert.equal(result.diagnostic.status, 'ok');
});

test('SIGPub não repete 403, HTML excessivo ou tipo inválido', async () => {
  for (const kind of ['403', 'size', 'type']) {
    let calls = 0;
    await assert.rejects(fetchDirectGazette({ ...site, retries: 1 }, since, config, async () => {
      calls++;
      return kind === '403' ? response('', 403) : kind === 'size' ? response('x'.repeat(8_000_001)) :
        new Response('invalid', { headers: { 'content-type': 'application/json' } });
    }), kind === '403' ? /HTTP 403/ : kind === 'size' ? /8 MB/ : /não HTML/);
    assert.equal(calls, 1, kind);
  }
});

test('SIGPub retenta conexão interrompida durante a leitura do HTML', async () => {
  for (const code of ['ECONNRESET', 'UND_ERR_SOCKET']) {
    let calls = 0;
    const result = await fetchDirectGazette({ ...site, retries: 1 }, since, config, async url => {
      if (String(url).includes('/materia/')) return response(article());
      return ++calls === 1 ? interruptedHtml('', new TypeError('terminated', { cause: { code } })) : response(index());
    });
    assert.equal(calls, 2, code);
    assert.equal(result.diagnostic.fullTextCount, 1);
  }
});

test('SIGPub não repete o corpo após esgotar o orçamento do portal', async t => {
  let clock = 0, calls = 0;
  t.mock.method(Date, 'now', () => clock);
  await assert.rejects(fetchDirectGazette({ ...site, maxDurationMs: 100, retries: 1 }, since, config, async () => {
    calls++; clock = 100; return interruptedHtml();
  }), /corpo HTTP/);
  assert.equal(calls, 1);
});

test('MG tem prazo específico de 20 segundos e mantém as outras fontes em 12', async t => {
  const defaults = JSON.parse(await readFile(new URL('../config/default.json', import.meta.url), 'utf8'));
  const mg = defaults.webScrapers.sites.find(s => s.stateCode === 'MG');
  assert.equal(mg.timeoutMs, 20000);
  const timeouts = [];
  t.mock.method(AbortSignal, 'timeout', ms => { timeouts.push(ms); return new AbortController().signal; });
  const original = { ...config, timeoutMs: 12000 };
  const result = await fetchDirectGazette(mg, since, original,
    async url => response(String(url).includes('/materia/') ? article() : index()));
  assert.ok(timeouts.length > 0 && timeouts.every(ms => ms === 20000));
  assert.equal(result.diagnostic.timeoutMs, 20000);
  assert.equal(original.timeoutMs, 12000);
  assert.equal(defaults.webScrapers.timeoutMs, 12000);
});

test('íntegra com falha impede avançar aquela página e fica guardada até recuperar',async()=>{
  const state=resumeState(),calls=[];
  const result=await fetchDirectGazette(resumeSite,since,{...config,gazetteState:state},pageFixture(calls,{badCode:codeFor(5)}));
  assert.equal(result.checkpoint.nextPage,5);
  assert.equal(result.checkpoint.pending.length,1);
  assert.equal(result.checkpoint.pending[0].rawText,'');
  assert.equal(result.items.find(i=>i.gazetteCode===codeFor(5)).previewOnly,true);
  const recovered=await fetchDirectGazette(resumeSite,since,{...config,gazetteState:{...state,gazetteCursors:{[site.url]:result.checkpoint}}},pageFixture([]));
  assert.equal(recovered.checkpoint.pending.length,0);
  assert.equal(recovered.checkpoint.nextPage,8);
});

test('falha na novidade não faz repetir todas as páginas antigas já concluídas',async()=>{
  const state=resumeState();
  const result=await fetchDirectGazette(resumeSite,since,{...config,gazetteState:state},pageFixture([],{badCode:codeFor(1)}));
  assert.equal(result.checkpoint.nextPage,8);
  assert.equal(result.checkpoint.pending.length,1);
  const calls=[];
  const next=await fetchDirectGazette(resumeSite,since,{...config,gazetteState:{...state,gazetteCursors:{[site.url]:result.checkpoint}}},pageFixture(calls));
  assert.deepEqual(calls.map(c=>c.page),[1,8,9,10]);
  assert.equal(next.checkpoint.pending.length,0);
});

test('ciclo concluído deixa de repetir o acervo e abre janela nova com um dia de sobreposição',async()=>{
  const state=resumeState();
  const result=await fetchDirectGazette(resumeSite,since,{...config,gazetteState:state},pageFixture([],{last:5}));
  assert.equal(result.checkpoint.complete,true);
  const nextState={...state,gazetteCursors:{[site.url]:result.checkpoint}},calls=[];
  const quiet=await fetchDirectGazette(resumeSite,since,{...config,gazetteState:nextState},pageFixture(calls));
  assert.deepEqual(calls.map(c=>c.page),[1]);
  assert.equal(quiet.diagnostic.truncated,false);
  const tomorrow=[];
  const next=await fetchDirectGazette(resumeSite,new Date('2026-10-13T03:00:00Z'),{...config,now:new Date('2026-10-20T22:00:00Z'),gazetteState:nextState},pageFixture(tomorrow,{last:1}));
  assert.deepEqual({from:next.checkpoint.from,to:next.checkpoint.to},{from:'2026-10-19',to:'2026-10-20'});
  assert.ok(tomorrow.every(c=>c.page===1),'não recomeçar toda a semana antiga');
});

test('marcador inválido e URL pendente externa são recusados sem acesso fora do portal',async()=>{
  for(const change of [{nextPage:0},{from:'2026-02-31'},{to:'2026-10-20'}]){
    await assert.rejects(fetchDirectGazette(resumeSite,since,{...config,gazetteState:resumeState(change)},pageFixture([])),/marcador/);
  }
  const state=resumeState({pending:[{url:'https://outro.org/materia/AABBCCDD'}]});
  const fetched=pageFixture([]);
  await assert.rejects(fetchDirectGazette(resumeSite,since,{...config,gazetteState:state},async url=>{
    assert.equal(new URL(url).hostname,'www.diariomunicipal.com.br');return fetched(url);
  }),/fora do portal/);
});

test('falha na segunda página de novidades conserva a referência anterior para tentar de novo',async()=>{
  const state=resumeState({headUrls:[`${site.url.replace('/pesquisar','')}/materia/${codeFor(1)}`]});
  const first=await fetchDirectGazette(resumeSite,since,{...config,gazetteState:state},pageFixture([],{newHead:true,badPage:2}));
  assert.equal(first.diagnostic.pages,4,'tentativa recusada também consome o teto de páginas');
  assert.equal(first.checkpoint.nextPage,7);
  assert.deepEqual(first.checkpoint.headUrls,state.gazetteCursors[site.url].headUrls);
  const calls=[];
  const next=await fetchDirectGazette(resumeSite,since,{...config,gazetteState:{...state,gazetteCursors:{[site.url]:first.checkpoint}}},pageFixture(calls,{newHead:true}));
  assert.deepEqual(calls.map(c=>c.page),[1,2,3,4],'a falha da página 2 não pode desaparecer por a página 1 já estar conhecida');
  assert.equal(next.diagnostic.partialTextCount,0);
});

test('pendências da primeira página não são descartadas quando não aparecem mais na listagem',async()=>{
  const first=await fetchDirectGazette(resumeSite,since,{...config,gazetteState:resumeState()},pageFixture([],{badCode:codeFor(1)}));
  const state=resumeState();state.gazetteCursors[site.url]=first.checkpoint;
  const next=await fetchDirectGazette(resumeSite,since,{...config,gazetteState:state},pageFixture([],{newHead:true}));
  assert.ok(next.items.some(i=>i.gazetteCode===codeFor(1)&&i.rawText===proof));
  assert.equal(next.checkpoint.pending.length,0);
});

test('uma consulta configurada diferente inicia um ciclo novo',async()=>{
  const calls=[];
  const state=resumeState({query:'outro filtro',nextPage:90});
  const result=await fetchDirectGazette(resumeSite,since,{...config,gazetteState:state},pageFixture(calls));
  assert.ok(calls.every(c=>c.page<5));
  assert.equal(result.checkpoint.query,'consórcio');
});

test('orçamento esgotado antes de ler um índice não é declarado cobertura acessível',async t=>{
  let clock=0,calls=0;
  t.mock.method(Date,'now',()=>clock++);
  await assert.rejects(fetchDirectGazette({...resumeSite,maxDurationMs:1},since,{...config,gazetteState:resumeState()},async()=>{
    calls++;return response(index());
  }),/orçamento esgotado/);
  assert.equal(calls,0);
});

test('plano não avança antes da confirmação e a gravação preserva fila, recibos e outros portais',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'sigpub-commit-'));
  try{
    const file=path.join(directory,'state.json'),plan=path.join(directory,'gazette-cursors.json');
    const state={version:4,seen:{sent:{sentAt:'2026-10-19T10:00:00Z'}},pending:{waiting:{attempts:2}},
      gazetteCursors:{...resumeState().gazetteCursors,other:{nextPage:3}}};
    await saveState(file,state);
    const next={...state.gazetteCursors[site.url],nextPage:8};
    await writeFile(plan,JSON.stringify({[site.url]:next}));
    const before=await readFile(file,'utf8');
    const cfg={persistState:false,stateFile:file,outputDir:directory,webScrapers:{sites:[resumeSite]}};
    await assert.rejects(commitGazetteCursors(cfg),/desabilitada/);
    assert.equal(await readFile(file,'utf8'),before,'catálogo ainda não confirmou: manter o marcador anterior');
    await commitGazetteCursors({...cfg,persistState:true});
    assert.deepEqual(await loadState(file),{...state,gazetteCursors:{...state.gazetteCursors,[site.url]:next}});
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('plano vazio ou inválido não apaga nem modifica marcadores existentes',async()=>{
  const directory=await mkdtemp(path.join(tmpdir(),'sigpub-empty-'));
  try{
    const file=path.join(directory,'state.json'),plan=path.join(directory,'gazette-cursors.json');
    await saveState(file,resumeState());
    const before=await readFile(file,'utf8');
    const cfg={persistState:true,stateFile:file,outputDir:directory,webScrapers:{sites:[resumeSite]}};
    await writeFile(plan,'{}');await commitGazetteCursors(cfg);
    assert.equal(await readFile(file,'utf8'),before);
    await writeFile(plan,JSON.stringify({'https://outro.org/':{nextPage:99}}));
    await assert.rejects(commitGazetteCursors(cfg),/fora dos portais/);
    assert.equal(await readFile(file,'utf8'),before);
  }finally{await rm(directory,{recursive:true,force:true});}
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
