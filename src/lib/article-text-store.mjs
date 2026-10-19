import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { canonicalUrl } from './dedupe.mjs';

// Preserve a complete reading without persisting obvious personal identifiers.
export function redactPublicText(value) {
  return String(value || '')
    .replace(/\b\d{3}\s*\.\s*\d{3}\s*\.\s*\d{3}\s*-\s*\d{2}\b/g, '[CPF omitido]')
    .replace(/\b\d{11}\b/g, '[identificador omitido]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email omitido]');
}

export async function reuseArticleTexts(directory, items) {
  let rows;
  try { rows = (await readFile(path.join(directory, 'textos-artigos.ndjson'), 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse); }
  catch (error) { if (error.code === 'ENOENT') return { items, reused: 0 }; throw error; }
  const byUrl = new Map();
  for (const row of rows) {
    if (!row.texto || row.texto.length < 100 ||
        createHash('sha256').update(row.texto).digest('hex') !== row.texto_sha256) continue;
    for (const url of [row.url_original, row.url_artigo].filter(Boolean)) byUrl.set(canonicalUrl(url), row);
  }
  let reused = 0;
  const host = raw => { try { return new URL(raw).hostname.replace(/^www\./, ''); } catch { return ''; } };
  return { items: items.map(item => {
    if (item.contentProvenance === 'pagina_original' || item.kind === 'gazette') return item;
    const saved = byUrl.get(canonicalUrl(item.url || ''));
    if (!saved) return item;
    // Some historical recoveries stored a republication under the Google ID.
    // Reuse only the actual publisher. Alternatives retain their separate layer.
    const publisher = host(item.url) === 'news.google.com' ? host(item.sourceUrl) : host(item.url);
    if (!publisher || publisher !== host(saved.url_artigo)) return item;
    reused++;
    return { ...item, rawText: saved.texto, summary: saved.texto.slice(0, 1800),
      articleUrl: saved.url_artigo, articleReader: saved.leitor,
      articleTextRecoveredAt: saved.recuperado_em, articleTextReused: true,
      ...(saved.url_leitura ? { articleFetchUrl: saved.url_leitura, articleVariant: saved.variante } : {}),
      contentProvenance: 'pagina_original' };
  }), reused };
}

// Keep the first complete reading; a later shorter response must not overwrite
// evidence recovered or checked by an editor. Content changes need a new review.
export async function persistArticleTexts(directory, items, now = new Date()) {
  const file = path.join(directory, 'textos-artigos.ndjson');
  let rows = [];
  try { rows = (await readFile(file, 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const byId = new Map(rows.map((row) => [row.documento_id, row]));
  let added = 0;
  for (const item of items) {
    if (item.contentProvenance !== 'pagina_original' || item.extractionError || !item.rawText) continue;
    const url = canonicalUrl(item.url || '');
    if (!/^https?:\/\//.test(url)) continue;
    const id = createHash('sha256').update(url).digest('hex');
    if (byId.has(id)) continue;
    const texto = redactPublicText(item.rawText);
    if (texto.trim().length < 100) continue;
    byId.set(id, { documento_id: id, url_original: url,
      url_artigo: item.articleUrl || url, recuperado_em: now.toISOString(),
      leitor: item.articleReader || 'corpo_original',
      ...(item.articleFetchUrl ? { url_leitura: item.articleFetchUrl, variante: item.articleVariant } : {}),
      texto_sha256: createHash('sha256').update(texto).digest('hex'), texto });
    added += 1;
  }
  if (added) {
    await mkdir(directory, { recursive: true });
    await writeFile(file, [...byId.values()].sort((a, b) => a.documento_id.localeCompare(b.documento_id))
      .map(JSON.stringify).join('\n') + '\n', 'utf8');
  }
  return added;
}
