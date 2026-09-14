import { readFile } from 'node:fs/promises';

// O alerta usa o GitHub, pois um WhatsApp desconectado não pode avisar sobre si.
const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GITHUB_TOKEN;
if (!repository || !token) throw new Error('GITHUB_REPOSITORY e GITHUB_TOKEN são necessários para alertas.');
const mode = process.env.HEALTH_MODE || 'radar';
const failed = process.env.RUN_STATUS === 'failure' || process.env.RUN_STATUS === 'cancelled';
let sources = [];
if (mode === 'radar') {
  try {
    const state = JSON.parse(await readFile('state/news-state.json', 'utf8'));
    sources = Object.values(state.health || {}).filter((h) => h.consecutiveFailures >= 3)
      .map((h) => h.name).sort();
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
const incident = failed || sources.length > 0;
const title = `[Radar automático] ${mode === 'session' ? 'Sessão WhatsApp' : mode === 'weekly' ? 'Resumo semanal' : 'Coleta e envio'} requer atenção`;
const signature = `${failed ? 'execution-failed' : 'execution-ok'}:${sources.join('|')}`;
const marker = `<!-- radar-health:${mode}:${signature} -->`;
const url = `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
async function api(route, method = 'GET', data) {
  const r = await fetch(`https://api.github.com/repos/${repository}${route}`, {
    method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`GitHub alertas: HTTP ${r.status}`);
  return r.json();
}
let found;
for (let page = 1; page <= 5 && !found; page += 1) {
  const issues = await api(`/issues?state=open&per_page=100&page=${page}`);
  found = issues.find((i) => !i.pull_request && i.title === title && i.user?.login === 'github-actions[bot]');
  if (issues.length < 100) break;
}
if (incident) {
  const body = `${marker}\n${failed ? 'A execução falhou. Verifique o erro no log.' : 'A coleta continua, mas há fontes com três ou mais falhas consecutivas.'}\n\n${sources.map((s) => `- ${s}`).join('\n')}\n\n[Execução e logs](${url})\n\nEste alerta é atualizado apenas quando a condição muda e encerrado automaticamente após a recuperação. As notificações seguem suas preferências do GitHub.`;
  if (!found) { await api('/issues', 'POST', { title, body }); console.log('Alerta aberto no GitHub.'); }
  else if (!found.body?.includes(marker)) { await api(`/issues/${found.number}`, 'PATCH', { body }); console.log('Alerta atualizado.'); }
  else console.log('Incidente já registrado; sem notificação repetida.');
} else if (found) {
  await api(`/issues/${found.number}`, 'PATCH', { state: 'closed', state_reason: 'completed' });
  console.log('Alerta encerrado após recuperação.');
} else console.log('Saúde normal; nenhum alerta.');
