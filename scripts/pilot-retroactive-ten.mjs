// Read-only pilot: fixed ten originals; output never goes into data/ or state/.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyItem } from '../src/lib/classifier.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const IDS = ['29164a2c', '574658e3', '78bf95a4', '928d130d', 'aa73f21b',
  'aadee687', 'c385fb9c', 'd7b90a6e', 'd8eabab4', 'e8a5daf6'];
const hash = value => createHash('sha256').update(value).digest('hex');
const exec = promisify(execFile);
const readRows = async name => (await readFile(path.join(root, 'data/catalogo', name), 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);

export async function protectedSnapshot() {
  const result = {};
  async function visit(dir) {
    for (const item of await readdir(path.join(root, dir), { withFileTypes: true })) {
      const relative = path.join(dir, item.name);
      if (item.isDirectory()) await visit(relative);
      else if (item.isFile()) result[relative] = hash(await readFile(path.join(root, relative)));
    }
  }
  await visit('data'); await visit('state');
  return result;
}

async function download(url) {
  const origin = new URL(url).origin;
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const response = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(35000),
      headers: { 'user-agent': 'RadarConsorcios/1.0 (public document research)', accept: 'application/pdf' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      current = new URL(response.headers.get('location'), current).href;
      if (new URL(current).origin !== origin) throw new Error('Redirecionamento para outra origem requer revisão');
      continue;
    }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const chunks = []; let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 20 * 1024 * 1024) { await response.body.cancel().catch(() => {}); throw new Error('PDF acima de 20 MiB'); }
      chunks.push(chunk);
    }
    const bytes = Buffer.concat(chunks);
    if (bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('Resposta não é PDF');
    return { bytes, url: current };
  }
  throw new Error('Redirecionamentos demais');
}

export function duplicateOwner(rows, current) {
  // Byte identity, not similar titles: PDFs may share a misleading search title.
  return rows.find(r => r.extraction?.pdf_sha256 && r.extraction.pdf_sha256 === current.extraction?.pdf_sha256)?.id || '';
}

export async function runPilot() {
  if (process.argv.includes('--apply')) throw new Error('Este piloto não oferece modo de aplicação');
  const before = await protectedSnapshot();
  const out = path.join(root, 'output/retroactive-ten');
  await mkdir(out, { recursive: true });
  const archive = await readRows('arquivo-coletas.ndjson');
  const reviews = new Set((await readRows('revisoes-eventos.ndjson')).map(r => r.documento_id));
  const pdfs = new Map((await readRows('recuperacao-pdf-google.ndjson')).map(r => [r.documento_id, r]));
  const selected = IDS.map(prefix => {
    const matches = archive.filter(r => r.id.startsWith(prefix));
    if (matches.length !== 1) throw new Error(`ID ambíguo/ausente ${prefix}`);
    const row = matches[0];
    if (reviews.has(row.id) || row.enviado_em || row.parent_document_id) throw new Error(`Registro protegido ${prefix}`);
    const url = pdfs.get(row.id)?.url_pdf;
    if (!url || !url.startsWith('https://')) throw new Error(`PDF ausente ${prefix}`);
    return { row, url };
  });
  const results = [];
  try {
    for (const { row, url } of selected) {
      const id = row.id, prefix = id.slice(0, 8);
      const result = { id, original_url: row.url, recovered_url: url, source_kind: 'original_pdf',
        before: { title: row.titulo, snippet: row.trecho, category: row.tipo_evento,
          reason: row.situacao_analise, published: row.data_publicacao, first_seen: row.primeira_coleta },
        original_sha256: hash(JSON.stringify(row)), recovered_at: new Date().toISOString() };
      try {
        const pdfPath = path.join(out, prefix + '.pdf');
        if (!process.argv.includes('--cached')) {
          let pdf;
          try { pdf = await download(url); }
          catch { pdf = await download(url); } // One bounded retry; no bypass of access controls.
          await writeFile(pdfPath, pdf.bytes);
          result.recovered_url = pdf.url;
        }
        const args = [path.join(root, 'scripts/extract-public-pdf.py'), pdfPath, '--ocr'];
        // Unaí native font map is visibly corrupt; explicit pilot exception, not text substitution.
        if (prefix === 'd8eabab4') args.push('--force-ocr-pages', '1');
        const { stdout } = await exec('python', args,
          { timeout: 300000, maxBuffer: 12 * 1024 * 1024, encoding: 'utf8', env: { ...process.env, PYTHONUTF8: '1' } });
        result.extraction = JSON.parse(stdout);
        result.full_text = result.extraction.paginas.map(p => `[Página ${p.pagina}]\n${p.texto}`).join('\n\n');
        result.rule_after = classifyItem({ title: row.titulo, snippet: result.full_text, rawText: result.full_text,
          url, source: row.fonte, kind: 'news', publishedAt: row.data_publicacao });
        result.duplicate_of = duplicateOwner(results, result);
      } catch (error) { result.error = error.message.slice(0, 300); }
      results.push(result);
      await writeFile(path.join(out, prefix + '.json'), JSON.stringify(result, null, 2));
      console.log(`${prefix}: ${result.error || `${result.extraction.paginas.length} páginas; completo=${result.extraction.completo}; duplicata=${result.duplicate_of.slice(0, 8) || 'não'}`}`);
    }
  } finally {
    const after = await protectedSnapshot();
    const unchanged = JSON.stringify(before) === JSON.stringify(after);
    await writeFile(path.join(out, 'report.json'), JSON.stringify({ mode: 'read_only_pilot',
      created_at: new Date().toISOString(), protected_files: Object.keys(before).length,
      production_unchanged: unchanged, whatsapp_calls: 0, results }, null, 2));
    if (!unchanged) throw new Error('Arquivos protegidos mudaram durante o piloto; não atribuir segurança ao ensaio');
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await runPilot();
