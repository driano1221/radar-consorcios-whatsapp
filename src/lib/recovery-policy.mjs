// Recovery state is independent of the editorial decision. Keep trying, slowly,
// without resetting identity, classifications, reviewed evidence or alert state.
export function recoveryDelayMs(attempts) {
  return Math.min(168, 12 * 2 ** Math.min(4, Math.max(0, Number(attempts || 1) - 1))) * 3600000;
}

export function recoveryDue(row, { now = Date.now(), force = false } = {}) {
  if (force) return true;
  if (['url_invalida', 'destino_pdf', 'destino_nao_html'].includes(row.article_recovery_reason)) return false;
  const last = Date.parse(row.article_attempted_at || '');
  const next = Date.parse(row.article_next_attempt_at || '');
  return Number.isFinite(next) ? now >= next
    : !Number.isFinite(last) || now >= last + recoveryDelayMs(row.article_attempts);
}

export function recoveryAttempt(row, { now, reason = '', resolvedUrl = '' }) {
  const attempts = Number(row.article_attempts || 0) + 1;
  return { ...row, article_attempted_at: now, article_attempts: attempts,
    article_recovery_reason: reason,
    article_recovery_status: reason ? 'aguardando_recuperacao' : 'recuperado',
    article_next_attempt_at: reason ? new Date(Date.parse(now) + recoveryDelayMs(attempts)).toISOString() : '',
    ...(resolvedUrl ? { article_resolved_url: resolvedUrl } : {}) };
}

export function attachRecoveredText(row, stored) {
  // Deliberately allowlist metadata: don't touch trecho/etapa/reviews/alert fields.
  return { ...row, article_url: stored.url_artigo, article_text_sha256: stored.texto_sha256,
    article_reader: stored.leitor, article_recovery_status: 'recuperado',
    article_recovery_reason: '', article_next_attempt_at: '' };
}
