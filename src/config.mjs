import { readFile } from 'node:fs/promises';
import path from 'node:path';

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'sim', 'on'].includes(String(value).toLowerCase());
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function loadConfig() {
  const projectRoot = path.resolve(import.meta.dirname, '..');
  const configPath = path.resolve(
    process.env.RADAR_CONFIG_PATH || path.join(projectRoot, 'config', 'default.json'),
  );
  const fileConfig = JSON.parse(await readFile(configPath, 'utf8'));

  return {
    ...fileConfig,
    projectRoot,
    configPath,
    sendEnabled: parseBoolean(process.env.SEND_ENABLED, false),
    groupId: process.env.WHATSAPP_GROUP_ID?.trim() || '',
    authDir: path.resolve(process.env.AUTH_DIR || path.join(projectRoot, '.local', 'auth')),
    stateFile: path.resolve(
      process.env.NEWS_STATE_FILE || path.join(projectRoot, 'state', 'news-state.json'),
    ),
    outputDir: path.resolve(process.env.OUTPUT_DIR || path.join(projectRoot, 'output')),
    maxPostsPerRun: parsePositiveInteger(
      process.env.MAX_POSTS_PER_RUN,
      fileConfig.maxPostsPerRun,
    ),
    maxPostsPerDay: parsePositiveInteger(
      process.env.MAX_POSTS_PER_DAY,
      fileConfig.maxPostsPerDay,
    ),
    lookbackHours: parsePositiveInteger(process.env.LOOKBACK_HOURS, fileConfig.lookbackHours),
  };
}

export { parseBoolean };
