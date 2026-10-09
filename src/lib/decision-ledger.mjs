import { createHash } from 'node:crypto';
import { canonicalUrl, itemId } from './dedupe.mjs';

const DAY = 24 * 60 * 60 * 1000;

function decisionFor(item, context) {
  const { minimumScore, relevant, discovered, selected, state } = context;
  const id = itemId(item);
  const category = item.classification?.category || 'GERAL';
  const score = Number(item.classification?.score || 0);
  if (item.publicationDecision === 'historico') return ['historico', item.publicationReason || 'Fato válido para a base, sem novidade para envio.'];
  if (item.publicationDecision === 'data_inconsistente') return ['revisao', item.publicationReason || 'Data da publicação precisa de conferência.'];
  if (item.aiReview?.status === 'rejected') return ['rejeitado', 'Rejeitado pela revisão automática.'];
  if (item.aiReview?.status === 'disputed') return ['revisao', 'Revisão automática divergente; requer conferência humana.'];
  if (category === 'GERAL') return ['descartado', item.classification?.reasons?.find((reason) => reason.startsWith('rejeitado:')) || 'Não foi identificado evento consorcial comprovado.'];
  if (score < minimumScore) return ['abaixo_limiar', `Pontuação ${score}, abaixo do limiar ${minimumScore}.`];
  if (item.previewOnly) return ['previa', item.reviewReason || 'Fonte ainda em prévia; não publica automaticamente.'];
  if (state.seen?.[id]) return ['enviado', 'Já enviado ao WhatsApp anteriormente.'];
  if (selected.has(id)) return ['selecionado', 'Selecionado nesta rodada; envio depende da confirmação de entrega.'];
  if (state.pending?.[id]) return ['fila', 'Na fila persistente para a próxima seleção.'];
  if (!relevant.has(id)) return ['descartado', 'Não passou pelos critérios de publicação.'];
  if (!discovered.has(id)) return ['conhecido', 'Item já conhecido ou evento semelhante encontrado; não reenviar.'];
  return ['elegivel', 'Elegível, mas não selecionado nesta rodada por limite ou prioridade.'];
}

export function recordRunDecisions(state, items, options = {}) {
  const now = options.now || new Date();
  const at = now.toISOString();
  const context = {
    minimumScore: options.minimumScore ?? 5,
    relevant: new Set((options.relevant || []).map(itemId)),
    discovered: new Set((options.discovered || []).map(itemId)),
    selected: new Set((options.selected || []).map(itemId)),
    state,
  };
  state.decisions ||= {};
  for (const item of items) {
    const url = canonicalUrl(item.url || '');
    if (!/^https?:\/\//i.test(url)) continue;
    const key = createHash('sha256').update(url).digest('hex');
    const previous = state.decisions[key];
    const [status, reason] = decisionFor(item, context);
    state.decisions[key] = {
      id: key, url, title: String(item.title || '').slice(0, 300),
      source: String(item.source || '').slice(0, 120),
      articleUrl: String(item.articleUrl || previous?.articleUrl || '').slice(0, 1200),
      publishedAt: item.publishedAt || '',
      firstSeenAt: previous?.firstSeenAt || at, lastSeenAt: at,
      observedCount: (previous?.observedCount || 0) + 1,
      status, reason, category: item.classification?.category || 'GERAL',
      catalogDecision: item.catalogDecision || 'candidato',
      publicationDecision: item.publicationDecision || '',
      sourcePublishedAt: item.sourcePublishedAt || '', eventAt: item.eventAt || '',
      score: Number(item.classification?.score || 0),
      classificationReasons: (item.classification?.reasons || []).slice(0, 5).map((value) => String(value).slice(0, 180)),
      aiStatus: item.aiReview?.status || '',
      previewOnly: Boolean(item.previewOnly),
      runId: options.runId || '',
    };
  }
  const cutoff = now.getTime() - (options.retentionDays ?? 14) * DAY;
  const ordered = Object.entries(state.decisions)
    .filter(([, row]) => new Date(row.lastSeenAt).getTime() >= cutoff)
    .sort((a, b) => b[1].lastSeenAt.localeCompare(a[1].lastSeenAt));
  state.decisions = Object.fromEntries(ordered.slice(0, options.maxItems ?? 1500));
  return ordered.length;
}
