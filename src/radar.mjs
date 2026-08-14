import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './config.mjs';
import { classifyItem } from './lib/classifier.mjs';
import {
  loadState,
  markSeen,
  pruneState,
  saveState,
  selectUnseen,
  countSentToday,
} from './lib/dedupe.mjs';
import { formatRunSummary, formatWhatsAppMessage } from './lib/format.mjs';
import { fetchGoogleNews } from './lib/sources/google-news.mjs';
import { fetchQueridoDiario } from './lib/sources/querido-diario.mjs';
import { fetchRssFeeds } from './lib/sources/rss-feeds.mjs';
import { sendMessages } from './lib/whatsapp.mjs';

async function appendGitHubSummary(markdown) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown, 'utf8');
}

async function main() {
  const config = await loadConfig();
  const since = new Date(Date.now() - config.lookbackHours * 60 * 60 * 1000);
  const state = await loadState(config.stateFile);
  pruneState(state, config.stateRetentionDays);

  console.log(`Coletando publicações desde ${since.toISOString()}...`);
  const sourceRequests = [
    ['Google News', fetchGoogleNews(config.googleNews, since)],
    ['Querido Diário', fetchQueridoDiario(config.queridoDiario, since)],
    ['Feeds RSS', fetchRssFeeds(config.rssFeeds, since)],
  ];
  const results = await Promise.allSettled(sourceRequests.map(([, request]) => request));
  const collected = [];
  let successfulSources = 0;
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      successfulSources += 1;
      collected.push(...result.value);
      console.log(`[fonte] ${sourceRequests[index][0]}: ${result.value.length} item(ns)`);
    }
    else console.warn(`[fonte] ${sourceRequests[index][0]}: ${result.reason.message}`);
  }
  if (!successfulSources) throw new Error('Todas as fontes falharam; o radar não continuará.');

  const relevant = collected
    .map((item) => ({ ...item, classification: classifyItem(item) }))
    .filter(
      (item) =>
        item.classification.category !== 'GERAL' &&
        item.classification.score >= config.minimumScore,
    )
    .sort((a, b) => {
      const scoreDifference = b.classification.score - a.classification.score;
      return scoreDifference || new Date(b.publishedAt) - new Date(a.publishedAt);
    });
  const sentToday = countSentToday(state);
  const remainingToday = Math.max(0, config.maxPostsPerDay - sentToday);
  const unseen = selectUnseen(relevant, state).slice(
    0,
    Math.min(config.maxPostsPerRun, remainingToday),
  );

  await mkdir(config.outputDir, { recursive: true });
  await writeFile(
    path.join(config.outputDir, 'candidates.json'),
    `${JSON.stringify(unseen, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(config.outputDir, 'preview.txt'),
    `${unseen.map(formatWhatsAppMessage).join('\n\n──────────\n\n')}\n`,
    'utf8',
  );

  console.log(
    `${collected.length} itens coletados; ${relevant.length} relevantes; ${unseen.length} novos candidatos; ` +
      `${sentToday}/${config.maxPostsPerDay} enviados hoje.`,
  );

  if (!config.sendEnabled) {
    console.log('SEND_ENABLED=false: prévia concluída sem publicar no WhatsApp.');
    const summary = formatRunSummary(unseen, false);
    console.log(summary);
    await appendGitHubSummary(summary);
    return;
  }

  if (!config.groupId) throw new Error('Defina WHATSAPP_GROUP_ID antes de habilitar o envio.');
  if (!unseen.length) {
    await saveState(config.stateFile, state);
    await appendGitHubSummary(formatRunSummary([], true));
    return;
  }

  const payload = unseen.map((item) => ({ item, text: formatWhatsAppMessage(item) }));
  const sent = await sendMessages({
    authDir: config.authDir,
    groupId: config.groupId,
    messages: payload,
    delayMs: config.messageDelayMs,
    onSent: async (entry) => {
      markSeen(state, entry.item);
      await saveState(config.stateFile, state);
    },
  });
  await appendGitHubSummary(formatRunSummary(sent.map((entry) => entry.item), true));
  console.log(`${sent.length} mensagem(ns) publicada(s) no grupo.`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
