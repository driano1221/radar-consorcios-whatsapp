import test from 'node:test';
import assert from 'node:assert/strict';
import { redactPublicText } from '../src/lib/article-text-store.mjs';

test('arquivo integral omite CPF e e-mail sem truncar o contexto', () => {
  const longText = `Contato contato@exemplo.gov.br, CPF 123.456.789-00. ${'Texto do ato. '.repeat(500)}`;
  const result = redactPublicText(longText);
  assert.match(result, /\[CPF omitido\]/);
  assert.match(result, /\[email omitido\]/);
  assert.ok(result.length > 5000);
  assert.match(result, /Texto do ato\. $/);
});
