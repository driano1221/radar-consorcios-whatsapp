import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { classifyItem } from '../src/lib/classifier.mjs';
import { saveCatalog } from '../src/lib/catalog.mjs';

const root = new URL('../', import.meta.url);
const state = JSON.parse(await readFile(new URL('state/news-state.json', root), 'utf8'));
const archive = new Map((await readFile(new URL('data/catalogo/arquivo-coletas.ndjson', root), 'utf8'))
  .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)).map((row) => [row.id, row]));
const reviews = (await readFile(new URL('data/catalogo/revisoes-eventos.ndjson', root), 'utf8'))
  .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));

const cases = [
  ['07d6615f', 'ADESÃO AUTORIZADA', 'confirmar_evento', 'ADESÃO AUTORIZADA'],
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

test('Marcelândia tem última evidência em 2026, sem inventar ano de ingresso', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'radar-participacao-'));
  try {
    const row = [...archive.values()].find((item) => item.id.startsWith('64146b92'));
    const review = reviews.find((item) => item.documento_id === row.id);
    await writeFile(path.join(directory, 'revisoes-eventos.ndjson'), `${JSON.stringify(review)}\n`);
    await saveCatalog(directory, new Map([[row.id, row]]));
    const csv = await readFile(path.join(directory, 'participacoes.csv'), 'utf8');
    const [header, record] = csv.trim().split('\n');
    const fields = header.split(',');
    const cells = record.match(/(?:"[^"]*(?:""[^"]*)*"|[^,]*)(?:,|$)/g).map((cell) => cell.replace(/,$/, '').replace(/^"|"$/g, ''));
    const participation = Object.fromEntries(fields.map((field, index) => [field, cells[index]]));
    assert.equal(participation.municipio, 'Marcelândia/MT');
    assert.equal(participation.ano_ingresso, '');
    assert.equal(participation.ano_ultima_evidencia_participacao, '2026');
    assert.equal(participation.cnpj_municipio, '03.238.987/0001-75');
    assert.equal(participation.fonte_ultima_evidencia, 'https://amm.diariomunicipal.org/publicacao/1920936/');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
