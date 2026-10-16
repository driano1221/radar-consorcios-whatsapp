import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { load } from 'cheerio';
import { canonicalUrl } from './dedupe.mjs';
import { redactPublicText } from './article-text-store.mjs';
import { enrichArticle } from './article-enrichment.mjs';
import { compareAlternative, matchWords as words, matchNumbers as numbers } from './alternative-match.mjs';
export { compareAlternative } from './alternative-match.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const normal = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const array = x => x == null ? [] : Array.isArray(x) ? x : [x];
const host = url => { try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; } };
export const isSemana7 = row => /^semana\s*7$/i.test(row.fonte || '') ||
  [row.url, row.article_url, row.article_resolved_url].some(url => host(url) === 'semana7.com.br');
export const isGuanhaesPdf = url => /^https:\/\/s3\.amazonaws\.com\/el\.com\.br\/portal\/uploads\/3177\/[^?#]+\.pdf$/i.test(url || '');
export const digest = value => createHash('sha256').update(value).digest('hex');
export function alternativeSourceKey(url) {
  const canonical = canonicalUrl(url);
  // Observed desktop/AMP variants of this publisher share the same article ID.
  if (host(canonical) === 'araguaianoticia.com.br') {
    const id = new URL(canonical).pathname.match(/^\/noticia\/(\d+)(?:\/|$)/)?.[1];
    if (id) return `araguaianoticia.com.br/noticia/${id}`;
  }
  return canonical;
}

export async function downloadGuanhaesPdf(url, fetchImpl = fetch) {
  if (!isGuanhaesPdf(url)) throw new Error('pdf_fora_do_armazenamento_oficial');
  const response = await fetchImpl(url, { redirect: 'manual', signal: AbortSignal.timeout(20000),
    headers: { accept: 'application/pdf', 'user-agent': 'RadarConsorciosIPEA/0.3 (+pesquisa academica)' } });
  // Never follow an unverified redirect away from the public document storage.
  if (!response.ok) throw new Error(`pdf_http_${response.status}`);
  if (+response.headers.get('content-length') > 20 * 1024 * 1024) throw new Error('pdf_grande_demais');
  const chunks = []; let count = 0;
  for await (const chunk of response.body) {
    count += chunk.length;
    if (count > 20 * 1024 * 1024) throw new Error('pdf_grande_demais');
    chunks.push(chunk);
  }
  const bytes = Buffer.concat(chunks);
  if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('resposta_nao_pdf');
  return bytes;
}

export async function readGuanhaesPdf(url, { fetchImpl = fetch, ocr = true } = {}) {
  const bytes = await downloadGuanhaesPdf(url, fetchImpl);
  const directory = await mkdtemp(path.join(tmpdir(), 'radar-public-pdf-'));
  const file = path.join(directory, 'document.pdf');
  try {
    await writeFile(file, bytes);
    const { stdout } = await exec(process.env.RADAR_PYTHON || 'python',
      [path.join(root, 'scripts/extract-public-pdf.py'), file, ...(ocr ? ['--ocr'] : [])],
      { timeout: 100000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
    return { url, ...JSON.parse(stdout) };
  } finally {
    await unlink(file).catch(e => { if (e.code !== 'ENOENT') throw e; });
    await rmdir(directory);
  }
}

export function alternativeSearchUrl(row) {
  const query = `${words(row.titulo).slice(0, 8).join(' ')} ${numbers(row.titulo).join(' ')} consórcio -site:semana7.com.br`;
  return 'https://news.google.com/rss/search?' + new URLSearchParams({ q: query, hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419' });
}

export async function searchGoogleAlternatives(row, fetchImpl = fetch) {
  const response = await fetchImpl(alternativeSearchUrl(row), { signal: AbortSignal.timeout(12000),
    redirect: 'error', headers: { 'user-agent': 'RadarConsorciosIPEA/0.3 (+pesquisa academica)' } });
  if (!response.ok) throw new Error(`busca_http_${response.status}`);
  let count = 0; const chunks = [];
  for await (const chunk of response.body) {
    count += chunk.length;
    if (count > 2_000_000) throw new Error('busca_grande_demais');
    chunks.push(chunk);
  }
  const data = new XMLParser({ ignoreAttributes: false }).parse(Buffer.concat(chunks).toString());
  if (!data.rss?.channel) throw new Error('busca_nao_rss');
  return array(data.rss.channel.item).slice(0, 12).map(item => ({
    titulo: typeof item.title === 'string' ? item.title : '', url: item.link,
    fonte: item.source?.['#text'] || 'Google Notícias', discoveryDate: item.pubDate,
  })).filter(item => typeof item.url === 'string' && /^https:\/\/news\.google\.com\/rss\/articles\//.test(item.url));
}

export function parsePublicWordpressPosts(data) {
  if (!Array.isArray(data)) throw new Error('wordpress_formato_invalido');
  const plain = html => {
    const $ = load(html || ''); $('script,style,form,nav').remove();
    $('p,li,h1,h2,h3,br').append(' '); return $.text().replace(/\s+/g, ' ').trim();
  };
  return data.filter(post => post.status === 'publish' && post.type === 'post' &&
    host(post.link) === 'rededanoticia.com.br' && !post.content?.protected &&
    typeof post.content?.rendered === 'string').map(post => {
    const date = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(post.date_gmt || '') ? `${post.date_gmt}Z` : '';
    return { titulo: plain(post.title?.rendered), url: post.link, fonte: 'Rede da Notícia',
      data_noticia_original: date, apiReading: { articleUrl: post.link, rawText: plain(post.content.rendered),
        contentProvenance: 'pagina_original', sourcePublishedAt: date, articleReader: 'wordpress_api_publica',
        apiUrl: `https://rededanoticia.com.br/wp-json/wp/v2/posts/${post.id}` } };
  });
}

export async function searchPublicWordpress(row, fetchImpl = fetch) {
  // Official REST link advertised by the publisher; public published posts only.
  const query = ['consórcio', ...numbers(row.titulo), ...words(row.titulo).slice(0, 2)].join(' ');
  const url = 'https://rededanoticia.com.br/wp-json/wp/v2/posts?' + new URLSearchParams({ search: query,
    per_page: '5', status: 'publish', _fields: 'id,link,title,content,date_gmt,status,type' });
  const response = await fetchImpl(url, { redirect: 'error', signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`wordpress_http_${response.status}`);
  const chunks = []; let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length; if (size > 2_000_000) throw new Error('wordpress_grande_demais'); chunks.push(chunk);
  }
  return parsePublicWordpressPosts(JSON.parse(Buffer.concat(chunks).toString()));
}

export async function searchAlternatives(row, fetchImpl = fetch) {
  const providers = ['Google Notícias', 'Rede da Notícia (API pública)'];
  const results = await Promise.allSettled([searchGoogleAlternatives(row, fetchImpl), searchPublicWordpress(row, fetchImpl)]);
  const output = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  output.diagnostics = results.map((r, i) => ({ provider: providers[i], status: r.status === 'fulfilled' ? 'ok' : 'erro',
    count: r.status === 'fulfilled' ? r.value.length : 0, error: r.status === 'rejected' ? r.reason.message : '' }));
  if (results.every(r => r.status === 'rejected')) throw new Error(output.diagnostics.map(d => d.error).join('; '));
  return output;
}

export async function findAlternativeTexts(row, archive, { search = searchAlternatives, read = enrichArticle,
  searchEvenWithArchive = false, now = new Date(), maxReads = 2, storedTexts = new Map() } = {}) {
  const candidates = archive.filter(r => r.id !== row.id && !isSemana7(r)).map(r => ({ ...r, origin: 'acervo' }));
  let searchStatus = 'não necessária: acervo tem candidatos', searchCount = 0, searchDiagnostics = [];
  if (searchEvenWithArchive || !candidates.some(c => compareAlternative(row, c).eligible)) {
    try { const found = await search(row); candidates.push(...found.map(c => ({ ...c, origin: 'busca_web' })));
      searchCount = found.length; searchDiagnostics = found.diagnostics || [];
      searchStatus = searchDiagnostics.some(d => d.status === 'erro') ? 'parcial' : 'ok'; }
    catch (error) { searchStatus = `falha: ${error.message}`; }
  }
  const ranked = candidates.map(c => ({ candidate: c, comparison: compareAlternative(row, c) }))
    .filter(c => c.comparison.eligible).sort((a, b) => Number(Boolean(b.candidate.apiReading)) - Number(Boolean(a.candidate.apiReading)) || b.comparison.score - a.comparison.score);
  const seen = new Set(); const alternatives = []; const attempts = [];
  for (const { candidate, comparison } of ranked) {
    if (attempts.length >= maxReads) break;
    const target = canonicalUrl(candidate.article_url || candidate.url || '');
    if (!target || seen.has(target) || host(target) === 'semana7.com.br') continue;
    seen.add(target);
    const attempt = { url: target, status: 'sem_texto' }; attempts.push(attempt);
    try {
      const stored = storedTexts.get(candidate.id);
      const cacheValid = stored && stored.texto?.length >= 500 && stored.texto_sha256 === digest(stored.texto) &&
        alternativeSourceKey(stored.url_artigo) === alternativeSourceKey(target);
      // A verified full reading can be reused; never use an archive snippet as a body.
      const article = candidate.apiReading || (cacheValid ? { articleUrl: stored.url_artigo, rawText: stored.texto,
        articleReader: stored.leitor, contentProvenance: 'pagina_original', reusedFrom: stored.recuperado_em,
        sourcePublishedAt: candidate.data_noticia_original || '' } : await read({ kind: 'news', title: candidate.titulo, url: target,
        source: candidate.fonte, summary: '', rawText: '' }, { onFailure: (_, reason) => { attempt.status = reason; } }));
      if (article.contentProvenance !== 'pagina_original' || (article.rawText || '').length < 500 ||
          !/cons[oó]rcio/i.test(article.rawText) || !article.articleUrl ||
          ['semana7.com.br', 'news.google.com'].includes(host(article.articleUrl))) continue;
      if (alternatives.some(a => alternativeSourceKey(a.url_fonte) === alternativeSourceKey(article.articleUrl))) {
        attempt.status = 'variante_da_mesma_publicacao'; continue;
      }
      const confirmedComparison = compareAlternative(row, { ...candidate, sourcePublishedAt: article.sourcePublishedAt });
      if (!confirmedComparison.eligible) { attempt.status = 'datas_ou_conteudo_divergentes'; continue; }
      const body = redactPublicText(article.rawText);
      // Require the candidate's distinctive title terms to actually appear in the body.
      if (comparison.shared.filter(w => normal(body).includes(w)).length < 4) {
        attempt.status = 'corpo_nao_corresponde_ao_titulo'; continue;
      }
      const sourceUrl = canonicalUrl(article.articleUrl);
      alternatives.push({ id: digest(`${row.id}|${alternativeSourceKey(sourceUrl)}`), documento_id: row.id,
        url_original_bloqueada: row.article_url || row.article_resolved_url || row.url,
        documento_fonte_id: candidate.id || '', url_fonte: sourceUrl, titulo_fonte: candidate.titulo,
        fonte: candidate.fonte, origem_descoberta: candidate.origin, recuperado_em: now.toISOString(),
        data_fonte: article.sourcePublishedAt || candidate.data_noticia_original || '',
        leitor: article.articleReader, texto: body, texto_sha256: digest(body),
        api_url: article.apiUrl || '', leitura_preservada_em: article.reusedFrom || '',
        comparacao: confirmedComparison, equivalencia_confirmada: false,
        situacao: 'texto_alternativo_para_conferencia',
        independencia: /semana\s*7/i.test(body) ? 'cita Semana 7; não é confirmação independente' : 'não verificada' });
      attempt.status = 'texto_alternativo_recuperado';
    } catch (error) { attempt.status = `falha: ${error.message}`; }
  }
  if (!alternatives.length && !searchEvenWithArchive && searchStatus.startsWith('não necessária')) {
    // An archive URL may now be blocked. Search independently instead of retrying
    // that same dead end forever; retain the original failed attempts in the audit.
    const fallback = await findAlternativeTexts(row, [], { search, read, searchEvenWithArchive: true, now, maxReads: 1, storedTexts });
    return { ...fallback, attempts: [...attempts, ...fallback.attempts] };
  }
  return { alternatives, attempts, searchStatus, searchCount, searchDiagnostics };
}

export function completePdfText(row, result, now = new Date()) {
  if (!result.completo || result.paginas_pendentes?.length || !result.paginas?.length) return null;
  const texto = redactPublicText(result.paginas.map(p => `[Página ${p.pagina}]\n${p.texto}`).join('\n\n'));
  if (texto.length < 100) return null;
  return { documento_id: row.id, url_original: row.url, url_artigo: result.url,
    recuperado_em: now.toISOString(), leitor: result.ocr_paginas ? 'pdf_paginas_ocr_seletivo' : 'pdf_paginas_pypdf',
    texto_sha256: digest(texto), texto, pdf_sha256: result.pdf_sha256 };
}
