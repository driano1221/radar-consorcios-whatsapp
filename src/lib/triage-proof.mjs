import { createHash } from 'node:crypto';
import { locateQuote } from './quote-evidence.mjs';

export function verifiedTriage(triage, body) {
  return Boolean(typeof body === 'string' && body && ['confirmado', 'descartado'].includes(triage?.status) &&
    triage.reason && triage.evidence &&
    createHash('sha256').update(body).digest('hex') === triage.bodyHash &&
    locateQuote(triage.evidence, [body]));
}
