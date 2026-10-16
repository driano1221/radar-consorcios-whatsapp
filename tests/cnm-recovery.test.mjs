import test from 'node:test';
import assert from 'node:assert/strict';
import { isCnm, alternativeSearchUrl, parsePublicWordpressPosts, findAlternativeTexts, searchAlternatives } from '../src/lib/public-document-recovery.mjs';
import { parseCnmArticle } from '../src/lib/cnm-reader.mjs';
import { enrichArticle } from '../src/lib/article-enrichment.mjs';
const cnmUrl='https://cnm.org.br/comunicacao/noticias/exemplo-consorcio';
const cnmBody='<p>O Consórcio Intermunicipal Vale Verde realizou uma visita técnica ao centro municipal para conhecer instalações e avaliar possibilidades de cooperação regional.</p>';
const cnmPage={component:'Portal/Comunicacao/Noticia',url:'/comunicacao/noticias/exemplo-consorcio',props:{
  noticia:{id:1,slug:'exemplo-consorcio',titulo:'Consórcio realiza visita técnica',conteudo:cnmBody,datetime:'14/09/2026'},
  noticias_relacionadas:[{conteudo:'CONTEÚDO QUE NÃO DEVE ENTRAR'}]}};
const html=page=>`<html><head><title>CNM</title></head><body><div id="app" data-page="${JSON.stringify(page).replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"></div><script src="/cdn-cgi/challenge-platform/passive.js"></script></body></html>`;
test('CNM public Inertia article is readable without executing JS or passive scripts',async()=>{
  const parsed=parseCnmArticle(html(cnmPage),cnmUrl);assert.ok(parsed.text.startsWith('O Consórcio'));assert.equal(parsed.date,'2026-09-14');
  assert.ok(!parsed.text.includes('NÃO DEVE'));
  const article=await enrichArticle({url:cnmUrl,kind:'news',title:'Notícia CNM'},{fetchImpl:async()=>new Response(html(cnmPage),{headers:{'content-type':'text/html'}})});
  assert.equal(article.articleReader,'cnm_inertia_publica');assert.equal(article.contentProvenance,'pagina_original');
});
test('CNM cannot read a challenge, wrong slug, another component or related stories',()=>{
  for(const page of [{...cnmPage,component:'Portal/Inicio'},{...cnmPage,url:'/outra'},
    {...cnmPage,props:{...cnmPage.props,noticia:{...cnmPage.props.noticia,slug:'outra'}}},
    {...cnmPage,props:{noticias_relacionadas:[cnmPage.props.noticia]}}])assert.equal(parseCnmArticle(html(page),cnmUrl),null);
  assert.equal(parseCnmArticle(html(cnmPage).replace('<title>CNM','<title>Just a moment'),cnmUrl),null);
  assert.equal(parseCnmArticle(html(cnmPage).replace('<body>','<body><form id="challenge-form"></form>'),cnmUrl),null);
  assert.equal(parseCnmArticle(html(cnmPage),cnmUrl.replace('cnm.org.br','evil.test')),null);
});
const link='https://conclima.org.br/municipios-assinam-protocolo/';
const post={id:385,status:'publish',type:'post',link,title:{rendered:'Municípios assinam protocolo do Conclima'},date_gmt:'2026-09-15T12:38:14',content:{rendered:'<p>Prefeitos assinaram o protocolo.</p>'}};
test('CNM is recognized by exact public domains or source, not a lookalike',()=>{
  assert.equal(isCnm({url:'https://api.cnm.org.br/comunicacao/noticias/a'}),true);
  assert.equal(isCnm({url:'https://cnm.org.br.evil.test/a'}),false);
  assert.match(new URL(alternativeSearchUrl({fonte:'CNM',titulo:'Consórcio Conclima firma protocolo'})).searchParams.get('q'),/-site:cnm.org.br/);
});
test('public REST accepts only published unprotected posts from the verified publisher',()=>{
  assert.equal(parsePublicWordpressPosts([post],'conclima.org.br').length,1);
  for(const changed of [{...post,status:'draft'},{...post,link:'https://other.test/a'},{...post,content:{...post.content,protected:true}}])
    assert.equal(parsePublicWordpressPosts([changed],'conclima.org.br').length,0);
  assert.throws(()=>parsePublicWordpressPosts([post],'arbitrary.test'));
});
test('CNM discovery routes to public Conclima API; HTTP errors remain diagnostics',async()=>{
  const urls=[];
  const found=await searchAlternatives({fonte:'CNM',titulo:'Consórcio Conclima'},async url=>{
    urls.push(String(url));return String(url).includes('wp-json')?new Response(JSON.stringify([post])):new Response('blocked',{status:403});
  });
  assert.ok(urls.some(u=>u.startsWith('https://conclima.org.br/wp-json/wp/v2/posts?')));
  assert.equal(found.length,1);assert.equal(found.diagnostics[0].status,'erro');
});
test('related subject alone never becomes an equivalent alternative',async()=>{
  const row={id:'original',fonte:'CNM',titulo:'Municípios de Santa Catarina assinam adesão ao Conclima'};
  const found=parsePublicWordpressPosts([{...post,title:{rendered:'Municípios do Paraná subscrevem o Protocolo de Intenções do Conclima'}}],'conclima.org.br');
  const result=await findAlternativeTexts(row,[],{search:async()=>found,read:async()=>{throw new Error('must not read unrelated title');}});
  assert.equal(result.alternatives.length,0); // Existing human-reviewed correction is not generalized.
});
