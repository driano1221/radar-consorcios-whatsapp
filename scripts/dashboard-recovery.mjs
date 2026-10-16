import { createHash } from 'node:crypto';

function webUrl(value) {
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : ''; }
  catch { return ''; }
}

export function textPreview(text, limit = 500) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  return `${cut.slice(0, cut.lastIndexOf(' ') > limit / 2 ? cut.lastIndexOf(' ') : limit)}…`;
}

// These are auxiliary readings, never inputs to classification or counters.
// Keep only verified stored bodies; allowlist fields instead of exporting raw API responses.
export function dashboardAlternatives(documentId, rows, review) {
  const unique = new Map();
  for (const row of rows) {
    const url = webUrl(row.url_fonte);
    if (row.documento_id !== documentId || !url || !row.texto ||
        row.texto_sha256 !== createHash('sha256').update(row.texto).digest('hex')) continue;
    const cited = Boolean(review?.fonte_evidencia && webUrl(review.fonte_evidencia) === url);
    const candidate = {
      id: row.id, source: row.fonte || new URL(url).hostname, title: row.titulo_fonte || '', url,
      publishedAt: row.data_fonte || '', recoveredAt: row.recuperado_em || '',
      preservedReadingAt: row.leitura_preservada_em || '', reader: row.leitor || '',
      discovery: row.origem_descoberta === 'acervo' ? 'Acervo já guardado' : 'Busca de outra fonte',
      excerpt: textPreview(row.texto), fullText: row.texto, textHash: row.texto_sha256,
      independence: row.independencia || 'Independência da fonte não verificada.',
      relation: row.comparacao?.shared?.length
        ? `Encontrada por termos em comum no título: ${row.comparacao.shared.join(', ')}. Isso não comprova que seja o mesmo episódio.`
        : 'Texto relacionado para conferência; equivalência com a publicação original não comprovada.',
      dateCompared: row.comparacao?.dateVerified === true,
      decisionUse: cited ? 'cited' : 'not_cited',
      decisionNote: cited ? 'Esta fonte está citada na revisão atual. O trecho e o motivo da decisão estão acima.'
        : 'Não citada na decisão atual. Recuperar este texto não muda a classificação nem gera um novo envio.',
      validationUrl: webUrl(row.validacao_url),
    };
    const previous = unique.get(url);
    if (!previous || candidate.recoveredAt > previous.recoveredAt) unique.set(url, candidate);
  }
  return [...unique.values()];
}
