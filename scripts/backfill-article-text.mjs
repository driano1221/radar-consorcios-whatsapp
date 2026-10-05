import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, saveCatalog } from '../src/lib/catalog.mjs';
import { classifyItem } from '../src/lib/classifier.mjs';
import { enrichArticles, lacksArticleText } from '../src/lib/article-enrichment.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'data', 'catalogo');
const apply = process.argv.includes('--apply');
const limit = Math.min(60, Math.max(1, Number(process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] || 20)));
const requestedId = process.argv.find((arg) => arg.startsWith('--id='))?.split('=')[1] || '';
const records = await loadCatalog(path.join(directory, 'arquivo-coletas.ndjson'));
const attemptedAt = new Date().toISOString();
const reviews = (await readFile(path.join(directory, 'revisoes-eventos.ndjson'), 'utf8'))
  .split(/\r?\n/).filter(Boolean).map(JSON.parse);
const reviewed = new Set(reviews.map((row) => row.documento_id));
const candidates = [...records.values()].filter((row) => !reviewed.has(row.id) &&
  (!requestedId || row.id.startsWith(requestedId)) &&
  !row.enviado_em && row.fonte !== 'Querido Diário' &&
  Number(row.article_attempts || 0) < 3 &&
  (!row.article_attempted_at || Date.now() - new Date(row.article_attempted_at).getTime() > 12 * 3600000) &&
  lacksArticleText({ title: row.titulo, summary: row.trecho }) &&
  /cons[oó]rc|rateio|protocolo de inten[cç][oõ]es|ades[aã]o|desligamento|retirada/i.test(row.titulo))
  .sort((a, b) => Number(/ades[aã]o|ingresso|ratifica|cria[cç][aã]o|retirada|desligamento/i.test(b.titulo)) -
    Number(/ades[aã]o|ingresso|ratifica|cria[cç][aã]o|retirada|desligamento/i.test(a.titulo)) ||
    b.ultima_coleta.localeCompare(a.ultima_coleta))
  .slice(0, limit)
  .map((row) => ({ kind: 'news', title: row.titulo, url: row.url, source: row.fonte,
    summary: row.trecho, publishedAt: row.data_publicacao, catalogId: row.id }));

const result = await enrichArticles(candidates, { limit, concurrency: 3 });
let changed = 0; let newCandidates = 0;
for (const item of result.items) {
  const row = records.get(item.catalogId);
  records.set(row.id, { ...row, article_attempted_at: attemptedAt,
    article_attempts: Number(row.article_attempts || 0) + 1 });
  if (item.contentProvenance !== 'pagina_original') continue;
  const classification = classifyItem(item);
  if (row.tipo_evento === 'GERAL' && classification.category !== 'GERAL' && classification.score >= 5) {
    newCandidates += 1;
    console.log(`[retroativo:revisar] ${row.titulo.slice(0, 115)} → sugestão ${classification.category} (${classification.score}); classificação original mantida`);
  }
  records.set(row.id, { ...records.get(row.id), article_url: item.articleUrl,
    trecho: item.summary.slice(0, 500) });
  changed += 1;
}
console.log(`[retroativo] ${candidates.length} selecionado(s), ${result.attempted} tentativa(s), ${changed} texto(s) recuperado(s), ${newCandidates} sugestão(ões) para revisão.`);
if (apply && candidates.length) {
  const counts = await saveCatalog(directory, records);
  console.log(`[retroativo] Catálogo atualizado: ${counts.all} documentos. Nenhum envio ao WhatsApp foi realizado.`);
} else if (!apply) console.log('[retroativo] Prévia apenas. Use --apply para salvar os textos recuperados.');
