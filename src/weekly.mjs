import { createHash } from 'node:crypto';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './config.mjs';
import { loadState, saveState } from './lib/dedupe.mjs';
import { weeklyWindow, buildWeeklyReport } from './lib/history.mjs';
import { formatWeeklyMessages } from './lib/format.mjs';
import { sendMessages } from './lib/whatsapp.mjs';
import { presentItem, shortenLongUrl } from './lib/message-presentation.mjs';
import { reviewWeeklyFindings } from './lib/ai-review.mjs';

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
  const ai = config.aiReviewEnabled && !existing?.text && !existing?.messages
    ? await reviewWeeklyFindings(baseReport.highlights, state, { apiKey: process.env.DEEPSEEK_API_KEY }) : null;
  const reviewedReport = ai ? { ...baseReport, highlights: ai.highlights, events: ai.highlights.length,
    categories: Object.fromEntries([...new Set(ai.highlights.map((item) => item.classification.category))]
      .map((category) => [category, ai.highlights.filter((item) => item.classification.category === category).length])),
    sources: Object.fromEntries([...new Set(ai.highlights.map((item) => item.source))]
      .map((source) => [source, ai.highlights.filter((item) => item.source === source).length])) } : baseReport;
  const report = existing?.text || existing?.messages ? reviewedReport : { ...reviewedReport, highlights: [] };
  if (!existing?.text && !existing?.messages) {
    for (const item of reviewedReport.highlights) {
      const presented = await presentItem(item, state.shortLinks);
      const displayUrl = await shortenLongUrl(presented.displayUrl || item.url, state.shortLinks, fetch, 50);
      report.highlights.push({ ...presented, displayUrl });
    }
  }
  const messages = existing?.messages || (existing?.text
    ? [existing.text] : formatWeeklyMessages(report, process.env.WEEKLY_TEST === 'true'));
  const text = messages.join('\n\n──────────\n\n');
  await mkdir(config.outputDir, { recursive: true });
  await writeFile(path.join(config.outputDir, 'weekly-preview.txt'), text + '\n');
  await writeFile(path.join(config.outputDir, 'weekly-report.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(path.join(config.outputDir, 'weekly-ai-audit.json'), JSON.stringify({ enabled: config.aiReviewEnabled,
    calls: ai?.calls || 0, audit: ai?.audit || [] }, null, 2) + '\n');
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `## Resumo semanal\n\n${text}\n`);
  if (!config.sendEnabled) return;
  state.weekly[id] ||= { report, messages, createdAt: new Date().toISOString(), attempts: 0, sentParts: {} };
  state.weekly[id].messages ||= messages;
  state.weekly[id].sentParts ||= {};
  state.weekly[id].attempts += 1;
  await saveState(config.stateFile, state);
  const remaining = messages.map((message, index) => ({ text: message, index,
    messageId: createHash('sha256').update(`weekly:${id}:${index}`).digest('hex').slice(0, 32).toUpperCase() }))
    .filter((message) => !state.weekly[id].sentParts[message.index]);
  await sendMessages({ authDir: config.authDir, groupId,
    messages: remaining,
    onSent: async (message) => {
      state.weekly[id].sentParts[message.index] = new Date().toISOString();
      if (Object.keys(state.weekly[id].sentParts).length === messages.length) state.weekly[id].sentAt = new Date().toISOString();
      await saveState(config.stateFile, state);
    } });
  console.log(`Resumo semanal enviado em ${messages.length} parte(s).`);
}
main().then(() => setTimeout(() => process.exit(0), 500)).catch((error) => {
  console.error(error.message); setTimeout(() => process.exit(1), 500);
});
