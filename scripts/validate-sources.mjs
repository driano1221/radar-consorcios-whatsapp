import { writeFile, mkdir } from 'node:fs/promises';
import { loadConfig } from '../src/config.mjs';
import { fetchWebScrapers } from '../src/lib/sources/web-scrapers.mjs';
import { fetchRssFeeds } from '../src/lib/sources/rss-feeds.mjs';
import { fetchSapl } from '../src/lib/sources/sapl.mjs';
import { fetchQueridoDiario } from '../src/lib/sources/querido-diario.mjs';
import { classifyItem, isPublishableClassification } from '../src/lib/classifier.mjs';

const config = await loadConfig();
const since = new Date(Date.now() - 45 * 86400000);
const sources = [ ['Portais', () => fetchWebScrapers(config.webScrapers, since)],
  ['RSS', () => fetchRssFeeds(config.rssFeeds, since)], ['SAPL', () => fetchSapl(config.sapl, since)],
  ['Querido Diário', () => fetchQueridoDiario(config.queridoDiario, since)] ];
const results = [];
for (const [name, fn] of sources) {
  const start = Date.now();
  try {
    const value = await fn();
    const payload = Array.isArray(value) ? { items: value } : value;
    results.push({ name, durationMs: Date.now() - start, diagnostics: payload.diagnostics,
      count: payload.items.length,
      candidates: payload.items.map((i) => ({ ...i, classification: classifyItem(i) }))
        .filter((i) => isPublishableClassification(i.classification, config.minimumScore))
        .map((i) => ({ title: i.title, url: i.url, publishedAt: i.publishedAt, source: i.source, category: i.classification.category, previewOnly: !!i.previewOnly })) });
  } catch (error) { results.push({ name, error: error.message, durationMs: Date.now() - start }); }
}
await mkdir(config.outputDir, { recursive: true });
const report = { generatedAt: new Date().toISOString(), since: since.toISOString(), results };
await writeFile(`${config.outputDir}/source-validation.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
