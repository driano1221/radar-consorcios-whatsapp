import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, rm, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { mergeStateIntoCatalog } from '../src/lib/catalog.mjs';
import { loadEditorialGuard, applyEditorialGuard } from '../src/lib/editorial-guard.mjs';
import { prepareWeeklyState, weeklyPublicationDate } from '../src/lib/weekly-selection.mjs';
import { weeklyWindow, buildWeeklyReport } from '../src/lib/history.mjs';
import { reviewWeeklyFindings } from '../src/lib/ai-review.mjs';
import { isNotifiable } from '../src/lib/publication-gate.mjs';
import { formatWeeklyMessages } from '../src/lib/format.mjs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { isolatedTestEnvironment } from '../scripts/isolated-environment.mjs';
import { itemId } from '../src/lib/dedupe.mjs';
import { classifyItem } from '../src/lib/classifier.mjs';
import { AI_PROMPT_VERSION } from '../src/lib/ai-review.mjs';

const dir = fileURLToPath(new URL('../data/catalogo/', import.meta.url));
const read = async name => (await readFile(`${dir}/${name}`, 'utf8')).trim().split('\n').map(JSON.parse);
const hash = value => createHash('sha256').update(value || '').digest('hex');
const window = weeklyWindow(new Date('2026-10-17T20:13:00Z'));

test('recaptura e fila nunca sobrescrevem os trechos lacrados do acervo real', async () => {
  const rows = await read('arquivo-coletas.ndjson');
  const reviews = await read('revisoes-eventos.ndjson');
  const state = JSON.parse(await readFile(new URL('../state/news-state.json', import.meta.url), 'utf8'));
  const before = JSON.stringify(state);
  const records = new Map(rows.map(r => [r.id, { ...r }]));
  const ids = new Set(reviews.map(r => r.documento_id));
  const target = rows.find(r => r.id.startsWith('0783e43a'));
  state.pending.regression = { queuedAt: '2026-10-19', item: {
    url: target.url, title: target.titulo, summary: 'Texto mais longo '.repeat(100),
    classification: { category: 'ADESÃO', score: 20 } } };
  const injected = JSON.stringify(state);
  for (let n = 0; n < 2; n++) mergeStateIntoCatalog(records, state, { reviewedIds: ids });
  assert.equal(JSON.stringify(state), injected);
  for (const review of reviews) if (records.has(review.documento_id))
    assert.equal(hash(records.get(review.documento_id).trecho), review.trecho_sha256, review.documento_id);
  delete state.pending.regression;
  assert.equal(JSON.stringify(state), before);
  const guard = await loadEditorialGuard(dir);
  assert.equal(applyEditorialGuard({ url: target.url }, guard).editorialDecision, 'duplicata');
});

test('resumo inclui CIMSAMU em 14/10 sem liberar alerta, alterar recibos ou incluir Campo Mourão de 09/10', async () => {
  const state = JSON.parse(await readFile(new URL('../state/news-state.json', import.meta.url), 'utf8'));
  const before = JSON.stringify(state);
  const prepared = await prepareWeeklyState(state, dir, window);
  const report = buildWeeklyReport(prepared, window);
  const cimsamu = report.highlights.find(i => i.weeklyEvidence?.documentId.startsWith('c24a8dce'));
  assert.ok(cimsamu);
  assert.match(cimsamu.weeklyDate, /^2026-10-14/);
  assert.equal(cimsamu.publicationDecision, 'historico');
  assert.equal(isNotifiable(cimsamu), false);
  assert.ok(report.highlights.some(i => i.weeklyEvidence?.documentId.startsWith('8c7dbb9e')));
  assert.ok(!report.highlights.some(i => i.weeklyEvidence?.documentId.startsWith('437fe78c')));
  assert.ok(!report.highlights.some(i => i.weeklyEvidence?.documentId.startsWith('b06ea64f')));
  for (const prefix of ['ac59dad5', 'd3c65b15'])
    assert.ok(!report.highlights.some(i => i.weeklyEvidence?.documentId.startsWith(prefix)), 'lei histórica não reaparece como novidade');
  const ai = await reviewWeeklyFindings([cimsamu], { aiReviews: {} }, { apiKey: 'test',
    reviewImpl: async () => { throw new Error('A IA não deve revogar decisão humana lacrada'); } });
  assert.equal(ai.highlights.length, 1);
  assert.equal(ai.calls, 0);
  const next = weeklyWindow(new Date('2026-10-24T12:01:00Z'));
  const later = buildWeeklyReport(await prepareWeeklyState(state, dir, next), next);
  assert.ok(!later.highlights.some(i => i.weeklyEvidence?.documentId.startsWith('c24a8dce')));
  assert.equal(JSON.stringify(state), before);
  assert.match(formatWeeklyMessages({ ...report, events: 1, highlights: [cimsamu] }).join('\n'), /14\/10/);
});

test('data original tem prioridade sobre data da coleta; Google sem prova não inventa data', () => {
  assert.equal(weeklyPublicationDate({ url: 'https://news.google.com/a', publishedAt: '2026-10-19' },
    { data_noticia_original: '2022-12-06' }, { fatos: {} }), '2022-12-06T12:00:00-03:00');
  assert.equal(weeklyPublicationDate({ url: 'https://news.google.com/a', publishedAt: '2026-10-19' }, {}, { fatos: {} }), '');
});

test('workflows serializados leem branch atual e só criptografam sessão restaurada', async () => {
  for (const name of ['radar', 'weekly', 'session-health', 'recuperar-textos']) {
    const text = await readFile(new URL(`../.github/workflows/${name}.yml`, import.meta.url), 'utf8');
    assert.match(text, /group: radar-consorcios-whatsapp/);
    assert.match(text, /ref: \$\{\{ github.ref_name \}\}/);
    if (name !== 'recuperar-textos') assert.match(text, /if: always\(\) && steps.restore_session.outcome == 'success'/);
  }
});

test('prévia histórica rejeita SEND_ENABLED=true antes de conectar ou modificar estado', async () => {
  const file = new URL('../state/news-state.json', import.meta.url);
  const before = await readFile(file, 'utf8');
  const result = spawnSync(process.execPath, ['src/weekly.mjs'], { cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8', env: { ...process.env, SEND_ENABLED: 'true', WEEKLY_REBUILD_PREVIEW: 'true',
      WEEKLY_REFERENCE_TIME: '2026-10-17T20:13:00Z' } });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /só pode rodar sem envio/);
  assert.equal(await readFile(file, 'utf8'), before);
});

test('entrada semanal isola resposta inválida e gera só aprovados, sem rede real ou persistência', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'radar-weekly-isolation-'));
  assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
  const production = await readFile(new URL('../state/news-state.json', import.meta.url), 'utf8');
  try {
    for (const withApproved of [true, false]) {
      const output = path.join(directory, withApproved ? 'partial' : 'none');
      const stateFile = path.join(directory, 'state.json');
      const body = 'O Prefeito Municipal faz saber que a Câmara aprovou e sanciona a seguinte Lei: Art. 1º Fica ratificado, em todos os seus termos, o Protocolo de Intenções firmado entre o Município de Teste e os demais municípios, visando à constituição do Consórcio Público Intermunicipal Regional, nos termos da Lei Federal nº 11.107/2005.';
      const activity = 'O Consórcio Intermunicipal Vale Verde realizou visita técnica a uma unidade de reciclagem em Santa Clara para discutir a gestão de resíduos e conhecer os equipamentos em funcionamento. A atividade reuniu os gestores municipais da região.';
      const observations = Object.fromEntries((withApproved ? ['Pendente', 'Aprovada'] : ['Pendente']).map(name => [name, {
        firstSeenAt: '2030-10-25T15:00:00Z', lastSeenAt: '2030-10-25T15:00:00Z', item: {
          kind: name === 'Pendente' ? 'gazette' : 'news',
          title: name === 'Pendente' ? 'LEI Nº 101/2030 - Pendente' : 'Consórcio Vale Verde: visita técnica Aprovada',
          summary: name === 'Pendente' ? body : activity, rawText: name === 'Pendente' ? body : activity,
          url: `https://exemplo.gov.br/lei-${name}`, source: 'Diário de teste',
          publishedAt: '2030-10-25T15:00:00Z', sourcePublishedAt: '2030-10-25T15:00:00Z',
        },
      }]));
      const state = JSON.stringify({ version: 4, seen: {}, pending: {}, observations, runs: {}, health: {}, weekly: {} });
      await writeFile(stateFile, state);
      const script = `
        globalThis.fetch = async (url, options) => {
          if (url !== 'https://api.deepseek.com/chat/completions') throw new Error('Rede não autorizada no teste');
          const request = JSON.parse(options.body);
          const input = JSON.parse(request.messages.find(m => m.role === 'user').content);
          return Response.json({ choices: [{ message: { content: JSON.stringify({ relevante: true,
            categoria: input.titulo.includes('Pendente') ? 'CRIAÇÃO' : 'ATUAÇÃO', novo_consorcio: false,
            evidencia: input.titulo.includes('Pendente')
              ? 'Fica ratificado, em todos os seus termos, o Protocolo de Intenções'
              : 'Consórcio Intermunicipal Vale Verde realizou visita técnica' }) } }] });
        };
        await import(${JSON.stringify(new URL('../src/weekly.mjs', import.meta.url).href)});
      `;
      const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
        cwd: fileURLToPath(new URL('..', import.meta.url)), encoding: 'utf8', timeout: 120000,
        env: { ...isolatedTestEnvironment(), AI_REVIEW_ENABLED: 'true', DEEPSEEK_API_KEY: 'fake-test-key',
          NEWS_STATE_FILE: stateFile, OUTPUT_DIR: output, AUTH_DIR: path.join(directory, 'auth'),
          WEEKLY_REBUILD_PREVIEW: 'true', WEEKLY_TEST: 'false', WEEKLY_EDITION: '',
          WEEKLY_REFERENCE_TIME: '2030-10-26T12:01:00Z', GITHUB_STEP_SUMMARY: '' },
      });
      assert.equal(run.status, withApproved ? 0 : 1, run.stderr);
      const report = JSON.parse(await readFile(path.join(output, 'weekly-report.json'), 'utf8'));
      const audit = JSON.parse(await readFile(path.join(output, 'weekly-ai-audit.json'), 'utf8'));
      assert.equal(report.events, withApproved ? 1 : 0);
      assert.equal(audit.calls, withApproved ? 3 : 2);
      assert.equal(audit.audit.filter(v => v.status === 'deferred').length, 1);
      assert.ok(report.highlights.every(v => v.title.includes('Aprovada')));
      assert.equal(await readFile(stateFile, 'utf8'), state);
      await assert.rejects(access(path.join(directory, 'auth')), { code: 'ENOENT' });
    }
    assert.equal(await readFile(new URL('../state/news-state.json', import.meta.url), 'utf8'), production);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('Lei 965/2026 de Boa Vista continua Protocolo no resumo, com corpo e decisão preservados', async () => {
  const state = JSON.parse(await readFile(new URL('../state/news-state.json', import.meta.url), 'utf8'));
  const before = JSON.stringify(state);
  const row = (await read('arquivo-coletas.ndjson')).find(v => v.url === 'https://www.diariomunicipal.com.br/famup/materia/EF411DF6');
  const original = (await read('textos-artigos.ndjson')).find(v => v.documento_id === row.id);
  assert.equal(hash(original.texto), original.texto_sha256);
  const rule = classifyItem({ kind: 'gazette', title: row.titulo, rawText: original.texto });
  assert.equal(rule.category, 'PROTOCOLO');
  assert.equal(rule.proofKind, 'ratified_protocol');
  const window = weeklyWindow(new Date('2026-10-24T17:43:32Z'));
  const report = buildWeeklyReport(await prepareWeeklyState(state, dir, window), window);
  const item = report.highlights.find(v => v.url === row.url);
  assert.equal(item.classification.proofKind, 'ratified_protocol');
  const cached = { status: 'approved', category: 'CRIAÇÃO', promptVersion: AI_PROMPT_VERSION,
    evidence: 'visando à constituição do Consórcio Público Intermunicipal Geoparque Cariri Paraibano (CIGCP)' };
  const reviewed = await reviewWeeklyFindings([item], { aiReviews: { [itemId(item)]: cached } }, {
    apiKey: 'fake-test-key', reviewImpl: async () => { throw new Error('Não chamar a API'); },
  });
  assert.equal(reviewed.calls, 0);
  assert.equal(reviewed.highlights[0].classification.category, 'PROTOCOLO');
  assert.equal(reviewed.audit[0].category, 'PROTOCOLO');
  assert.match(reviewed.highlights[0].classification.stage, /constituição.*não comprovad/);
  assert.equal(JSON.stringify(state), before);
});
