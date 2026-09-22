import { readFile, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function shouldCollect(state, now = new Date(), intervalMs = 50 * 60_000) {
  const latest = Math.max(0, ...Object.values(state.runs || {}).map((run) => Date.parse(run.at) || 0));
  return !latest || now.getTime() - latest >= intervalMs || now.getTime() < latest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const scheduled = process.env.GITHUB_EVENT_NAME === 'schedule';
  const state = scheduled ? JSON.parse(await readFile('state/news-state.json', 'utf8')) : {};
  const run = !scheduled || shouldCollect(state);
  console.log(run ? 'Coleta necessária.' : 'Coleta recente registrada; execução redundante dispensada.');
  if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `run=${run}\n`);
}
