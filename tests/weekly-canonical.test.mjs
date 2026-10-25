import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { verifiedTriage } from '../src/lib/triage-proof.mjs';
import { prepareWeeklyState } from '../src/lib/weekly-selection.mjs';
import { reviewWeeklyFindings } from '../src/lib/ai-review.mjs';
import { buildWeeklyReport, weeklyWindow } from '../src/lib/history.mjs';

const sha = value => createHash('sha256').update(value).digest('hex');
const body = 'O Prefeito sanciona a seguinte lei. Art. 1º Fica ratificado o protocolo de intenções do Consórcio Público Intermunicipal Regional. A constituição dependerá das etapas legais posteriores.';
const evidence = 'Art. 1º Fica ratificado o protocolo de intenções';
const decision = { status: 'confirmado', category: 'PROTOCOLO', stage: 'ratificação; constituição não comprovada',
  bodyHash: sha(body), evidence, reason: 'Dispositivo legal ratifica o protocolo.' };

test('prova canônica exige corpo intacto, citação literal e decisão concluída', () => {
  assert.equal(verifiedTriage(decision, body), true);
  assert.equal(verifiedTriage(decision, body + ' Alterado.'), false);
  assert.equal(verifiedTriage({ ...decision, evidence: 'O consórcio foi constituído' }, body), false);
  assert.equal(verifiedTriage({ ...decision, status: 'processando' }, body), false);
  assert.equal(verifiedTriage(decision, ''), false);
  assert.equal(verifiedTriage(decision, {}), false);
});

test('resumo usa decisão canônica e não reabre rejeição, prova alterada, histórico ou fonte bloqueada', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'radar-weekly-canonical-'));
  assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
  try {
    const cases = ['confirmed', 'rejected', 'tampered', 'wrong-quote', 'retroactive', 'control', 'preview', 'activation'];
    const archive = cases.map(name => ({ id: sha(name), titulo: `LEI Nº ${name}/2030`, trecho: body,
      url: name === 'activation' ? 'https://historico.gov.br/lei' : `https://exemplo.gov.br/${name}`,
      fonte: name === 'activation' ? 'Fonte histórica' : 'Diário de teste',
      data_publicacao: '2030-10-25T15:00:00Z', data_noticia_original: '2030-10-25T15:00:00Z',
      triagem_automatica: { ...decision,
        ...(name === 'rejected' ? { status: 'descartado', category: 'GERAL' } : {}),
        ...(name === 'control' ? { category: 'CONTROLE' } : {}),
        ...(name === 'retroactive' ? { retroactive: true, weeklyAllowed: false } : {}),
        ...(name === 'wrong-quote' ? { evidence: 'Frase não presente no corpo' } : {}),
      },
    }));
    const texts = archive.map((row, index) => ({ documento_id: row.id,
      texto: cases[index] === 'tampered' ? body + ' Conteúdo alterado.' : body }));
    for (const [name, rows] of Object.entries({ 'arquivo-coletas': archive, 'textos-artigos': texts,
      'revisoes-eventos': [], 'atos-identificados': [] }))
      await writeFile(path.join(directory, name + '.ndjson'), rows.map(JSON.stringify).join('\n') + '\n');
    const state = { seen: {}, pending: {}, runs: {}, observations: Object.fromEntries(archive.map((row, index) => [row.id, {
      firstSeenAt: row.data_publicacao, item: { url: row.url, title: row.titulo, source: row.fonte,
        kind: 'gazette', summary: body, publishedAt: row.data_publicacao,
        sourcePublishedAt: row.data_noticia_original, previewOnly: cases[index] === 'preview',
        classification: { category: 'CRIAÇÃO', score: 20 },
      },
    }])) };
    const before = JSON.stringify(state);
    const window = weeklyWindow(new Date('2030-10-26T12:01:00Z'));
    const prepared = await prepareWeeklyState(state, directory, window, {
      sourceActivations: [{ name: 'Fonte histórica', url: 'https://historico.gov.br', alertsFrom: '2030-10-26T00:00:00Z' }],
    });
    const report = buildWeeklyReport(prepared, window);
    assert.deepEqual(report.highlights.map(item => item.url), [archive[0].url]);
    assert.equal(report.highlights[0].classification.category, 'PROTOCOLO');
    assert.equal(prepared.weeklySelectionAudit.filter(item => !item.included).length, 7);
    const reviewed = await reviewWeeklyFindings(report.highlights, {}, {
      reviewImpl: async () => { throw new Error('Não chamar a API'); },
    });
    assert.equal(reviewed.calls, 0);
    assert.equal(reviewed.audit[0].status, 'canonical-confirmed');
    assert.equal(reviewed.highlights[0].classification.category, 'PROTOCOLO');
    assert.equal(JSON.stringify(state), before);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
