import { load } from 'cheerio';
import { normalizeWhitespace } from './text.mjs';
import { fetchWithRetry } from './http.mjs';

// The official portal publishes PDF pages as SVG with an embedded character
// layer (MuPDF data-text). Read that layer, never infer words from glyph names.
export function parseAmmSvg(svg) {
  const $ = load(svg, { xmlMode: true });
  if (!$('svg').length) throw new Error('AMM-MT: página não é SVG');
  let text = '', lastY;
  $('use[data-text],text').each((_, el) => {
    if ($(el).parents('defs,clipPath,mask').length) return;
    const value = $(el).attr('data-text') ?? $(el).text();
    const matrix = $(el).attr('transform')?.match(/matrix\(([^)]+)\)/)?.[1].split(/[ ,]+/).map(Number);
    const y = matrix?.length === 6 ? matrix[5] : Number($(el).attr('y'));
    if (Number.isFinite(y) && Number.isFinite(lastY) && Math.abs(y - lastY) > 2) text += '\n';
    text += value;
    if (Number.isFinite(y)) lastY = y;
  });
  if (normalizeWhitespace(text).length < 50) throw new Error('AMM-MT: página sem camada textual; OCR necessário');
  return text.trim();
}

export function ammPageUrls(html, articleUrl) {
  const $ = load(html), id = new URL(articleUrl).pathname.match(/^\/publicacao\/(\d+)\/?$/)?.[1];
  const urls = $('#publication-text img[src],.publication-text img[src]').map((_, el) => $(el).attr('src')).get();
  if (!urls.length) return [];
  if (!id || urls.length > 60) throw new Error('AMM-MT: páginas fora do limite de leitura');
  const paths = urls.map(raw => {
    const url = new URL(raw, articleUrl);
    const match = url.pathname.match(/^\/publicacoes-pdf\/\d{4}\/\d{2}\/\d{2}\/\d+_(\d+)\/[a-f0-9-]+\/p-(\d+)\.svg$/i);
    if (url.origin !== 'https://cdn-amm.diariomunicipal.org' || !match || match[1] !== id)
      throw new Error('AMM-MT: página fora da publicação oficial');
    return { url: url.href, index: Number(match[2]), prefix: url.pathname.slice(0, url.pathname.lastIndexOf('/')) };
  });
  paths.sort((a, b) => a.index - b.index);
  if (paths.some((p, i) => p.index !== i || p.prefix !== paths[0].prefix))
    throw new Error('AMM-MT: sequência de páginas incompleta ou misturada');
  return paths.map(p => p.url);
}

export async function readAmmPages(html, item, { fetchImpl = fetch, timeoutMs = 12000 } = {}) {
  const urls = ammPageUrls(html, item.url);
  if (!urls.length) return null;
  const pages = new Array(urls.length);
  let next = 0, size = 0;
  await Promise.all(Array.from({ length: Math.min(3, urls.length) }, async () => {
    while (next < urls.length) {
      const index = next++;
      const response = await fetchWithRetry(urls[index], { fetchImpl, timeoutMs, retries: 0, redirect: 'error' });
      if (!response.ok) throw new Error(`AMM-MT: página ${index + 1}, HTTP ${response.status}`);
      const chunks = []; let bytes = 0;
      for await (const chunk of response.body) {
        bytes += chunk.length; size += chunk.length;
        if (bytes > 3_000_000 || size > 24_000_000) throw new Error('AMM-MT: camada textual excede limite');
        chunks.push(Buffer.from(chunk));
      }
      pages[index] = { page: index + 1, url: urls[index], text: parseAmmSvg(Buffer.concat(chunks).toString('utf8')) };
    }
  }));
  // Do not present a partial document as a complete reading.
  return { ...item, rawText: pages.map(p => `[Página ${p.page}]\n${p.text}`).join('\n\n'),
    summary: normalizeWhitespace(pages.map(p => p.text).join(' ')).slice(0, 1800),
    articleUrl: item.url, articleReader: 'amm_mt_svg_textual', contentProvenance: 'pagina_original',
    documentPages: pages.map(({ page, url }) => ({ page, url })) };
}
