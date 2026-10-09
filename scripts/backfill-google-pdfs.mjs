// Recupera PDFs descobertos por Google News e guarda prova curta por página.
// Não conclui eventos, não altera decisões editoriais e não envia mensagens.
import { mkdtemp, readFile, rmdir, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import googleNewsDecoder from 'google-news-url-decoder';
import { loadCatalog, saveCatalog } from '../src/lib/catalog.mjs';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'data', 'catalogo');
const output = path.join(directory, 'recuperacao-pdf-google.ndjson');
const apply = process.argv.includes('--apply');
const retryFailed = process.argv.includes('--retry-failed');
const limit = Math.min(30, Math.max(1, Number(process.argv.find((value) => value.startsWith('--limit='))?.split('=')[1] || 15)));
const { GoogleDecoder } = googleNewsDecoder;
const decoder = new GoogleDecoder();
const records = await loadCatalog(path.join(directory, 'arquivo-coletas.ndjson'));
const reviews = (await readFile(path.join(directory, 'revisoes-eventos.ndjson'), 'utf8'))
  .split(/\r?\n/).filter(Boolean).map(JSON.parse);
const reviewedIds = new Set(reviews.map((row) => row.documento_id));
let previous = [];
try { previous = (await readFile(output, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const existing = new Map(previous.map((row) => [row.documento_id, row]));

function publicUrl(raw) {
  try {
    const value = new URL(raw);
    if (!['http:', 'https:'].includes(value.protocol)) return '';
    const host = value.hostname.toLowerCase();
    if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.localhost') ||
      /^(?:127\.|10\.|192\.168\.|169\.254\.|0\.|\[?::1\]?$|fc|fd|fe80)/.test(host) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(host)) return '';
    return value.href;
  } catch { return ''; }
}

async function fetchPdf(url) {
  let current = url;
  for (let hop = 0; hop < 4; hop += 1) {
    const response = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(20000),
      headers: { 'user-agent': 'RadarConsorciosIPEA/0.3 (+pesquisa acadêmica)', accept: 'application/pdf' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      current = publicUrl(new URL(response.headers.get('location') || '', current).href);
      if (!current) throw new Error('redirecionamento_inseguro');
      continue;
    }
    if (!response.ok) throw new Error(`http_${response.status}`);
    if (Number(response.headers.get('content-length') || 0) > 25 * 1024 * 1024) throw new Error('pdf_grande_demais');
    const chunks = []; let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > 25 * 1024 * 1024) throw new Error('pdf_grande_demais');
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    if (buffer.subarray(0, 5).toString() !== '%PDF-') throw new Error('resposta_nao_pdf');
    return { buffer, url: current };
  }
  throw new Error('redirecionamentos_demais');
}

const selected = [...records.values()].filter((row) =>
  !reviewedIds.has(row.id) &&
  (['destino_pdf', 'destino_nao_html'].includes(row.article_recovery_reason) ||
    (retryFailed && row.article_recovery_reason?.startsWith('falha:'))) &&
  (!existing.has(row.id) || (retryFailed && existing.get(row.id).situacao?.startsWith('falha:') &&
    Number(existing.get(row.id).tentativas || 1) < 3 &&
    Date.now() - new Date(existing.get(row.id).tentado_em || 0).getTime() > 24 * 3600000)) &&
  /^https:\/\/news\.google\.com\//.test(row.url)).slice(0, limit);
const results = [];
for (const [index, row] of selected.entries()) {
  const result = { documento_id: row.id, url: row.url, url_pdf: '',
    situacao: '', paginas: 0, trechos: [], paginas_ocr_pendente: [],
    tentado_em: new Date().toISOString(), tentativas: Number(existing.get(row.id)?.tentativas || 0) + 1 };
  let temporary = '';
  try {
    const decoded = await decoder.decode(row.url);
    const target = publicUrl(decoded?.decoded_url);
    if (!decoded?.status || !target) throw new Error('google_news_nao_resolvido');
    const pdf = await fetchPdf(target);
    result.url_pdf = pdf.url;
    temporary = await mkdtemp(path.join(tmpdir(), 'radar-google-pdf-'));
    const pdfFile = path.join(temporary, 'source.pdf');
    await writeFile(pdfFile, pdf.buffer);
    const { stdout } = await execFileAsync('python', [path.join(root, 'scripts', 'pdf-page-evidence.py'), pdfFile],
      { cwd: root, timeout: 180000, maxBuffer: 5 * 1024 * 1024 });
    Object.assign(result, JSON.parse(stdout));
    result.situacao = result.trechos.length ? 'trechos por página recuperados'
      : result.paginas_ocr_pendente.length ? 'ocr_pendente' : 'sem menção textual';
    console.log(`[pdf ${index + 1}/${selected.length}] ${row.id.slice(0, 8)}: ${result.situacao}; ${result.trechos.length} trechos`);
  } catch (error) {
    result.situacao = `falha: ${error.message.slice(0, 140)}`;
    console.log(`[pdf ${index + 1}/${selected.length}] ${row.id.slice(0, 8)}: ${result.situacao}`);
  } finally {
    if (temporary) {
      await unlink(path.join(temporary, 'source.pdf')).catch((error) => { if (error.code !== 'ENOENT') throw error; });
      await rmdir(temporary);
    }
  }
  results.push(result);
  if (apply) records.set(row.id, { ...row, article_url: result.url_pdf || row.article_url || '',
    article_recovery_reason: result.situacao === 'trechos por página recuperados' ? '' : result.situacao });
}
console.log(`[pdf] ${selected.length} documento(s) selecionado(s); ${results.filter((row) => row.trechos.length).length} com trechos recuperados.`);
if (apply && results.length) {
  for (const row of results) existing.set(row.documento_id, row);
  await writeFile(output, [...existing.values()].map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
  await saveCatalog(directory, records);
  console.log('[pdf] Provas por página salvas; nenhum evento confirmado automaticamente.');
}
