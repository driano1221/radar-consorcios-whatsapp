import { createHash } from 'node:crypto';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './config.mjs';
import { loadState, saveState } from './lib/dedupe.mjs';
import { weeklyWindow, buildWeeklyReport } from './lib/history.mjs';
import { formatWeeklyMessage } from './lib/format.mjs';
import { sendMessages } from './lib/whatsapp.mjs';
import { presentItem, shortenLongUrl } from './lib/message-presentation.mjs';

async function main() {
  const config = await loadConfig();
  const state = await loadState(config.stateFile);
  const groupId = process.env.WHATSAPP_WEEKLY_GROUP_ID?.trim() || config.groupId;
  const window = weeklyWindow(new Date(), !config.sendEnabled || process.env.WEEKLY_TEST === 'true');
  const edition = process.env.WEEKLY_EDITION?.trim() || '';
  if (edition && !/^[a-z0-9-]{1,40}$/.test(edition)) throw new Error('WEEKLY_EDITION inválida.');
  const id = `${process.env.WEEKLY_TEST === 'true' ? 'test:' : ''}${window.end.toISOString().slice(0, 10)}:${edition ? `${edition}:` : ''}${createHash('sha256').update(groupId).digest('hex').slice(0, 12)}`;
  state.weekly ||= {};
  const existing = state.weekly[id];
  if (config.sendEnabled && existing?.sentAt) {
    console.log('Resumo desta semana já enviado para este destino.');
    return;
  }
  state.shortLinks ||= {};
  const baseReport = existing?.report || buildWeeklyReport(state, window, config.minimumScore);
  const report = existing?.text ? baseReport : { ...baseReport, highlights: [] };
  if (!existing?.text) {
    for (const item of baseReport.highlights) {
      const presented = await presentItem(item, state.shortLinks);
      const displayUrl = await shortenLongUrl(presented.displayUrl || item.url, state.shortLinks, fetch, 80);
      report.highlights.push({ ...presented, displayUrl });
    }
  }
  const text = existing?.text || formatWeeklyMessage(report, process.env.WEEKLY_TEST === 'true');
  await mkdir(config.outputDir, { recursive: true });
  await writeFile(path.join(config.outputDir, 'weekly-preview.txt'), text + '\n');
  await writeFile(path.join(config.outputDir, 'weekly-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Resumo semanal\n\n${text}\n`);
  if (!config.sendEnabled) return;
  state.weekly[id] ||= { report, text, createdAt: new Date().toISOString(), attempts: 0 };
  state.weekly[id].attempts += 1;
  await saveState(config.stateFile, state);
  await sendMessages({ authDir: config.authDir, groupId,
    messages: [{ text, messageId: createHash('sha256').update(`weekly:${id}`).digest('hex').slice(0, 32).toUpperCase() }],
    onSent: async () => { state.weekly[id].sentAt = new Date().toISOString(); await saveState(config.stateFile, state); } });
  console.log('Resumo semanal enviado.');
}
main().then(() => setTimeout(() => process.exit(0), 500)).catch((error) => {
  console.error(error.message); setTimeout(() => process.exit(1), 500);
});
