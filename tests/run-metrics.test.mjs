import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSourceFunnel, formatSourceFunnel } from '../src/lib/run-metrics.mjs';

test('resume coleta, descarte e seleção por fonte', () => {
  const rejected = {
    source: 'Querido Diário',
    classification: { category: 'GERAL', score: -18, reasons: ['rejeitado: adesão a ata de preços'] },
  };
  const selected = {
    source: 'TCE-MG',
    classification: { category: 'CONTROLE', score: 11, reasons: ['CONTROLE'] },
  };
  const funnel = buildSourceFunnel({
    collected: [rejected, selected],
    classified: [rejected, selected],
    relevant: [selected],
    publishable: [selected],
    unseen: [selected],
    selected: [selected],
    minimumScore: 5,
  });
  assert.equal(funnel.sources['Querido Diário'].rejected, 1);
  assert.equal(funnel.sources['Querido Diário'].discardReasons['rejeitado: adesão a ata de preços'], 1);
  assert.equal(funnel.sources['TCE-MG'].selected, 1);
  assert.match(formatSourceFunnel(funnel), /Funil de qualidade por fonte/);
  assert.match(formatSourceFunnel(funnel), /TCE-MG/);
});
