import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { classifyItem } from '../src/lib/classifier.mjs';

const root = new URL('../', import.meta.url);
const state = JSON.parse(await readFile(new URL('state/news-state.json', root), 'utf8'));
const archive = new Map((await readFile(new URL('data/catalogo/arquivo-coletas.ndjson', root), 'utf8'))
  .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)).map((row) => [row.id, row]));
const reviews = (await readFile(new URL('data/catalogo/revisoes-eventos.ndjson', root), 'utf8'))
  .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));

const cases = [
  ['07d6615f', 'ADESÃO', 'confirmar_evento', 'ADESÃO AUTORIZADA'],
  ['c94feca9', 'GERAL', 'nao_evento', ''],
  ['64146b92', 'GOVERNANÇA', 'confirmar_evento', 'GOVERNANÇA'],
  ['35799042', 'RATEIO', 'confirmar_evento', 'RATEIO'],
  ['850762ca', 'GERAL', 'nao_evento', ''],
];

for (const [prefix, expectedAutomatic, expectedDecision, expectedEditorial] of cases) {
  test(`caso conjunto ${prefix}: classificador e revisão lacrada`, () => {
    const id = [...archive.keys()].find((key) => key.startsWith(prefix));
    assert.ok(id);
    const row = archive.get(id);
    const item = state.observations[id]?.item;
    assert.ok(item);
    assert.equal(classifyItem(item).category, expectedAutomatic);
    const review = reviews.find((entry) => entry.documento_id === id);
    assert.equal(review?.decisao, expectedDecision);
    assert.equal(review.categoria || '', expectedEditorial);
    assert.equal(review.trecho_sha256, createHash('sha256').update(row.trecho || '').digest('hex'));
    assert.ok(review.evidencia && review.motivo);
  });
}
