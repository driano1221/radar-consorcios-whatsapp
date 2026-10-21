// Offline: reuse verified texts and cached reviews. Never import WhatsApp or an API client.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { classifyItem } from '../src/lib/classifier.mjs';
import { itemId, canonicalUrl } from '../src/lib/dedupe.mjs';
import { decideSimpleTriage, rowFingerprint, categoryGroup, categoryLabel } from '../src/lib/simple-triage.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const ndjson = async name => (await readFile(`data/catalogo/${name}`, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
const batch = JSON.parse(await readFile('data/catalogo/triagem-simples-lote.json', 'utf8'));
assert.equal(batch.ids.length, 69); assert.equal(new Set(batch.ids).size, 69);
const stateBytes = await readFile('state/news-state.json');
const state = JSON.parse(stateBytes);
const rows = new Map((await ndjson('arquivo-coletas.ndjson')).map(row => [row.id, row]));
const texts = new Map((await ndjson('textos-artigos.ndjson')).map(row => [row.documento_id, row]));
const protectedIds = new Set((await ndjson('revisoes-eventos.ndjson')).map(row => row.documento_id));
if (batch.ids.some(id => protectedIds.has(id))) {
  console.log(JSON.stringify({ batch: 69, skipped: true,
    reason: 'O lote já recebeu revisão conjunta. Preservados decisões humanas e relatório original numerado; usar apply-joint-review-39.mjs para conferir a aplicação.' }));
  process.exit(0);
}
const results = [];
for (const id of batch.ids) {
  const row = rows.get(id); assert.ok(row); assert.ok(!protectedIds.has(id), 'Não substituir revisão já aplicada');
  const original = state.observations?.[id]?.item || {};
  const stored = texts.get(id);
  const body = stored?.texto && sha(stored.texto) === stored.texto_sha256 ? stored.texto : '';
  const item = { ...original, kind: original.kind || (/notícia|página/.test(row.tipo_documento) ? 'news' : 'gazette'),
    title: original.title || row.titulo, url: original.url || row.url,
    articleUrl: stored?.url_artigo || row.article_url || row.url,
    rawText: body, summary: body || row.trecho };
  item.duplicatePublication = [...rows.values()].some(other => other.id !== id &&
    canonicalUrl(other.article_url || other.url) === canonicalUrl(item.articleUrl));
  item.classification = classifyItem(item);
  item.aiReview = state.aiReviews?.[itemId(item)] || original.aiReview;
  const decision = decideSimpleTriage(item);
  results.push({ ...decision, documentId: id, rowHash: rowFingerprint(row), retroactive: true,
    title: row.titulo, sourceUrl: item.articleUrl, group: categoryGroup(decision.category),
    reviewedAt: new Date().toISOString() });
}
assert.equal(sha(await readFile('state/news-state.json')), sha(stateBytes));
await writeFile('data/catalogo/triagem-originais.ndjson', results.map(row => JSON.stringify(row)).join('\n') + '\n');
const pending = results.filter(row => row.status === 'revisao');
const counts = Object.fromEntries(['confirmado', 'descartado', 'revisao'].map(status => [status, results.filter(r => r.status === status).length]));
await mkdir('output/simple-triage', { recursive: true });
await writeFile('output/simple-triage/result.json', JSON.stringify({ batch: 69, counts, pending, stateUntouched: true, whatsappSends: 0, aiCalls: 0 }, null, 2));
const report = ['# Revisar comigo — lote de 69 publicações', '',
  `Triagem concluída sem novas chamadas à IA ou envio: **${counts.confirmado} confirmadas**, **${counts.descartado} rejeitadas** e **${counts.revisao} para revisão conjunta**.`, '',
  'Para cada caso, envie o número/ID, sua conclusão e um trecho literal. Quando houver PDF, indique também a página. As correções devem virar regras e testes reutilizáveis. Nenhuma decisão deste lote libera envio retroativo.', ''];
for (const [index, row] of pending.entries()) report.push(`## ${index + 1}. ${row.title}`, '',
  `ID: \`${row.documentId.slice(0, 8)}\` · ${categoryLabel(row.category) || 'Enquadramento a definir'}`, '',
  `[Abrir fonte](${row.sourceUrl})`, '', `**Dúvida:** ${row.reason}`, '',
  ...(row.stage ? [`**Etapa detectada (a conferir):** ${row.stage}`, ''] : []),
  ...(row.checks || []).map(check => `- ${check}`), '');
await writeFile('docs/REVISAR-COMIGO-2026-10-21.md', report.join('\n') + '\n');
console.log(JSON.stringify({ batch: 69, counts, stateUntouched: true, whatsappSends: 0, aiCalls: 0 }));
