// Live read-only checks of the readers repaired in the historical batch.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { enrichArticle } from '../src/lib/article-enrichment.mjs';
import { protectedSnapshot } from './pilot-retroactive-ten.mjs';
const snapshot = await protectedSnapshot();
const nd = async name => (await readFile(`data/catalogo/${name}`, 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const texts = await nd('textos-artigos.ndjson'), reviews = await nd('revisoes-eventos.ndjson');
const alternatives = await nd('fontes-alternativas.ndjson');
const archive = await nd('arquivo-coletas.ndjson');
const results = [];
for (const prefix of ['68160372', 'cfbb82ef', 'e41368d4', '74fb6772']) {
  const review = reviews.find(r => r.documento_id.startsWith(prefix));
  // This regression checks the four routes fixed by that batch. The newly
  // recovered CNM original is diagnosed separately (runner may still get 403).
  const source = (prefix === '74fb6772' ? alternatives : texts).find(r => r.documento_id === review.documento_id);
  const url = source.url_artigo || source.url_fonte;
  const result = { prefix, url, status: 'failed', chars: 0 };
  try {
    // CIMCERO matches the actual page title; the curated display title differs.
    const title = archive.find(r => r.id === review.documento_id).titulo;
    const article = await enrichArticle({ kind: 'news', title, url, summary: '' }, {
      onFailure: (_, reason) => { result.reason = reason; },
    });
    result.chars = article.rawText?.length || 0;
    result.reader = article.articleReader;
    assert.ok(article.rawText?.replace(/\s+/g, ' ').trim().includes(review.evidencia), result.reason || 'Prova revisada não encontrada na leitura atual');
    result.status = 'ok';
  } catch (error) { result.reason = error.message; }
  results.push(result); console.log(JSON.stringify(result));
}
assert.deepEqual(await protectedSnapshot(), snapshot, 'Validação não pode alterar dados nem estado');
await mkdir('output/historical-readers', { recursive: true });
await writeFile('output/historical-readers/report.json', JSON.stringify({ at: new Date().toISOString(), results,
  dataUnchanged: true, stateUnchanged: true, whatsappCalls: 0 }, null, 2) + '\n');
assert.ok(results.every(r => r.status === 'ok'), 'Uma rota não recuperou a prova no ambiente atual; consultar relatório');
