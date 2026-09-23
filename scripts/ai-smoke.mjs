import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { reviewWithDeepSeek } from '../src/lib/ai-review.mjs';

const root = path.resolve(import.meta.dirname, '..');
const dataset = JSON.parse(await readFile(path.join(root, 'output', 'ai-eval-dataset.json'), 'utf8'));
const selected = ['agenda-abc', 'adesao-centenario', 'balanco-votuporanga'];
const expected = { 'agenda-abc': 'ATUAÇÃO', 'adesao-centenario': 'ADESÃO AUTORIZADA',
  'balanco-votuporanga': 'IRRELEVANTE' };
const results = [];
for (const id of selected) {
  const record = dataset.find((entry) => entry.id === id);
  assert.ok(record, `Caso ${id} ausente da amostra.`);
  const item = { ...record, classification: { evidenceText: record.evidence } };
  const review = await reviewWithDeepSeek(item, { apiKey: process.env.DEEPSEEK_API_KEY });
  results.push({ id, status: review.status, category: review.category, expected: expected[id],
    correct: review.category === expected[id], usage: review.usage });
  console.log(`${id}: ${review.category} (${review.status})`);
}
await writeFile(path.join(root, 'output', 'ai-smoke.json'), JSON.stringify(results, null, 2) + '\n');
assert.ok(results.every((entry) => entry.correct), 'A integração real divergiu de um caso de controle.');
