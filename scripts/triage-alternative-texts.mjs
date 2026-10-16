// Decisions are a separate layer. Never write original texts, human reviews or WhatsApp state.
import { writeFile, mkdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ALTERNATIVE_TRIAGE_VERSION, ALTERNATIVE_TRIAGE_FROM, sha, originalFingerprint,
  eligibleAlternativeOriginal, alternativeInput, reviewAlternative, validateAlternativeAnswer,
  readAlternativeRows, validAlternativeDecision, alternativeUrlKey } from '../src/lib/alternative-triage.mjs';

function key(row, sources) {
  return sha(JSON.stringify([originalFingerprint(row), sources.map(s => [s.id, s.texto_sha256,
    s.titulo_fonte, s.url_fonte, s.data_fonte || '', s.comparacao]).sort(), ALTERNATIVE_TRIAGE_VERSION]));
}

export async function decideWithAlternatives(row, sources, { apiKey, review = reviewAlternative,
  now = new Date(), archive = [], reviews = [], priorDecisions = [], takeCall = () => true } = {}) {
  const record = { documento_id: row.id, version: ALTERNATIVE_TRIAGE_VERSION,
    originalHash: originalFingerprint(row), inputHash: key(row, sources), reviewedAt: now.toISOString(),
    sources: sources.map(s => ({ id: s.id, hash: s.texto_sha256 })), status: 'pendente',
    reason: '', calls: 0, checks: [], usage: { prompt_tokens: 0, completion_tokens: 0 } };
  if (!sources.length || sources.length > 2) return { ...record, reason: 'Quantidade de fontes fora do limite de conferência; não ignorar possíveis conflitos.' };
  for (const source of sources) {
    const { input, rule, error } = alternativeInput(row, source);
    if (error) { record.checks.push({ sourceId: source.id, status: 'pendente', reason: error }); continue; }
    if (!takeCall()) { record.checks.push({ sourceId: source.id, status: 'pendente', reason: 'Limite de chamadas; não decidir sem revisão.' }); continue; }
    record.calls++;
    try {
      const result = await review(input, { apiKey });
      record.usage.prompt_tokens += result.usage?.prompt_tokens || 0;
      record.usage.completion_tokens += result.usage?.completion_tokens || 0;
      record.checks.push({ sourceId: source.id, sourceUrl: source.url_fonte, sourceHash: source.texto_sha256,
        model: result.model, ruleCategory: rule.category, ...validateAlternativeAnswer(row, source, rule, result.answer) });
    } catch (error) {
      record.checks.push({ sourceId: source.id, status: 'pendente', reason: `Revisão indisponível: ${error.message.slice(0, 180)}` });
    }
  }
  const pending = record.checks.find(c => c.status === 'pendente');
  if (pending) return { ...record, reason: pending.reason };
  const first = record.checks[0];
  if (record.checks.some(c => c.status !== first.status || c.category !== first.category))
    return { ...record, reason: 'Fontes com decisões divergentes; não aceitar nem descartar automaticamente.' };
  Object.assign(record, { ...first, model: first.model || 'deepseek-flash' });
  if (record.status === 'descartado') return record;
  const owner = priorDecisions.find(d => d.documento_id !== row.id && ['aceito', 'duplicata'].includes(d.status) &&
    d.checks?.some(c => sources.some(s => alternativeUrlKey(s.url_fonte) === alternativeUrlKey(c.sourceUrl) && s.texto_sha256 === c.sourceHash)));
  if (owner) return { ...record, status: 'duplicata', category: 'GERAL', score: 0,
    relatedDocumentId: owner.relatedDocumentId || owner.documento_id,
    reason: `Mesmo episódio já representado pelo registro ${owner.relatedDocumentId || owner.documento_id}. ${record.reason}` };
  // Exact source association is not a second event. Prefer the existing owner,
  // even if it still awaits review; never promote both URLs in the same pass.
  const related = archive.filter(other => other.id !== row.id &&
    [other.url, other.article_url, other.article_resolved_url].filter(Boolean).some(url =>
      sources.some(s => alternativeUrlKey(s.url_fonte) === alternativeUrlKey(url))))
    .sort((a, b) => String(a.primeira_coleta).localeCompare(String(b.primeira_coleta)))[0];
  if (related) {
    const review = reviews.find(r => r.documento_id === related.id && r.trecho_sha256 === sha(related.trecho || ''));
    const accepted = review ? ['confirmar_evento', 'corrigir_categoria'].includes(review.decisao) : related.decisao_base === 'confirmado';
    if (accepted && record.status === 'aceito') return { ...record, status: 'duplicata', category: 'GERAL', score: 0,
      relatedDocumentId: related.id, reason: `Mesmo episódio da fonte já aceita (${related.titulo}). ${record.reason}` };
    return { ...record, status: 'pendente', relatedDocumentId: related.id,
      reason: 'A fonte alternativa já tem um registro próprio; conferir a decisão desse registro antes de contar outro fato.' };
  }
  return record;
}

async function atomicJsonl(file, rows) {
  const tmp = `${file}.tmp`;
  await writeFile(tmp, rows.map(JSON.stringify).join('\n') + '\n');
  await rename(tmp, file);
}

export async function triageAlternativeTexts({ directory = 'data/catalogo', apply = false,
  now = new Date(), apiKey = process.env.DEEPSEEK_API_KEY, review = reviewAlternative,
  cutoff = ALTERNATIVE_TRIAGE_FROM, maxDocuments = 2, maxCallsRun = 4, maxCallsDay = 12 } = {}) {
  const [archive, sources, reviews, stored, usage] = await Promise.all([
    readAlternativeRows(directory, 'arquivo-coletas.ndjson'), readAlternativeRows(directory, 'fontes-alternativas.ndjson'),
    readAlternativeRows(directory, 'revisoes-eventos.ndjson'), readAlternativeRows(directory, 'triagem-fontes-alternativas.ndjson'),
    readAlternativeRows(directory, 'triagem-alternativa-uso.ndjson'),
  ]);
  const reviewedIds = new Set(reviews.map(r => r.documento_id));
  const decisions = new Map(stored.map(r => [r.documento_id, r]));
  const byDocument = new Map();
  for (const source of sources) {
    if (!byDocument.has(source.documento_id)) byDocument.set(source.documento_id, []);
    // Deduplication of the recovery store is also enforced here before billing.
    if (!byDocument.get(source.documento_id).some(s => s.id === source.id || alternativeUrlKey(s.url_fonte) === alternativeUrlKey(source.url_fonte)))
      byDocument.get(source.documento_id).push(source);
  }
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  let dayCalls = usage.filter(u => u.day === day).reduce((sum, u) => sum + u.calls, 0), calls = 0;
  const selected = archive.filter(row => {
    if (!eligibleAlternativeOriginal(row, reviewedIds, cutoff) || !byDocument.has(row.id)) return false;
    const previous = decisions.get(row.id), alternatives = byDocument.get(row.id);
    if (!previous || previous.inputHash !== key(row, alternatives) || !validAlternativeDecision(row, previous, sources, reviewedIds, cutoff)) return true;
    return previous.status === 'pendente' && Date.parse(previous.reviewedAt) + 86400000 <= now.getTime();
  }).sort((a, b) => String(a.primeira_coleta).localeCompare(String(b.primeira_coleta)) || a.id.localeCompare(b.id)).slice(0, maxDocuments);
  const results = [];
  if (selected.length && !apiKey) return { attempted: 0, calls: 0, results, reason: 'DEEPSEEK_API_KEY ausente; sem decisões novas.' };
  for (const row of selected) {
    if (calls >= maxCallsRun || dayCalls >= maxCallsDay) break;
    const priorDecisions = [...decisions.values()].filter(d => {
      const original = archive.find(r => r.id === d.documento_id);
      return original && validAlternativeDecision(original, d, sources, reviewedIds, cutoff);
    });
    const result = await decideWithAlternatives(row, byDocument.get(row.id), { apiKey, review, now, archive, reviews, priorDecisions,
      takeCall: () => { if (calls >= maxCallsRun || dayCalls >= maxCallsDay) return false; calls++; dayCalls++; return true; } });
    if (!validAlternativeDecision(row, result, sources, reviewedIds, cutoff)) {
      // Corrupt/unreadable input is an operational diagnostic, not a decision.
      console.warn(`[triagem-alternativa] ${row.id.slice(0, 8)}: integridade inválida; nenhuma decisão gravada.`);
      continue;
    }
    decisions.set(row.id, result); results.push(result);
    console.log(`[triagem-alternativa] ${row.id.slice(0, 8)}: ${result.status} — ${result.reason}`);
  }
  if (apply && (results.length || calls)) {
    await mkdir(directory, { recursive: true });
    if (calls) await atomicJsonl(path.join(directory, 'triagem-alternativa-uso.ndjson'),
      [...usage.filter(u => Date.parse(u.at) > now.getTime() - 32 * 86400000), { day, at: now.toISOString(), calls }]);
    if (results.length) await atomicJsonl(path.join(directory, 'triagem-fontes-alternativas.ndjson'), [...decisions.values()]);
  }
  return { attempted: results.length, calls, dayCalls, results, apply };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const result = await triageAlternativeTexts({ apply: process.argv.includes('--apply') });
  console.log(JSON.stringify({ ...result, results: result.results.map(r => ({ id: r.documento_id, status: r.status, reason: r.reason })) }));
  if (process.argv.includes('--apply') && result.results.length) {
    const { loadCatalog, saveCatalog } = await import('../src/lib/catalog.mjs');
    await saveCatalog('data/catalogo', await loadCatalog('data/catalogo/arquivo-coletas.ndjson'));
  }
}
