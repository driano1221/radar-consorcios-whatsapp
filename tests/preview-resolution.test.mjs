import test from 'node:test';
import assert from 'node:assert/strict';
import { itemId } from '../src/lib/dedupe.mjs';
import { AI_PROMPT_VERSION } from '../src/lib/ai-review.mjs';
import { resolveArticlePreviews } from '../src/lib/preview-resolution.mjs';
import { applyEditorialGuard } from '../src/lib/editorial-guard.mjs';

const article = {
  kind: 'news', title: 'Consórcio executa ação regional', url: 'https://example.org/acao',
  rawText: 'O Consórcio Intermunicipal Grande ABC realizou a primeira reunião de mobilização para estruturar a cadeia produtiva. O encontro reuniu produtores e representantes de municípios da região.',
  contentProvenance: 'pagina_original', previewOnly: true,
  classification: { category: 'ATUAÇÃO', score: 8, reasons: [] },
};

function reviewer(status, evidence = 'realizou a primeira reunião de mobilização') {
  return async (items, state) => {
    state.aiReviews ||= {};
    for (const item of items) state.aiReviews[itemId(item)] = {
      promptVersion: AI_PROMPT_VERSION, status, evidence, category: 'ATUAÇÃO',
    };
    return { audit: items.map((item) => ({ id: itemId(item), status })), callsRun: items.length };
  };
}

test('segunda passagem adota somente com prova literal no artigo', async () => {
  const result = await resolveArticlePreviews([article], [{ ...article, previewOnly: false }], {},
    { review: reviewer('approved') });
  assert.equal(result.items[0].previewOnly, false);
  assert.equal(result.items[0].triageResolution.decision, 'adotado');
  assert.equal(result.items[0].classification.category, 'ATUAÇÃO');
});

test('segunda passagem descarta rejeição comprovada no artigo', async () => {
  const result = await resolveArticlePreviews([article], [{ ...article, previewOnly: false }], {},
    { review: reviewer('rejected') });
  assert.equal(result.items[0].previewOnly, false);
  assert.equal(result.items[0].triageResolution.decision, 'descartado');
  assert.equal(result.items[0].classification.category, 'GERAL');
});

test('não resolve sem prova no artigo nem homologa fonte marcada como prévia', async () => {
  const noEvidence = await resolveArticlePreviews([article], [{ ...article, previewOnly: false }], {},
    { review: reviewer('approved', 'Trecho existente somente no título') });
  assert.equal(noEvidence.items[0].previewOnly, true);
  let calls = 0;
  const sourcePreview = await resolveArticlePreviews([article], [article], {},
    { review: async () => { calls += 1; return {}; } });
  assert.equal(calls, 0);
  assert.equal(sourcePreview.items[0].previewOnly, true);
});

test('revisão editorial já confirmada encerra a prévia', () => {
  const approved = applyEditorialGuard(article, new Map([[article.url, {
    decisao: 'confirmar_evento', categoria: 'ATUAÇÃO',
    motivo: 'reunião realizada', evidencia: 'realizou a primeira reunião de mobilização',
  }]]));
  assert.equal(approved.previewOnly, false);
  assert.equal(approved.classification.category, 'ATUAÇÃO');
  assert.match(approved.classification.reasons.at(-1), /revisão editorial/);
});
