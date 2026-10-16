import test from 'node:test';
import assert from 'node:assert/strict';
import { IDS, duplicateOwner } from '../scripts/pilot-retroactive-ten.mjs';

test('piloto tem exatamente dez IDs distintos, sem seleção aberta do acervo', () => {
  assert.equal(IDS.length, 10);
  assert.equal(new Set(IDS).size, 10);
});
test('deduplicação usa conteúdo do PDF, não URL nem título de busca', () => {
  const first = { id: 'original', extraction: { pdf_sha256: 'same' } };
  assert.equal(duplicateOwner([first], { extraction: { pdf_sha256: 'same' } }), 'original');
  assert.equal(duplicateOwner([first], { extraction: { pdf_sha256: 'different' } }), '');
  assert.equal(duplicateOwner([first], {}), '');
});
