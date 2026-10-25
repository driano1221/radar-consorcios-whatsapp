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
import { prepareWeeklyState } from './lib/weekly-selection.mjs';
import { isWhatsAppCategoryAllowed } from './lib/whatsapp-policy.mjs';
import { fileURLToPath } from 'node:url';

async function main() {
  const config = await loadConfig();
  const state = await loadState(config.stateFile);
  const groupId = process.env.WHATSAPP_WEEKLY_GROUP_ID?.trim() || config.groupId;
  // A prévia sem envio usa a mesma janela da execução agendada. Só a opção
  // explícita de teste mostra uma janela móvel até o instante da prévia.
  const rebuild = process.env.WEEKLY_REBUILD_PREVIEW === 'true';
  const reference = process.env.WEEKLY_REFERENCE_TIME;
  if (config.sendEnabled && (rebuild || reference)) throw new Error('Revisão de edição antiga só pode rodar sem envio.');
  const now = reference ? new Date(reference) : new Date();
  if (!Number.isFinite(now.getTime())) throw new Error('Data de referência inválida.');
  const window = weeklyWindow(now, process.env.WEEKLY_TEST === 'true');
  const reportState = await prepareWeeklyState(state,
    fileURLToPath(new URL('../data/catalogo/', import.meta.url)), window,
    { lookbackHours: config.lookbackHours, minimumScore: config.minimumScore,
      sourceActivations: config.webScrapers?.sites?.filter(site => site.alertsFrom) || [] });
  const edition = process.env.WEEKLY_EDITION?.trim() || '';
  if (edition && !/^[a-z0-9-]{1,40}$/.test(edition)) throw new Error('WEEKLY_EDITION inválida.');
  const id = `${process.env.WEEKLY_TEST === 'true' ? 'test:' : ''}${window.end.toISOString().slice(0, 10)}:${edition ? `${edition}:` : ''}${createHash('sha256').update(groupId).digest('hex').slice(0, 12)}`;
  state.weekly ||= {};
  // Rebuilding is a read-only preview. Never replace receipts or resume a sent
  // edition with new contents under the same deterministic message IDs.
  const existing = rebuild ? undefined : state.weekly[id];
  if (config.sendEnabled && existing?.sentAt) {
    console.log('Resumo desta semana já enviado para este destino.');
    return;
  }
  state.shortLinks ||= {};
  const baseReport = existing?.report || buildWeeklyReport(reportState, window, config.minimumScore);
  const ai = config.aiReviewEnabled && !existing?.text && !existing?.messages
    ? await reviewWeeklyFindings(baseReport.highlights, state, { apiKey: process.env.DEEPSEEK_API_KEY }) : null;
  const highlights = (ai?.highlights || baseReport.highlights).filter(isWhatsAppCategoryAllowed);
  if (existing && highlights.length !== baseReport.highlights.length) {
    throw new Error('Edição preparada contém categoria bloqueada no WhatsApp; exige nova edição revisada, sem alterar recibos.');
  }
  const reviewedReport = { ...baseReport, highlights, events: highlights.length,
    categories: Object.fromEntries([...new Set(highlights.map((item) => item.classification.category))]
      .map((category) => [category, highlights.filter((item) => item.classification.category === category).length])),
    sources: Object.fromEntries([...new Set(highlights.map((item) => item.source))]
      .map((source) => [source, highlights.filter((item) => item.source === source).length])) };
  const report = existing?.text || existing?.messages ? reviewedReport : { ...reviewedReport, highlights: [] };
  if (!existing?.text && !existing?.messages) {
    for (const item of reviewedReport.highlights) {
      const presented = await presentItem(item, state.shortLinks);
      const target = /^(?:https:\/\/cleanuri\.com\/|https:\/\/is\.gd\/)/.test(presented.displayUrl || '')
        ? item.url : presented.displayUrl || item.url;
      const displayUrl = await shortenLongUrl(target, state.shortLinks, fetch, 100);
      report.highlights.push({ ...presented, displayUrl });
    }
  }
  const messages = existing?.messages || (existing?.text
    ? [existing.text] : formatWeeklyMessages(report, process.env.WEEKLY_TEST === 'true'));
  const text = messages.join('\n\n──────────\n\n');
  await mkdir(config.outputDir, { recursive: true });
  await writeFile(path.join(config.outputDir, 'weekly-preview.txt'), text + '\n');
  await writeFile(path.join(config.outputDir, 'weekly-report.json'), JSON.stringify(report, null, 2) + '\n');
  await writeFile(path.join(config.outputDir, 'weekly-selection-audit.json'), JSON.stringify(reportState.weeklySelectionAudit, null, 2) + '\n');
  await writeFile(path.join(config.outputDir, 'weekly-ai-audit.json'), JSON.stringify({ enabled: config.aiReviewEnabled,
    calls: ai?.calls || 0, audit: ai?.audit || [] }, null, 2) + '\n');
  const deferred = ai?.audit.filter((entry) => entry.status === 'deferred').length || 0;
  if (deferred) {
    console.warn(`[semanal] ${deferred} achado(s) adiado(s), fora do resumo; consulte weekly-ai-audit.json.`);
    if (!report.events) throw new Error('Nenhum achado aprovado após a revisão; resumo não enviado.');
  }
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
