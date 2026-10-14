function dateMillis(value) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

// Rediscovery must not move an old document back above new arrivals.
// Publication date breaks batch ties; absent first-collection dates stay last.
export function compareNewestDiscovery(a, b) {
  return dateMillis(b.firstSeenAt) - dateMillis(a.firstSeenAt) ||
    dateMillis(b.publishedAt) - dateMillis(a.publishedAt) ||
    String(a.id || '').localeCompare(String(b.id || ''));
}

// Decisão editorial e pendências de dados são eixos independentes.
export function triageBucket(item) {
  const review = item.editorialReview?.decision;
  if (['confirmar_evento', 'corrigir_categoria'].includes(review) || item.baseDecision === 'confirmado') return 'accepted';
  if (item.baseDecision === 'desdobrado') return 'rejected';
  if (['nao_evento', 'duplicata'].includes(review) || item.rejectedEvent || item.baseDecision === 'descartado') return 'rejected';
  return 'pending';
}

function hasSettledReview(item) {
  return ['confirmar_evento', 'corrigir_categoria', 'nao_evento', 'duplicata']
    .includes(item.editorialReview?.decision);
}

export const pendingKinds = [
  { key: 'identity', title: 'Identidade incompleta', description: 'Publicação ainda aproveitável, mas o vínculo exato com o consórcio precisa de prova.', matches: (item) => Boolean(item.identityPending) && triageBucket(item) !== 'rejected' },
  { key: 'preview', title: 'Fonte em teste', description: 'Publicação encontrada numa fonte ainda não liberada para alertas automáticos.', matches: (item) => item.decisionStatus === 'previa' },
  { key: 'divergence', title: 'Leituras divergentes', description: 'A IA ou a releitura do PDF discordou da regra; veja o texto antes de decidir.', matches: (item) => !hasSettledReview(item) &&
    (item.decisionStatus === 'revisao' || Boolean(item.pdfReassessment) ||
      (item.aiStatus === 'disputed' && item.baseDecision === 'candidato')) },
  { key: 'suggestion', title: 'Nova pista no texto', description: 'Texto recuperado sugere outro enquadramento; a decisão original não mudou.', matches: (item) => Boolean(item.recoverySuggestion) },
];

export function pendingLabels(item) {
  return pendingKinds.filter((kind) => kind.matches(item)).map((kind) => kind.title);
}
