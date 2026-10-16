// Read-only diagnosis: no catalog, queue, AI, WhatsApp or credentials imported.
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { setDefaultResultOrder } from 'node:dns';
import { XMLParser } from 'fast-xml-parser';
import { load } from 'cheerio';
import { gunzipSync } from 'node:zlib';
import { extractArticleText, isChallengePage } from '../src/lib/article-enrichment.mjs';
setDefaultResultOrder('ipv4first');
const agent = 'RadarConsorciosIPEA/0.3 (+pesquisa academica; https://github.com/driano1221/radar-consorcios-whatsapp)';
const parser = new XMLParser();
const array = x => x == null ? [] : Array.isArray(x) ? x : [x];
const results = [];
async function request(url, options = {}) {
  const r = await fetch(url, { ...options, headers: { 'user-agent': agent, ...options.headers }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const chunks = []; let length = 0;
  for await (const chunk of r.body) {
    length += chunk.length;
    if (length > 5_000_000) throw new Error('Resposta excedeu 5 MB');
    chunks.push(chunk);
  }
  return { response: r, bytes: Buffer.concat(chunks) };
}
async function probe(name, url, read) {
  try {
    const details = await read(url);
    const row = { name, url, status: 'ok', ...details };
    results.push(row); console.log(JSON.stringify(row)); return row;
  } catch (error) {
    const row = { name, url, status: 'error', message: error.cause?.code || error.message };
    results.push(row); console.log(JSON.stringify(row)); return row;
  }
}
await probe('Semana 7 RSS', 'https://www.semana7.com.br/rss.php', async url => {
  const { bytes } = await request(url);
  const parsed = parser.parse(bytes.toString());
  if (!parsed.rss?.channel) throw new Error('Não é RSS válido');
  const items = array(parsed.rss.channel.item);
  return { count: items.length, completeBodies: items.filter(x => x['content:encoded']).length,
    sample: items.slice(0, 2).map(x => ({ title: x.title, url: x.link, date: x.pubDate })) };
});
await probe('Semana 7 artigo integral', 'https://www.semana7.com.br/saude/consorcio-de-saude-viabiliza-procedimentos-oftalmologicos-para-100-pacientes-do-araguaia/84225', async url => {
  const { bytes } = await request(url);
  const html = bytes.toString();
  if (isChallengePage(html)) throw new Error('Verificação de segurança, não é texto da notícia');
  const text = extractArticleText(html);
  if (text.length < 500 || !/cons[oó]rcio/i.test(text)) throw new Error('Sem texto integral aproveitável');
  return { characters: text.length };
});
const sitemap = await probe('Semana 7 sitemap', 'https://www.semana7.com.br/sitemaps/1/sitemap-index.xml', async url => {
  const { bytes } = await request(url);
  const parsed = parser.parse(bytes.toString());
  if (!parsed.sitemapindex) throw new Error('Não é índice sitemap');
  const entries = array(parsed.sitemapindex.sitemap);
  return { count: entries.length, newsMap: entries.find(x => /sitemap-google-news\.xml\.gz$/.test(x.loc))?.loc };
});
if (sitemap.newsMap && new URL(sitemap.newsMap).origin === 'https://www.semana7.com.br') {
  await probe('Semana 7 notícias no sitemap', sitemap.newsMap, async url => {
    const { bytes } = await request(url);
    const xml = gunzipSync(bytes, { maxOutputLength: 5_000_000 }).toString();
    const data = parser.parse(xml);
    if (!data.urlset) throw new Error('Não é sitemap de URLs');
    const items = array(data.urlset.url);
    return { count: items.length, sample: items.slice(0, 2) };
  });
}
for (const type of ['legislacao', 'diario-oficial']) {
  await probe(`Guanhães Prefeitura ${type}`, `https://www.guanhaes.mg.gov.br/portal/dados-abertos/${type}/2026`, async url => {
    const { bytes } = await request(url);
    const data = JSON.parse(bytes.toString());
    if (!Array.isArray(data.dados)) throw new Error('Formato inesperado');
    const empty = /Nenhum registro encontrado/i.test(JSON.stringify(data));
    return { count: empty ? 0 : data.dados.length, empty };
  });
}
const portal = await probe('Guanhães PortalTP JSON', 'https://guanhaes-mg.portaltp.com.br/api/institucional/api-legislacao.aspx', async url => {
  const { bytes } = await request(url); const $ = load(bytes.toString());
  const action = new URL($('form').attr('action') || '', url);
  if (action.href !== url || !$('select[name="ctl00$containerCorpo$cbxFormato"] option[value="JSON"]').length) throw new Error('Exportação oficial não encontrada');
  const body = new URLSearchParams();
  $('form input[type="hidden"][name]').each((_, e) => body.set($(e).attr('name'), $(e).attr('value') || ''));
  body.set('ctl00$containerCorpo$cbxFormato', 'JSON');
  body.set('ctl00$containerCorpo$btnAplicFiltro', '');
  const exported = await request(url, { method: 'POST', body });
  const rows = JSON.parse(exported.bytes.toString().replace(/^\uFEFF/, ''));
  if (!Array.isArray(rows) || rows.some(r => typeof r.link_documento !== 'string')) throw new Error('JSON de documentos inválido');
  return { count: rows.length, types: [...new Set(rows.map(r => r.tipo))],
    consortiumMatches: rows.filter(r => /cons[oó]rc/i.test(r.descricao || '')).length,
    sample: rows.slice(0, 1) };
});
const pdf = portal.sample?.[0]?.link_documento;
if (pdf?.startsWith('https://s3.amazonaws.com/el.com.br/portal/uploads/3177/')) {
  await probe('Guanhães PDF oficial vinculado', pdf, async url => {
    const { bytes, response } = await request(url, { headers: { Range: 'bytes=0-15' } });
    if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('Arquivo não é PDF');
    return { httpStatus: response.status, signature: '%PDF-', bytesRead: bytes.length };
  });
}
await mkdir('output/public-routes', { recursive: true });
const report = { generatedAt: new Date().toISOString(), githubRun: process.env.GITHUB_RUN_ID || null, results };
await writeFile('output/public-routes/report.json', JSON.stringify(report, null, 2));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY,
  `## Rotas públicas — teste sem envios\n\n| Rota | Resultado | Registros |\n|---|---|---:|\n` +
  results.map(r => `| ${r.name} | ${r.status === 'ok' ? r.empty ? 'Acessível, vazio' : 'Conteúdo validado' : r.message} | ${r.count ?? '—'} |`).join('\n') + '\n');
