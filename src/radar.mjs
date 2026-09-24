import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './config.mjs';
import { classifyItem, isPublishableClassification } from './lib/classifier.mjs';
import {
  loadState,
  markSeen,
  enqueuePending,
  listPending,
  markPendingFailure,
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
import { buildSourceFunnel, formatSourceFunnel } from './lib/run-metrics.mjs';
import { observeRun } from './lib/history.mjs';
import { fetchSapl } from './lib/sources/sapl.mjs';
import { fetchCiga } from './lib/sources/ciga.mjs';
import { presentItem } from './lib/message-presentation.mjs';
import { applyAiReview, reviewQueue, shouldReviewWithAi } from './lib/ai-review.mjs';
import { itemId } from './lib/dedupe.mjs';

async function appendGitHubSummary(markdown) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  await appendFile(process.env.GITHUB_STEP_SUMMARY, markdown, 'utf8');
}

async function main() {
  const config = await loadConfig();
  if ((config.sendEnabled || config.aiPreview) && config.aiReviewEnabled && !process.env.DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY ausente; envio e prévia com IA suspensos para não mostrar itens sem revisão.');
  }
  const since = new Date(Date.now() - config.lookbackHours * 60 * 60 * 1000);
  const state = await loadState(config.stateFile);
  pruneState(state, config.stateRetentionDays, config.pendingRetentionDays);

  console.log(`Coletando publicações desde ${since.toISOString()}...`);
  const sourceRequests = [
    ['Google News', () => fetchGoogleNews(config.googleNews, since)],
    ['Querido Diário', () => fetchQueridoDiario(config.queridoDiario, since)],
    ['Feeds RSS', () => fetchRssFeeds(config.rssFeeds, since)],
    ['Scrapers web', () => fetchWebScrapers(config.webScrapers, since)],
    ['SAPL', () => fetchSapl(config.sapl, since)],
    ['CIGA', () => fetchCiga(config.ciga, since)],
  ];
  const results = await Promise.allSettled(
    sourceRequests.map(async ([name, request]) => {
      const startedAt = Date.now();
      const value = await request();
      return { name, value, durationMs: Date.now() - startedAt };
    }),
  );
  const collected = [];
  let scraperDiagnostics = [];
  let successfulSources = 0;
  const sourceHealth = [];
  for (const [index, result] of results.entries()) {
    if (result.status === 'fulfilled') {
      const { value, durationMs } = result.value;
      const payload = Array.isArray(value) ? { items: value, ok: true, diagnostics: [] } : value;
      if (payload.ok !== false) successfulSources += 1;
      collected.push(...payload.items);
      if (sourceRequests[index][0] === 'Scrapers web') {
        scraperDiagnostics = payload.diagnostics || [];
      }
      sourceHealth.push({
        name: sourceRequests[index][0], status: payload.ok === false || payload.degraded ? 'degraded' : 'ok',
        itemCount: payload.items.length, durationMs,
      });
      sourceHealth.push(...(payload.diagnostics || []));
      console.log(
        `[fonte] ${sourceRequests[index][0]}: ${payload.items.length} item(ns) em ${durationMs} ms`,
      );
    }
    else {
      sourceHealth.push({
        name: sourceRequests[index][0], status: 'error', itemCount: 0,
        message: result.reason.message,
      });
      console.warn(`[fonte] ${sourceRequests[index][0]}: ${result.reason.message}`);
    }
  }
  const classified = collected.map((item) => {
    const classifiedItem = { ...item, classification: classifyItem(item) };
    return config.aiReviewEnabled
      ? applyAiReview(classifiedItem, state.aiReviews?.[itemId(classifiedItem)]) : classifiedItem;
  });
  if (!successfulSources) throw new Error('Todas as fontes falharam; o radar não continuará.');
  const relevant = classified
    .filter((item) => isPublishableClassification(item.classification, config.minimumScore))
    .sort((a, b) => {
      const scoreDifference = b.classification.score - a.classification.score;
      return scoreDifference || new Date(b.publishedAt) - new Date(a.publishedAt);
    });
  const previewRelevant = relevant.filter((item) => item.previewOnly);
  const publishableRelevant = relevant.filter((item) => !item.previewOnly);
  const sentToday = countSentToday(state);
  const remainingToday = Math.max(0, config.maxPostsPerDay - sentToday);
  const discovered = selectUnseen(publishableRelevant, state);
  if (config.sendEnabled) enqueuePending(state, discovered);
  if (config.persistState) await saveState(config.stateFile, state);
  const available = config.sendEnabled ? listPending(state) : discovered;
  const reviewResult = shouldReviewWithAi(config, remainingToday)
    ? await reviewQueue(available, state, {
      apiKey: process.env.DEEPSEEK_API_KEY,
      maxPosts: Math.min(config.maxPostsPerRun, remainingToday),
      maxCallsRun: config.maxAiReviewsPerRun,
      maxCallsDay: config.maxAiReviewsPerDay,
    }) : null;
  const unseen = reviewResult?.selected || available.slice(0, Math.min(config.maxPostsPerRun, remainingToday));
  if (reviewResult) {
    console.log(`[ia] ${reviewResult.callsRun} chamada(s); ${reviewResult.audit.filter((r) => r.status === 'approved').length} aprovado(s); ` +
      `${reviewResult.audit.filter((r) => r.status === 'rejected').length} rejeitado(s); ` +
      `${reviewResult.audit.filter((r) => ['deferred', 'disputed'].includes(r.status)).length} pendente(s).`);
    const apiFailure = reviewResult.audit.find((entry) => entry.status === 'deferred' && entry.reason !== 'limite de chamadas');
    sourceHealth.push({ name: 'DeepSeek', status: apiFailure ? 'error' : 'ok',
      itemCount: reviewResult.callsRun, ...(apiFailure ? { message: apiFailure.reason } : {}) });
  }
  const finalClassified = classified.map((item) => config.aiReviewEnabled
    ? applyAiReview(item, state.aiReviews?.[itemId(item)]) : item);
  observeRun(state, finalClassified, sourceHealth, config.minimumScore, new Date(),
    process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_RUN_ID}:${process.env.GITHUB_RUN_ATTEMPT || 1}` : undefined);
  if (config.persistState) await saveState(config.stateFile, state);
  state.shortLinks ||= {};
  const presentedUnseen = [];
  for (const item of unseen) presentedUnseen.push(await presentItem(item, state.shortLinks));
  const scraperPreview = selectUnseen(previewRelevant, state).slice(0, 50);
  const scraperObservations = collected.filter((item) => item.scraper);
  const funnel = buildSourceFunnel({
    collected,
    classified,
    relevant,
    publishable: publishableRelevant,
    unseen: discovered,
    selected: unseen,
    minimumScore: config.minimumScore,
  });
  const funnelSummary = formatSourceFunnel(funnel);

  await mkdir(config.outputDir, { recursive: true });
  await writeFile(
    path.join(config.outputDir, 'candidates.json'),
    `${JSON.stringify(unseen, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(config.outputDir, 'preview.txt'),
    `${presentedUnseen.map(formatWhatsAppMessage).join('\n\n──────────\n\n')}\n`,
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
  await writeFile(
    path.join(config.outputDir, 'source-funnel.json'),
    `${JSON.stringify(funnel, null, 2)}\n`,
    'utf8',
  );
  await writeFile(path.join(config.outputDir, 'source-funnel.md'), funnelSummary, 'utf8');
  await writeFile(
    path.join(config.outputDir, 'source-health.json'),
    `${JSON.stringify({ generatedAt: new Date().toISOString(), sources: sourceHealth }, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    path.join(config.outputDir, 'classification-audit.json'),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      minimumScore: config.minimumScore,
      items: finalClassified.map(({ title, url, source, sourceUrl, kind, previewOnly, classification, aiReview }) => ({
        title, url, source, sourceUrl, kind, previewOnly, classification, aiReview,
      })),
    }, null, 2)}\n`,
    'utf8',
  );
  await writeFile(path.join(config.outputDir, 'ai-review-audit.json'),
    `${JSON.stringify({ enabled: config.aiReviewEnabled, ...reviewResult }, null, 2)}\n`, 'utf8');

  console.log(
    `${collected.length} itens coletados; ${relevant.length} relevantes; ${discovered.length} novos candidatos; ` +
      `${config.sendEnabled ? listPending(state).length : 0} em fila; ${unseen.length} selecionado(s); ` +
      `${scraperPreview.length} candidato(s) de scraper em previa; ` +
      `${sentToday}/${config.maxPostsPerDay} enviados hoje.`,
  );
  const scraperSummary = formatScraperSummary(
    scraperPreview,
    scraperObservations.length,
    scraperDiagnostics,
  );
  console.log(scraperSummary);
  console.log(funnelSummary);

  if (!config.sendEnabled) {
    console.log(`SEND_ENABLED=false: prévia concluída sem publicar no WhatsApp${reviewResult ? ', já com a revisão da IA' : ' (sem revisão da IA; use ai_preview para incluí-la)'}.`);
    const summary = formatRunSummary(presentedUnseen, false);
    console.log(summary);
    await appendGitHubSummary(`${summary}\n${scraperSummary}\n${funnelSummary}`);
    return;
  }

  if (!config.groupId) throw new Error('Defina WHATSAPP_GROUP_ID antes de habilitar o envio.');
  if (!unseen.length) {
    await saveState(config.stateFile, state);
    await appendGitHubSummary(`${formatRunSummary([], true)}\n${scraperSummary}\n${funnelSummary}`);
    return;
  }

  const payload = unseen.map((item, index) => ({ item, presented: presentedUnseen[index], text: formatWhatsAppMessage(presentedUnseen[index]) }));
  await saveState(config.stateFile, state);
  let sent;
  try {
    sent = await sendMessages({
      authDir: config.authDir,
      groupId: config.groupId,
      messages: payload,
      delayMs: config.messageDelayMs,
      onSent: async (entry) => {
        markSeen(state, entry.item);
        await saveState(config.stateFile, state);
      },
    });
  } catch (error) {
    markPendingFailure(state, unseen, error);
    await saveState(config.stateFile, state);
    throw error;
  }
  await appendGitHubSummary(
    `${formatRunSummary(sent.map((entry) => entry.presented), true)}\n${scraperSummary}\n${funnelSummary}`,
  );
  console.log(`${sent.length} mensagem(ns) publicada(s) no grupo.`);
}

main().then(() => setTimeout(() => process.exit(0), 500)).catch((error) => {
  console.error(error.stack || error.message);
  setTimeout(() => process.exit(1), 500);
});
