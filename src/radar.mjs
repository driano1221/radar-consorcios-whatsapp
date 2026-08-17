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
import { formatRunSummary, formatScraperSummary, formatWhatsAppMessage } from './lib/format.mjs';
import { fetchGoogleNews } from './lib/sources/google-news.mjs';
import { fetchQueridoDiario } from './lib/sources/querido-diario.mjs';
import { fetchRssFeeds } from './lib/sources/rss-feeds.mjs';
import { fetchWebScrapers } from './lib/sources/web-scrapers.mjs';
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
    ['Scrapers web', fetchWebScrapers(config.webScrapers, since)],
  ];
  const results = await Promise.allSettled(sourceRequests.map(([, request]) => request));
  const collected = [];
  let scraperDiagnostics = [];
  let successfulSources = 0;
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      const payload = Array.isArray(result.value)
        ? { items: result.value, ok: true, diagnostics: [] }
        : result.value;
      if (payload.ok !== false) successfulSources += 1;
      collected.push(...payload.items);
      if (sourceRequests[index][0] === 'Scrapers web') {
        scraperDiagnostics = payload.diagnostics || [];
      }
      console.log(`[fonte] ${sourceRequests[index][0]}: ${payload.items.length} item(ns)`);
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
  const previewRelevant = relevant.filter((item) => item.previewOnly);
  const publishableRelevant = relevant.filter((item) => !item.previewOnly);
  const sentToday = countSentToday(state);
  const remainingToday = Math.max(0, config.maxPostsPerDay - sentToday);
  const unseen = selectUnseen(publishableRelevant, state).slice(
    0,
    Math.min(config.maxPostsPerRun, remainingToday),
  );
  const scraperPreview = selectUnseen(previewRelevant, state).slice(0, 50);
  const scraperObservations = collected.filter((item) => item.scraper);

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
  await writeFile(
    path.join(config.outputDir, 'scraper-observations.json'),
    `${JSON.stringify(scraperObservations, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(config.outputDir, 'scraper-candidates.json'),
    `${JSON.stringify(scraperPreview, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(config.outputDir, 'scraper-health.json'),
    `${JSON.stringify(scraperDiagnostics, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(config.outputDir, 'scraper-preview.txt'),
    `${scraperPreview.map(formatWhatsAppMessage).join('\n\n──────────\n\n')}\n`,
    'utf8',
  );

  console.log(
    `${collected.length} itens coletados; ${relevant.length} relevantes; ${unseen.length} novos candidatos; ` +
      `${scraperPreview.length} candidato(s) de scraper em previa; ` +
      `${sentToday}/${config.maxPostsPerDay} enviados hoje.`,
  );
  const scraperSummary = formatScraperSummary(
    scraperPreview,
    scraperObservations.length,
    scraperDiagnostics,
  );
  console.log(scraperSummary);

  if (!config.sendEnabled) {
    console.log('SEND_ENABLED=false: prévia concluída sem publicar no WhatsApp.');
    const summary = formatRunSummary(unseen, false);
    console.log(summary);
    await appendGitHubSummary(`${summary}\n${scraperSummary}`);
    return;
  }

  if (!config.groupId) throw new Error('Defina WHATSAPP_GROUP_ID antes de habilitar o envio.');
  if (!unseen.length) {
    await saveState(config.stateFile, state);
    await appendGitHubSummary(`${formatRunSummary([], true)}\n${scraperSummary}`);
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
  await appendGitHubSummary(
    `${formatRunSummary(sent.map((entry) => entry.item), true)}\n${scraperSummary}`,
  );
  console.log(`${sent.length} mensagem(ns) publicada(s) no grupo.`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
