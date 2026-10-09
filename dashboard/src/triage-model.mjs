// Decisão editorial e pendências de dados são eixos independentes.
export function triageBucket(item) {
  const review = item.editorialReview?.decision;
  if (['confirmar_evento', 'corrigir_categoria'].includes(review) || item.baseDecision === 'confirmado') return 'accepted';
  if (['nao_evento', 'duplicata'].includes(review) || item.rejectedEvent || item.baseDecision === 'descartado') return 'rejected';
  return 'pending';
}

export const pendingKinds = [
  { key: 'identity', title: 'Identidade incompleta', description: 'Nome, sigla ou CNPJ do consórcio ainda não comprovados no documento.', matches: (item) => Boolean(item.identityPending) },
  { key: 'preview', title: 'Fonte em teste', description: 'Publicação encontrada numa fonte ainda não liberada para alertas automáticos.', matches: (item) => item.decisionStatus === 'previa' },
  { key: 'divergence', title: 'Leituras divergentes', description: 'Uma revisão automática discordou da anterior; o registro pede conferência.', matches: (item) => item.decisionStatus === 'revisao' || Boolean(item.pdfReassessment) },
  { key: 'suggestion', title: 'Nova pista no texto', description: 'Texto recuperado sugere outro enquadramento; a decisão original não mudou.', matches: (item) => Boolean(item.recoverySuggestion) },
];

export function pendingLabels(item) {
  return pendingKinds.filter((kind) => kind.matches(item)).map((kind) => kind.title);
}
