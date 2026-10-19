import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseAmmSvg, ammPageUrls, readAmmPages } from '../src/lib/amm-pages.mjs';
import { reuseArticleTexts } from '../src/lib/article-text-store.mjs';
import { locateQuote } from '../src/lib/quote-evidence.mjs';
import { inputFor, reviewQueue, AI_PROMPT_VERSION } from '../src/lib/ai-review.mjs';
import { resolveArticlePreviews } from '../src/lib/preview-resolution.mjs';
import { fetchQueridoDiario } from '../src/lib/sources/querido-diario.mjs';
import { classifyItem } from '../src/lib/classifier.mjs';
import { decidePublication } from '../src/lib/publication-gate.mjs';
import { isCnm, isAraguaia, parsePublicWordpressPosts, searchPublicWordpress } from '../src/lib/public-document-recovery.mjs';
import { enrichArticle } from '../src/lib/article-enrichment.mjs';

const cdn = 'https://cdn-amm.diariomunicipal.org/publicacoes-pdf/2026/10/16/3590_1927082/1123be80-d318-45ba-9403-9c5d9aedd19e';
const html = `<div id="publication-text"><img src="${cdn}/p-0.svg"><img src="${cdn}/p-1.svg"></div>`;
const item = { url: 'https://amm.diariomunicipal.org/publicacao/1927082/', title: 'Norma CIDESPA', kind: 'gazette' };
const svg = '<svg><defs><text>MENUS NÃO SÃO PROVA</text></defs><g><use data-text="O consórcio institui procedimentos de inspeção municipal." transform="matrix(1,0,0,-1,10,20)"/><use data-text=" Fim do documento." transform="matrix(1,0,0,-1,10,40)"/></g></svg>';

test('AMM lê camada de caracteres, ordena páginas e preserva o fim', async () => {
  assert.equal(ammPageUrls(html, item.url).length, 2);
  assert.doesNotMatch(parseAmmSvg(svg), /MENUS/);
  const read = await readAmmPages(html, item, { fetchImpl: async () => new Response(svg) });
  assert.equal(read.documentPages.length, 2);
  assert.match(read.rawText, /\[Página 1\][\s\S]+\[Página 2\][\s\S]+Fim do documento\.$/);
  assert.equal(read.articleReader, 'amm_mt_svg_textual');
});

test('AMM não aceita sequência parcial, outra publicação ou página só desenhada', async () => {
  assert.throws(() => ammPageUrls(html.replace('/p-1.svg','/p-2.svg'), item.url), /incompleta/);
  assert.throws(() => ammPageUrls(html.replaceAll('3590_1927082','3590_999'), item.url), /fora da publicação/);
  assert.throws(() => ammPageUrls(html.replace('cdn-amm.diariomunicipal.org','outro.org'), item.url), /fora da publicação/);
  await assert.rejects(readAmmPages(html, item, { fetchImpl: async url => url.endsWith('p-1.svg')
    ? new Response('', { status: 503 }) : new Response(svg) }), /página 2/);
  assert.throws(() => parseAmmSvg('<svg><path d="M0 0"/></svg>'), /OCR necessário/);
});

test('instrução de inspeção não vira protocolo nem fiscalização realmente realizada', () => {
  const result = classifyItem({kind:'gazette',title:'INSTRUÇÃO NORMATIVA Nº 013/2026 - CIDESPA',
    rawText:'INSTRUÇÃO NORMATIVA Nº 013/2026. Estabelece os procedimentos do Serviço de Inspeção Municipal do Consórcio Intermunicipal Portal da Amazônia. CONSIDERANDO o protocolo de intenções aprovado pela Assembleia Geral; estabelece procedimentos para suspensão de estabelecimentos, apenas se constatada fraude.'});
  assert.equal(result.category,'ATUAÇÃO');
  assert.match(result.stage,/não comprova fiscalização/);
  const sources=[{name:'Jornal Oficial AMM-MT',adapter:'amm-mt',svgAlertsFrom:'2026-10-20T00:00:00-03:00'}];
  const recovered={...item,source:'Jornal Oficial AMM-MT',articleReader:'amm_mt_svg_textual',classification:result,publishedAt:'2026-10-19T12:00:00-03:00'};
  assert.equal(decidePublication(recovered,{sourceActivations:sources}).publicationDecision,'historico');
  assert.equal(decidePublication({...recovered,publishedAt:'2026-10-20T12:00:00-03:00'},
    {sourceActivations:sources,now:new Date('2026-10-20T20:00:00Z')}).publicationDecision,'elegivel');
});

test('citação permite tipografia, mas nunca paráfrase, quantidade diferente ou junção de campos', () => {
  assert.equal(locateQuote('O consórcio firmou parceria em setembro', ['O consórcio firmou, parceria em setembro.']), 'O consórcio firmou, parceria em setembro');
  assert.equal(locateQuote('atendeu 100 pacientes na região', ['atendeu 900 pacientes na região']), '');
  assert.equal(locateQuote('consórcio realizou visita técnica', ['consórcio realizou', 'visita técnica']), '');
  assert.equal(locateQuote('O consórcio celebrou a parceria', ['O consórcio firmou a parceria']), '');
  assert.equal(locateQuote('assinou o contrato novo', ['não assinou o contrato novo']), 'assinou o contrato novo');
  // Literal existence is checked here; interpretation of the negation remains
  // with the classifier/model, which receives the full surrounding sentence.
});

test('revisão recebe artigo completo mesmo com prova selecionada cortada', () => {
  const text = 'Introdução. '.repeat(300) + 'O Tribunal suspendeu o certame do consórcio até nova decisão.';
  const input = inputFor({ rawText: text, classification: { evidenceText: 'bunal suspendeu o certame' } });
  assert.equal(input.corpo, text);
  assert.equal(input.corpo_parcial, false);
  const long = inputFor({ rawText: 'x'.repeat(30000) });
  assert.equal(long.corpo_parcial, true);
  assert.ok(long.corpo.length + long.contexto_do_trecho.length <= 24000);
});

test('segunda tentativa real da fila respeita teto e resolve pontuação com trecho do corpo', async () => {
  const article = { title: 'Reunião do consórcio', url: 'https://exemplo.gov.br/reuniao',
    contentProvenance: 'pagina_original', previewOnly: true,
    rawText: 'O Consórcio Intermunicipal realizou, em setembro, uma visita técnica para discutir a gestão regional. '.repeat(2),
    classification: { category: 'ATUAÇÃO', score: 9 } };
  let attempts = 0;
  const state = {};
  const reviewer = async (_entry, options) => {
    attempts++;
    if (!options.retryStrict) throw Object.assign(new Error('citação inválida'), { code: 'INVALID_AI_DECISION' });
    return { status: 'approved', category: 'ATUAÇÃO', promptVersion: AI_PROMPT_VERSION,
      evidence: 'O Consórcio Intermunicipal realizou em setembro uma visita técnica' };
  };
  const resolved = await resolveArticlePreviews([article], [{ ...article, previewOnly: false }], state,
    { review: (items, state, options) => reviewQueue(items, state, { ...options, reviewImpl: reviewer }) });
  assert.equal(attempts, 2);
  assert.equal(resolved.callsRun, 2);
  assert.equal(resolved.items[0].previewOnly, false);
  assert.ok(article.rawText.includes(resolved.items[0].classification.evidenceText));
  const limited = await reviewQueue([article], {}, { maxCallsRun: 1, reviewImpl: reviewer });
  assert.equal(limited.selected.length, 0);
  assert.equal(limited.callsRun, 1);
});

test('cache íntegro evita nova abertura, mas reprodução não vira página original', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'radar-cache-test-'));
  try {
    const text = 'O consórcio realizou visita técnica em setembro. '.repeat(10);
    const row = { url_original: 'https://news.google.com/rss/articles/example', url_artigo: 'https://www.semana7.com.br/saude/1',
      texto: text, texto_sha256: createHash('sha256').update(text).digest('hex'), leitor: 'readability' };
    await writeFile(path.join(directory,'textos-artigos.ndjson'), JSON.stringify(row)+'\n');
    const source = { url: row.url_original, sourceUrl: 'https://www.semana7.com.br' };
    const valid = await reuseArticleTexts(directory, [source]);
    assert.equal(valid.reused, 1);
    assert.equal(valid.items[0].rawText, text);
    assert.equal((await reuseArticleTexts(directory, [{ ...source, sourceUrl: 'https://cnm.org.br' }])).reused, 0);
    await writeFile(path.join(directory,'textos-artigos.ndjson'), JSON.stringify({ ...row, texto: text+'alterado' })+'\n');
    assert.equal((await reuseArticleTexts(directory, [source])).reused, 0);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('QD usa a segunda rota oficial e não duplica o diário recuperado', async () => {
  const result = await fetchQueridoDiario({ enabled: true, retries: 0, queryGroups: [['consórcio']],
    fallbackBaseUrls: ['https://api.queridodiario.ok.org.br'] }, new Date('2026-10-01'), async url =>
    url.startsWith('https://queridodiario.ok.org.br/api') ? new Response('no available server', { status: 503 })
      : Response.json({ gazettes: [{ url: 'https://example.gov.br/1.pdf', territory_id: '1',date:'2026-10-15',excerpts:['consórcio público'] }] }));
  assert.equal(result.items.length, 1);
  assert.equal(result.ok, true);
  assert.equal(result.diagnostics[0].endpoint, 'https://api.queridodiario.ok.org.br');
});

test('nome CNM do Google entra na recuperação e AMA mantém editor e URL próprios', () => {
  assert.ok(isCnm({fonte:'Confederação Nacional de Municípios (CNM)',url:'https://news.google.com/rss/articles/1'}));
  const posts=parsePublicWordpressPosts([{id:1,status:'publish',type:'post',link:'https://ama-al.com.br/orientacao/',
    title:{rendered:'CNM orienta gestores sobre consórcios públicos'},content:{rendered:'<p>Orientação sobre consórcios públicos.</p>'},date_gmt:'2026-10-14T12:30:33'}],'ama-al.com.br');
  assert.equal(posts[0].fonte,'Associação dos Municípios Alagoanos (AMA)');
  assert.equal(posts[0].apiReading.articleUrl,'https://ama-al.com.br/orientacao/');
  assert.equal(posts[0].apiReading.apiUrl,'https://ama-al.com.br/wp-json/wp/v2/posts/1');
});

test('rota AMP só fornece texto com canônico da mesma publicação', async () => {
  const url='https://araguaianoticia.com.br/noticia/79633/consorcio-visita';
  const body='O consórcio público prepara uma visita técnica ao hospital municipal. '.repeat(4);
  const run=canonical=>enrichArticle({url,title:'Consórcio prepara visita técnica'}, {
    fetchImpl:async target=>target.endsWith('/amp')?new Response(`<html><head><link rel="canonical" href="${canonical}"></head><body><article>${body}</article></body></html>`,
      {headers:{'content-type':'text/html'}}):new Response('Acesso negado',{status:403}),
    readability:()=>body,trafilatura:()=>body});
  const valid=await run(url);
  assert.equal(valid.articleFetchUrl,url+'/amp');
  assert.equal(valid.articleUrl,url);
  assert.equal(valid.contentProvenance,'pagina_original');
  const wrong=await run(url.replace('79633','1'));
  assert.equal(wrong.rawText,undefined);
});

test('recuperação Araguaia usa palavras do assunto na busca pública', async () => {
  assert.ok(isAraguaia({fonte:'Araguaia Notícia'}));
  let request='';
  await searchPublicWordpress({titulo:'Consórcio de Saúde fará em breve visita técnica para definir gestão regional do hospital'},
    async url=>{request=url;return Response.json([]);});
  const query=new URL(request).searchParams.get('search');
  assert.match(query,/visita t[eé]cnica/);
  assert.doesNotMatch(query,/fara|breve/);
});

test('QD interrompe repetição quando as duas rotas confirmam indisponibilidade', async () => {
  let calls = 0;
  const result = await fetchQueridoDiario({ enabled: true, retries: 0, maxConcurrent: 1,
    queryGroups: Array.from({length:10},(_,i)=>['termo'+i]) }, new Date('2026-10-01'), async () => {
    calls++; return new Response('no available server', { status:503 });
  });
  assert.equal(calls, 2);
  assert.equal(result.items.length, 0);
  assert.equal(result.ok, false);
  assert.equal(result.degraded, true);
  assert.match(result.diagnostics[1].message,/adiada/);
});
