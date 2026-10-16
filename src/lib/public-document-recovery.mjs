import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { XMLParser } from 'fast-xml-parser';
import { canonicalUrl } from './dedupe.mjs';
import { redactPublicText } from './article-text-store.mjs';
import { enrichArticle } from './article-enrichment.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../../', import.meta.url));
const normal = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const stop = new Set('consorcio consorcios intermunicipal intermunicipais saude para pelo pela pelos pelas sobre noticia noticias semana mais esta este entre com dos das uma regio regiao regional prefeitura municipio municipios municipal publica publico noticia'.split(' '));
const words = s => [...new Set(normal(String(s).split(/\s+-\s+/)[0]).match(/[a-z]{4,}/g) || [])].filter(w => !stop.has(w));
const numbers = s => [...new Set((normal(String(s).split(/\s+-\s+/)[0]).match(/\b\d+\b/g) || []).filter(n => n.length < 4))];
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

// This is a candidate retrieval score, NEVER a duplicate/event/identity decision.
export function compareAlternative(original, candidate) {
  const a = words(original.titulo || original.title), b = words(candidate.titulo || candidate.title);
  const shared = a.filter(w => b.includes(w));
  const originalNumbers = numbers(original.titulo || original.title);
  const candidateNumbers = numbers(candidate.titulo || candidate.title);
  const numberConflict = originalNumbers.some(n => !candidateNumbers.includes(n)) ||
    candidateNumbers.some(n => !originalNumbers.includes(n));
  const negative = title => /\b(nao|nega|negou|boato|desmente|desmentiu|suposto|possivel|proposta|projeto)\b/.test(normal(title));
  const statusConflict = negative(original.titulo || original.title) !== negative(candidate.titulo || candidate.title);
  // Only original-page dates are used to assert temporal proximity, never Google indexing dates.
  const dates = [original.sourcePublishedAt || original.data_noticia_original,
    candidate.sourcePublishedAt || candidate.data_noticia_original].map(Date.parse);
  const dateVerified = dates.every(Number.isFinite);
  const dateConflict = dateVerified && Math.abs(dates[0] - dates[1]) > 7 * 86400000;
  const score = shared.length / Math.max(1, a.length);
  return { eligible: a.length >= 4 && shared.length >= 4 && score >= .7 && !numberConflict && !statusConflict && !dateConflict,
    shared, score, numberConflict, statusConflict, dateConflict, dateVerified,
    equivalenceConfirmed: false };
}

export function alternativeSearchUrl(row) {
  const query = `${words(row.titulo).slice(0, 8).join(' ')} ${numbers(row.titulo).join(' ')} consórcio -site:semana7.com.br`;
  return 'https://news.google.com/rss/search?' + new URLSearchParams({ q: query, hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419' });
}

export async function searchAlternatives(row, fetchImpl = fetch) {
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

export async function findAlternativeTexts(row, archive, { search = searchAlternatives, read = enrichArticle,
  searchEvenWithArchive = false, now = new Date(), maxReads = 2 } = {}) {
  const candidates = archive.filter(r => r.id !== row.id && !isSemana7(r)).map(r => ({ ...r, origin: 'acervo' }));
  let searchStatus = 'não necessária: acervo tem candidatos', searchCount = 0;
  if (searchEvenWithArchive || !candidates.some(c => compareAlternative(row, c).eligible)) {
    try { const found = await search(row); candidates.push(...found.map(c => ({ ...c, origin: 'busca_web' })));
      searchCount = found.length; searchStatus = 'ok'; }
    catch (error) { searchStatus = `falha: ${error.message}`; }
  }
  const ranked = candidates.map(c => ({ candidate: c, comparison: compareAlternative(row, c) }))
    .filter(c => c.comparison.eligible).sort((a, b) => b.comparison.score - a.comparison.score);
  const seen = new Set(); const alternatives = []; const attempts = [];
  for (const { candidate, comparison } of ranked) {
    if (attempts.length >= maxReads) break;
    const target = canonicalUrl(candidate.article_url || candidate.url || '');
    if (!target || seen.has(target) || host(target) === 'semana7.com.br') continue;
    seen.add(target);
    const attempt = { url: target, status: 'sem_texto' }; attempts.push(attempt);
    try {
      // Always fetch body; a stored snippet can never short-circuit this reading.
      const article = await read({ kind: 'news', title: candidate.titulo, url: target,
        source: candidate.fonte, summary: '', rawText: '' });
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
        comparacao: confirmedComparison, equivalencia_confirmada: false,
        situacao: 'texto_alternativo_para_conferencia',
        independencia: /semana\s*7/i.test(body) ? 'cita Semana 7; não é confirmação independente' : 'não verificada' });
      attempt.status = 'texto_alternativo_recuperado';
    } catch (error) { attempt.status = `falha: ${error.message}`; }
  }
  if (!alternatives.length && !searchEvenWithArchive && searchStatus.startsWith('não necessária')) {
    // An archive URL may now be blocked. Search independently instead of retrying
    // that same dead end forever; retain the original failed attempts in the audit.
    const fallback = await findAlternativeTexts(row, [], { search, read, searchEvenWithArchive: true, now, maxReads: 1 });
    return { ...fallback, attempts: [...attempts, ...fallback.attempts] };
  }
  return { alternatives, attempts, searchStatus, searchCount };
}

export function completePdfText(row, result, now = new Date()) {
  if (!result.completo || result.paginas_pendentes?.length || !result.paginas?.length) return null;
  const texto = redactPublicText(result.paginas.map(p => `[Página ${p.pagina}]\n${p.texto}`).join('\n\n'));
  if (texto.length < 100) return null;
  return { documento_id: row.id, url_original: row.url, url_artigo: result.url,
    recuperado_em: now.toISOString(), leitor: result.ocr_paginas ? 'pdf_paginas_ocr_seletivo' : 'pdf_paginas_pypdf',
    texto_sha256: digest(texto), texto, pdf_sha256: result.pdf_sha256 };
}
