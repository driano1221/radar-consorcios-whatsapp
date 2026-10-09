import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, saveCatalog } from '../src/lib/catalog.mjs';
import { classifyItem } from '../src/lib/classifier.mjs';
import { enrichArticles, lacksArticleText } from '../src/lib/article-enrichment.mjs';
import { redactPublicText } from '../src/lib/article-text-store.mjs';
import { contentQuality } from './build-dashboard.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'data', 'catalogo');
const apply = process.argv.includes('--apply');
const includeSent = process.argv.includes('--include-sent');
const reclassify = process.argv.includes('--reclassify');
const demote = process.argv.includes('--demote');
const force = process.argv.includes('--force');
const titleOnlyGoogle = process.argv.includes('--title-only-google');
const retryFailed = process.argv.includes('--retry-failed');
const limit = Math.min(60, Math.max(1, Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 20)));
const requestedId = process.argv.find((arg) => arg.startsWith('--id='))?.split('=')[1] || '';
const requestedIds = process.argv.find((arg) => arg.startsWith('--ids='))?.slice('--ids='.length)
  .split(',').map((id) => id.trim()).filter(Boolean) || [];
if (force && !requestedId && !requestedIds.length) throw new Error('--force exige --id ou --ids');
const records = await loadCatalog(path.join(directory, 'arquivo-coletas.ndjson'));
let alternateUrls = [];
try { alternateUrls = (await readFile(path.join(directory, 'urls-recuperacao.ndjson'), 'utf8'))
  .split(/\r?\n/).filter(Boolean).map(JSON.parse); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const alternateById = new Map(alternateUrls.filter((row) => row.documento_id && /^https:\/\//.test(row.url || ''))
  .map((row) => [row.documento_id, row.url]));
const textFile = path.join(directory, 'textos-artigos.ndjson');
let storedTexts = [];
try { storedTexts = (await readFile(textFile, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const textById = new Map(storedTexts.map((row) => [row.documento_id, row]));
const attemptedAt = new Date().toISOString();
const reviews = (await readFile(path.join(directory, 'revisoes-eventos.ndjson'), 'utf8'))
  .split(/\r?\n/).filter(Boolean).map(JSON.parse);
const reviewed = new Set(reviews.map((row) => row.documento_id));
const candidates = [...records.values()].filter((row) => !reviewed.has(row.id) &&
  !textById.has(row.id) &&
  (!requestedId || row.id.startsWith(requestedId)) &&
  (!requestedIds.length || requestedIds.some((id) => row.id.startsWith(id))) &&
  (includeSent || !row.enviado_em) && row.fonte !== 'Querido Diário' &&
  (force || Number(row.article_attempts || 0) < (retryFailed ? 4 : 3)) &&
  (force || !row.article_attempted_at || Date.now() - new Date(row.article_attempted_at).getTime() > 12 * 3600000) &&
  lacksArticleText({ title: row.titulo, summary: row.trecho }) &&
  (!titleOnlyGoogle || (row.tipo_evento === 'GERAL' &&
    /^https:\/\/news\.google\.com\//.test(row.url) && contentQuality(row.titulo, row.trecho) !== 'trecho_disponivel')) &&
  ((requestedId || requestedIds.length) ||
    titleOnlyGoogle || /cons[oó]rc|rateio|protocolo de inten[cç][oõ]es|ades[aã]o|desligamento|retirada/i.test(row.titulo)))
  .sort((a, b) => Number(/ades[aã]o|ingresso|ratifica|cria[cç][aã]o|retirada|desligamento/i.test(b.titulo)) -
    Number(/ades[aã]o|ingresso|ratifica|cria[cç][aã]o|retirada|desligamento/i.test(a.titulo)) ||
    b.ultima_coleta.localeCompare(a.ultima_coleta))
  .slice(0, limit)
  .map((row) => ({ kind: 'news', title: row.titulo, url: alternateById.get(row.id) || row.url, source: row.fonte,
    summary: row.trecho, publishedAt: row.data_publicacao, catalogId: row.id }));

const failureReasons = new Map();
const result = await enrichArticles(candidates, { limit, concurrency: 3,
  includeUnsignaled: Boolean(titleOnlyGoogle || requestedId || requestedIds.length),
  onFailure: (item, reason) => failureReasons.set(item.catalogId, reason) });
let changed = 0; let newCandidates = 0;
for (const item of result.items) {
  const row = records.get(item.catalogId);
  records.set(row.id, { ...row, article_attempted_at: attemptedAt,
    article_attempts: Number(row.article_attempts || 0) + 1,
    article_recovery_reason: failureReasons.get(row.id) || '' });
  if (item.contentProvenance !== 'pagina_original') continue;
  const fullText = redactPublicText(item.rawText || item.summary || '');
  const textHash = createHash('sha256').update(fullText).digest('hex');
  textById.set(row.id, { documento_id: row.id, url_original: row.url,
    url_artigo: item.articleUrl, recuperado_em: attemptedAt,
    leitor: item.articleReader || '', texto_sha256: textHash, texto: fullText });
  const classification = classifyItem(item);
  if (!apply) console.log(`[retroativo:prévia] ${row.id.slice(0, 8)} ${item.articleReader || 'leitor não identificado'} | ${classification.category} | ${(classification.evidenceText || item.summary || '').slice(0, 180)}`);
  if (row.tipo_evento === 'GERAL' && classification.category !== 'GERAL' && classification.score >= 5) {
    newCandidates += 1;
    console.log(`[retroativo:revisar] ${row.titulo.slice(0, 115)} → sugestão ${classification.category} (${classification.score}); classificação original mantida`);
  }
  const excerpt = classification.category === 'GERAL' && !classification.stage
    ? item.summary : classification.evidenceText || item.summary;
  const agreedCategory = item.extractionCategories?.readability &&
    item.extractionCategories.readability === item.extractionCategories.trafilatura &&
    item.extractionCategories.readability === classification.category;
  const categoryChanged = reclassify && row.tipo_evento !== 'GERAL' &&
    classification.category !== row.tipo_evento && agreedCategory && !item.extractionDisagreement &&
    (classification.category === 'GERAL' ? demote && item.rawText?.length >= 500 : classification.score >= 5);
  if (categoryChanged) console.log(`[retroativo:categoria] ${row.id.slice(0, 8)} ${row.tipo_evento} → ${classification.category}; conferência documental ainda necessária`);
  records.set(row.id, { ...records.get(row.id), article_url: item.articleUrl,
    trecho: excerpt.slice(0, 500), etapa: classification.stage || row.etapa,
    article_text_sha256: textHash, article_reader: item.articleReader || '',
    article_recovery_reason: '',
    article_suggested_category: row.tipo_evento === 'GERAL' && classification.category !== 'GERAL' && classification.score >= 5
      ? classification.category : '',
    article_suggested_score: row.tipo_evento === 'GERAL' && classification.category !== 'GERAL' && classification.score >= 5
      ? classification.score : '',
    article_suggestion_evidence: row.tipo_evento === 'GERAL' && classification.category !== 'GERAL' && classification.score >= 5
      ? redactPublicText(classification.evidenceText || '').slice(0, 500) : '',
    tipo_evento: categoryChanged ? classification.category : row.tipo_evento,
    situacao_analise: categoryChanged
      ? classification.category === 'GERAL'
        ? `descartado após leitura integral — ${row.tipo_evento} sem evento institucional comprovado`
        : `categoria recalculada após leitura integral — ${row.tipo_evento} → ${classification.category}; conferir`
      : row.situacao_analise });
  changed += 1;
}
console.log(`[retroativo] ${candidates.length} selecionado(s), ${result.attempted} tentativa(s), ${changed} texto(s) recuperado(s), ${newCandidates} sugestão(ões) para revisão${includeSent ? '; envios antigos incluídos, sem reenviar' : ''}.`);
if (apply && candidates.length) {
  await writeFile(textFile, [...textById.values()]
    .sort((a, b) => a.documento_id.localeCompare(b.documento_id))
    .map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
  const counts = await saveCatalog(directory, records);
  console.log(`[retroativo] Catálogo atualizado: ${counts.all} documentos. Nenhum envio ao WhatsApp foi realizado.`);
} else if (!apply) console.log('[retroativo] Prévia apenas. Use --apply para salvar os textos recuperados.');
