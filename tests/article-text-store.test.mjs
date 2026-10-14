import test from 'node:test';
import assert from 'node:assert/strict';
import { redactPublicText, persistArticleTexts } from '../src/lib/article-text-store.mjs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

test('persiste leitura completa uma vez, sem substituir evidência anterior nem salvar erro', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'radar-text-test-'));
  try {
    const item = { url: 'https://example.org/ato', contentProvenance: 'pagina_original', rawText: 'Conteúdo integral. '.repeat(1000) };
    assert.equal(await persistArticleTexts(directory, [item]), 1);
    assert.equal(await persistArticleTexts(directory, [{ ...item, rawText: 'Trecho curto. '.repeat(20) }]), 0);
    assert.equal(await persistArticleTexts(directory, [{ ...item, url: 'https://example.org/erro', extractionError: '403' }]), 0);
    const saved = (await readFile(path.join(directory, 'textos-artigos.ndjson'), 'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].texto, item.rawText);
    assert.match(saved[0].texto_sha256, /^[a-f0-9]{64}$/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('arquivo integral omite CPF e e-mail sem truncar o contexto', () => {
  const longText = `Contato contato@exemplo.gov.br, CPF 123.456.789-00. ${'Texto do ato. '.repeat(500)}`;
  const result = redactPublicText(longText);
  assert.match(result, /\[CPF omitido\]/);
  assert.match(result, /\[email omitido\]/);
  assert.ok(result.length > 5000);
  assert.match(result, /Texto do ato\. $/);
});
