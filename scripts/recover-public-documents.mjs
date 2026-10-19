// Supplemental recovery only: no classifier, event writes or messaging imports.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isSemana7, isCnm, isAraguaia, isGuanhaesPdf, readGuanhaesPdf, findAlternativeTexts,
  completePdfText } from '../src/lib/public-document-recovery.mjs';
import { recoveryDelayMs, attachRecoveredText } from '../src/lib/recovery-policy.mjs';

async function rows(file, optional = false) {
  try { return (await readFile(file, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse); }
  catch (error) { if (optional && error.code === 'ENOENT') return []; throw error; }
}
async function save(file, data) {
  await writeFile(file, data.map(JSON.stringify).join('\n') + '\n', 'utf8');
}

export async function recoverPublicDocuments({ directory = 'data/catalogo', apply = false, limit = 2,
  now = new Date(), readPdf = readGuanhaesPdf, alternatives = findAlternativeTexts, budgetMs = 150000 } = {}) {
  const archiveFile = path.join(directory, 'arquivo-coletas.ndjson');
  const textFile = path.join(directory, 'textos-artigos.ndjson');
  const auditFile = path.join(directory, 'recuperacao-fontes-publicas.ndjson');
  const alternateFile = path.join(directory, 'fontes-alternativas.ndjson');
  const archive = await rows(archiveFile);
  const texts = new Map((await rows(textFile, true)).map(row => [row.documento_id, row]));
  const audits = new Map((await rows(auditFile, true)).map(row => [row.documento_id, row]));
  const alternativesSaved = new Map((await rows(alternateFile, true)).map(row => [row.id, row]));
  const selected = archive.filter(row => {
    if (texts.has(row.id)) return false; // Never replace an original or an assisted recovery.
    if (!isSemana7(row) && !isCnm(row) && !isAraguaia(row) && !isGuanhaesPdf(row.article_url || row.url)) return false;
    if ([...alternativesSaved.values()].some(a => a.documento_id === row.id)) return false;
    const last = audits.get(row.id);
    return !last || !last.proxima_tentativa || Date.parse(last.proxima_tentativa) <= now.getTime();
  }).sort((a, b) => (audits.get(a.id)?.tentado_em || '').localeCompare(audits.get(b.id)?.tentado_em || ''))
    .slice(0, limit);
  let attempted = 0, stored = 0, alternateCount = 0;
  const started = Date.now();
  for (const row of selected) {
    if (Date.now() - started >= budgetMs) break;
    attempted++;
    const previous = audits.get(row.id);
    const attempts = Number(previous?.tentativas || 0) + 1;
    const audit = { documento_id: row.id, tentado_em: now.toISOString(), tentativas: attempts,
      proxima_tentativa: new Date(now.getTime() + recoveryDelayMs(attempts)).toISOString() };
    try {
      if (isGuanhaesPdf(row.article_url || row.url)) {
        const result = await readPdf(row.article_url || row.url);
        Object.assign(audit, result, { situacao: result.completo ? 'texto_integral_recuperado' : 'leitura_parcial' });
        const text = completePdfText(row, result, now);
        if (text) {
          texts.set(row.id, text);
          Object.assign(row, attachRecoveredText(row, text));
          audit.proxima_tentativa = ''; stored++;
        }
      } else {
        const result = await alternatives(row, archive, { now, storedTexts: texts });
        for (const entry of result.alternatives) {
          if (!alternativesSaved.has(entry.id)) { alternativesSaved.set(entry.id, entry); alternateCount++; }
        }
        Object.assign(audit, { situacao: result.alternatives.length ? 'texto_alternativo_para_conferencia' : 'sem_alternativa_verificada',
          busca: result.searchStatus, resultados_busca: result.searchCount, provedores: result.searchDiagnostics || [],
          tentativas_fontes: result.attempts, alternativas: result.alternatives.map(a => a.id) });
        // No substitution in textos-artigos: a different publisher is a different source.
      }
    } catch (error) { audit.situacao = `falha: ${error.message.slice(0, 180)}`; }
    audits.set(row.id, audit);
    console.log(`[recuperacao-publica] ${row.id.slice(0, 8)}: ${audit.situacao}`);
  }
  if (apply && attempted) {
    await mkdir(directory, { recursive: true });
    await save(auditFile, [...audits.values()]);
    if (stored) { await save(textFile, [...texts.values()]); await save(archiveFile, archive); }
    if (alternateCount) await save(alternateFile, [...alternativesSaved.values()]);
  }
  const result = { attempted, completePdfs: stored, alternativeTexts: alternateCount, apply };
  console.log(JSON.stringify(result));
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await recoverPublicDocuments({ apply: process.argv.includes('--apply') });
}
