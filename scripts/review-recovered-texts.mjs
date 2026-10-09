// Recalcula apenas sugestões de revisão com os textos integrais já guardados.
// Não promove documentos à base de eventos nem envia mensagens.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadCatalog, saveCatalog } from '../src/lib/catalog.mjs';
import { classifyItem, isStaleLegislativeDocument } from '../src/lib/classifier.mjs';
import { redactPublicText } from '../src/lib/article-text-store.mjs';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'data', 'catalogo');
const apply = process.argv.includes('--apply');
const records = await loadCatalog(path.join(directory, 'arquivo-coletas.ndjson'));
const reviews = (await readFile(path.join(directory, 'revisoes-eventos.ndjson'), 'utf8'))
  .split(/\r?\n/).filter(Boolean).map(JSON.parse);
const reviewedIds = new Set(reviews.map((row) => row.documento_id));
const texts = (await readFile(path.join(directory, 'textos-artigos.ndjson'), 'utf8'))
  .split(/\r?\n/).filter(Boolean).map(JSON.parse).map((row) => {
    const texto = redactPublicText(row.texto);
    return { ...row, texto, texto_sha256: createHash('sha256').update(texto).digest('hex') };
  });
let suggested = 0;
const firstByTextHash = new Map();
for (const stored of texts) {
  const row = records.get(stored.documento_id);
  if (!row || row.tipo_evento !== 'GERAL') continue;
  const sameTextAs = firstByTextHash.get(stored.texto_sha256) || '';
  if (!sameTextAs) firstByTextHash.set(stored.texto_sha256, row.id);
  const result = classifyItem({ kind: 'news', title: row.titulo, url: row.url,
    articleUrl: stored.url_artigo, source: row.fonte,
    summary: stored.texto.slice(0, 1800), rawText: stored.texto,
    publishedAt: row.data_publicacao });
  const clearlyOutsideScope = /\b(?:concurso|processo seletivo|gabarito|provas|sal[aá]rios|vagas)\b/i.test(row.titulo) ||
    /^Detalhes do Ac[oó]rd[aã]o\b.*\b20(?:0\d|1\d|2[0-4])\b/i.test(row.titulo) ||
    isStaleLegislativeDocument({ kind: 'news', title: row.titulo, publishedAt: row.data_publicacao });
  const candidate = !reviewedIds.has(row.id) && !sameTextAs && !clearlyOutsideScope &&
    result.category !== 'GERAL' && result.score >= 5;
  if (candidate) suggested += 1;
  records.set(row.id, { ...row,
    article_text_sha256: stored.texto_sha256,
    article_duplicate_of: sameTextAs,
    article_suggested_category: candidate ? result.category : '',
    article_suggested_score: candidate ? result.score : '',
    article_suggestion_evidence: candidate ? redactPublicText(result.evidenceText || '').slice(0, 500) : '' });
}
console.log(`[releitura] ${texts.length} textos integrais guardados; ${suggested} sugestões para revisão, sem promoção automática.`);
if (apply) {
  await writeFile(path.join(directory, 'textos-artigos.ndjson'),
    texts.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
  await saveCatalog(directory, records);
  console.log('[releitura] Sugestões atualizadas no catálogo; nenhum envio ao WhatsApp.');
}
