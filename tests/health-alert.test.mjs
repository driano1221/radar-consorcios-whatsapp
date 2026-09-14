import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('alerta abre uma ocorrência, evita repetição e encerra na recuperação', () => {
  const moduleUrl = new URL('../scripts/report-health.mjs', import.meta.url).href;
  for (const scenario of ['create', 'unchanged', 'recover']) {
    const script = `
      const calls = [];
      globalThis.fetch = async (url, options) => {
        if (!url.startsWith('https://api.github.com/repos/test/radar/')) throw new Error('Destino inesperado');
        calls.push({method: options.method, data: options.body ? JSON.parse(options.body) : null});
        const issue = {number: 7, title: '[Radar automático] Sessão WhatsApp requer atenção', user: {login: 'github-actions[bot]'}, body: '<!-- radar-health:session:execution-failed: -->'};
        return Response.json(options.method === 'GET' ? (${JSON.stringify(scenario)} === 'create' ? [] : [issue]) : {number: 7});
      };
      await import(${JSON.stringify(moduleUrl)});
      console.log('CALLS=' + JSON.stringify(calls));
    `;
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, GITHUB_REPOSITORY: 'test/radar', GITHUB_TOKEN: 'fake-test-token', GITHUB_RUN_ID: '42', HEALTH_MODE: 'session', RUN_STATUS: scenario === 'recover' ? 'success' : 'failure' },
      encoding: 'utf8', timeout: 10000,
    });
    assert.equal(run.status, 0, run.stderr);
    const calls = JSON.parse(run.stdout.split('CALLS=')[1]);
    if (scenario === 'create') assert.deepEqual(calls.map((c) => c.method), ['GET', 'POST']);
    if (scenario === 'unchanged') assert.deepEqual(calls.map((c) => c.method), ['GET']);
    if (scenario === 'recover') assert.equal(calls[1].data.state, 'closed');
  }
});
