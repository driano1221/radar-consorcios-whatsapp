import { createHash } from 'node:crypto';

export const READING_ATTEMPT_LIMIT = 3;
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const persistentFailure = /^(?:http_(?:400|401|403|404|410)|bloqueio_antibot|url_invalida|destino_nao_html)$/;
// Invalid addresses and unsupported responses are not scheduled again by the
// HTML reader. Do not promise retries that that reader will never execute.
const requiredAttempts = failure => ['url_invalida','destino_nao_html'].includes(failure) ? 1 : READING_ATTEMPT_LIMIT;

// This is an admission decision about an unreadable input, never proof that
// the reported event did not happen. Human/content decisions remain separate.
export function readingAdmission(row) {
  if (row.article_text_sha256 || !['processando', undefined, ''].includes(row.decisao_base) ||
      !persistentFailure.test(row.article_recovery_reason || '') ||
      !Number.isFinite(Date.parse(row.article_attempted_at || '')) ||
      Number(row.article_attempts || 0) < requiredAttempts(row.article_recovery_reason)) return null;
  const admission = { version: 1, documentId: row.id, url: row.url,
    status: 'barrada', failure: row.article_recovery_reason,
    attempts: Number(row.article_attempts), attemptedAt: row.article_attempted_at };
  return { ...admission, diagnosticHash: sha(admission) };
}

export function validReadingAdmission(row, admission) {
  if (!admission || admission.version !== 1 || admission.status !== 'barrada' ||
      admission.documentId !== row.id || admission.url !== row.url ||
      !persistentFailure.test(admission.failure || '') ||
      admission.attempts < requiredAttempts(admission.failure) || !Number.isFinite(Date.parse(admission.attemptedAt || ''))) return false;
  const { diagnosticHash, ...diagnostic } = admission;
  return diagnosticHash === sha(diagnostic);
}

export function admissionTriage(base, admission) {
  return { ...base, status: 'descartado', category: 'GERAL', stage: 'Barrada na entrada — íntegra indisponível',
    method: 'barreira_de_leitura', decisionBasis: 'admissibilidade', evidence: '',
    reason: `Entrada não admitida após ${admission.attempts} tentativa${admission.attempts===1?' registrada':'s registradas'} (${admission.failure}). ` +
      'Conteúdo não analisado; isto não afirma ausência do fato. Sem novas tentativas automáticas deste endereço. ' +
      'Uma íntegra válida permite nova triagem; PDF e HTML legíveis continuam aceitos.',
    admission, checks: [] };
}
