import { createHash } from 'node:crypto';

export const READING_ATTEMPT_LIMIT = 3;
const sha = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const persistentFailure = /^(?:http_(?:400|401|403|404|410)|bloqueio_antibot|url_invalida|destino_nao_html)$/;
const transientFailure=/^(?:erro: fetch failed|timeout|ocr_pendente)$/;
// Invalid addresses and unsupported responses are not scheduled again by the
// HTML reader. Do not promise retries that that reader will never execute.
const requiredAttempts = failure => transientFailure.test(failure)?5:['url_invalida','destino_nao_html','limite_pdf'].includes(failure) ? 1 : READING_ATTEMPT_LIMIT;
const supportedFailure=failure=>persistentFailure.test(failure)||transientFailure.test(failure)||failure==='limite_pdf';

// This is an admission decision about an unreadable input, never proof that
// the reported event did not happen. Human/content decisions remain separate.
export function readingAdmission(row) {
  if (row.article_text_sha256 || !['processando', undefined, ''].includes(row.decisao_base) ||
      !supportedFailure(row.article_recovery_reason || '') ||
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
      !supportedFailure(admission.failure || '') ||
      admission.attempts < requiredAttempts(admission.failure) || !Number.isFinite(Date.parse(admission.attemptedAt || ''))) return false;
  const { diagnosticHash, ...diagnostic } = admission;
  return diagnosticHash === sha(diagnostic);
}

export function admissionTriage(base, admission) {
  const limited=transientFailure.test(admission.failure)||admission.failure==='limite_pdf';
  return { ...base, status: 'descartado', category: 'GERAL', stage: limited?'Entrada suspensa — limite de leitura atingido':'Barrada na entrada — íntegra indisponível',
    method: 'barreira_de_leitura', decisionBasis: 'admissibilidade', evidence: '',
    reason: `Entrada não admitida após ${admission.attempts} tentativa${admission.attempts===1?' registrada':'s registradas'} (${admission.failure}). ` +
      (limited?'Orçamento técnico de leitura esgotado; não afirma bloqueio permanente da fonte. ':'')+
      'Conteúdo não analisado; isto não afirma ausência do fato. Sem novas tentativas automáticas deste endereço. ' +
      'Uma íntegra válida permite nova triagem; PDF e HTML legíveis continuam aceitos.',
    admission, checks: [] };
}
