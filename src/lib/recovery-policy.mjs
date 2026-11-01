import { readingAdmission } from './reading-admission.mjs';

// Recovery state is independent of the editorial decision. Pending inputs have
// a finite admission budget; completed human/content decisions are preserved.
export function isRecoveryLead(row) {
  if (row.triagem_automatica?.method === 'barreira_de_leitura' || readingAdmission(row)) return false;
  // A legal title may omit "consórcio"; once attempted, don't lose it in the queue.
  return row.triagem_automatica?.status === 'processando' || Number(row.article_attempts || 0) > 0 ||
    /cons[oó]rc|rateio|protocolo de inten[cç][oõ]es|ades[aã]o|desligamento|retirada/i.test(row.titulo || '');
}

export function recoveryDelayMs(attempts, pendingTriage = false) {
  return Math.min(pendingTriage?24:168, (pendingTriage?2:12) * 2 ** Math.min(4, Math.max(0, Number(attempts || 1) - 1))) * 3600000;
}

export function recoveryDue(row, { now = Date.now(), force = false } = {}) {
  if (force) return true;
  if (row.triagem_automatica?.method === 'barreira_de_leitura' || readingAdmission(row)) return false;
  if (['url_invalida', 'destino_pdf', 'destino_nao_html'].includes(row.article_recovery_reason)) return false;
  const last = Date.parse(row.article_attempted_at || '');
  const next = Date.parse(row.article_next_attempt_at || '');
  return Number.isFinite(next) ? now >= next
    : !Number.isFinite(last) || now >= last + recoveryDelayMs(row.article_attempts,row.triagem_automatica?.status==='processando');
}

export function pdfRecoveryDue(row,{requestedIds=[],hasText=false,reviewed=false,previous,retryFailed=false,now=Date.now()}={}) {
  if(hasText||reviewed)return false;
  const pdf=/\.pdf(?:[?#]|$)/i.test(row.article_resolved_url||row.article_url||row.url);
  if(!pdf&&!['destino_pdf','destino_nao_html'].includes(row.article_recovery_reason)&&
    !(retryFailed&&row.article_recovery_reason?.startsWith('falha:')))return false;
  if(requestedIds.length)return requestedIds.includes(row.id);
  if(row.triagem_automatica?.method==='barreira_de_leitura'||readingAdmission(row))return false;
  if(!/^https:\/\/news\.google\.com\//.test(row.url)&&!pdf)return false;
  return !previous||retryFailed&&(previous.situacao?.startsWith('falha:')||row.triagem_automatica?.status==='processando')&&
    now-Date.parse(previous.tentado_em||0)>=recoveryDelayMs(previous.tentativas,row.triagem_automatica?.status==='processando');
}

export function recoveryAttempt(row, { now, reason = '', resolvedUrl = '' }) {
  const attempts = Number(row.article_attempts || 0) + 1;
  return { ...row, article_attempted_at: now, article_attempts: attempts,
    article_recovery_reason: reason,
    article_recovery_status: reason ? 'aguardando_recuperacao' : 'recuperado',
    article_next_attempt_at: reason ? new Date(Date.parse(now) + recoveryDelayMs(attempts,row.triagem_automatica?.status==='processando')).toISOString() : '',
    ...(resolvedUrl ? { article_resolved_url: resolvedUrl } : {}) };
}

export function attachRecoveredText(row, stored) {
  // Deliberately allowlist metadata: don't touch trecho/etapa/reviews/alert fields.
  return { ...row, article_url: stored.url_artigo, article_text_sha256: stored.texto_sha256,
    article_reader: stored.leitor, article_recovery_status: 'recuperado',
    article_recovery_reason: '', article_next_attempt_at: '' };
}

// Access failures are observed facts, independent of approval of the catalog.
// The existing atomic state write survives a later catalog-validation failure.
export function checkpointRecoveryFailure(state,row,{runId='',timeBasis='attempt_start'}={}) {
  if(!row.article_recovery_reason||!Number.isFinite(Date.parse(row.article_attempted_at)))return false;
  const previous=state.recoveryFailures?.[row.id];
  if(previous&&Date.parse(previous.attemptedAt)>=Date.parse(row.article_attempted_at))return false;
  state.recoveryFailures||={};
  state.recoveryFailures[row.id]={attemptedAt:row.article_attempted_at,attempts:row.article_attempts,
    reason:row.article_recovery_reason,resolvedUrl:row.article_resolved_url||'',
    nextAttemptAt:row.article_next_attempt_at||'',runId,timeBasis};
  return true;
}

export function restoreRecoveryFailures(records,state) {
  for(const[id,failure]of Object.entries(state.recoveryFailures||{})){
    const row=records.get(id),at=Date.parse(failure.attemptedAt);
    if(!row||row.article_text_sha256||!Number.isFinite(at)||!failure.reason||
      !Number.isSafeInteger(failure.attempts)||failure.attempts<1||
      Date.parse(row.article_attempted_at||'1970-01-01')>=at)continue;
    records.set(id,{...row,article_attempted_at:failure.attemptedAt,
      article_attempts:Math.max(Number(row.article_attempts||0),failure.attempts),
      article_recovery_reason:failure.reason,article_resolved_url:failure.resolvedUrl||row.article_resolved_url||'',
      article_next_attempt_at:failure.nextAttemptAt||'',article_recovery_status:'aguardando_recuperacao'});
  }
  return records;
}
