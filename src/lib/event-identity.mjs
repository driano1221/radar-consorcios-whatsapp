import { normalizeForMatch } from './text.mjs';
import { createHash } from 'node:crypto';
import { institutionalProof } from './institutional-proof.mjs';

// Conservative news key: identical actor/action proof and explicit day/month,
// anchored to a known publication year. Similar topic or headline is not enough.
export function institutionalEventKey(item) {
  if (item.kind === 'gazette') return '';
  const proof = institutionalProof({ ...item, rawText: item.rawText || item.classification?.evidenceText || '' });
  if (!['performed_institutional_activity', 'signed_cooperation'].includes(proof?.proofKind)) return '';
  const date = proof.evidenceText.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(20\d{2}))?\b/);
  const year = date?.[3] || String(item.editorialFacts?.ano || item.sourcePublishedAt || item.publishedAt || '').match(/^20\d{2}/)?.[0];
  if (!date || !year || +date[1] > 31 || +date[2] > 12 || +date[1] < 1 || +date[2] < 1) return '';
  const evidence = normalizeForMatch(proof.evidenceText).replace(/\b0?(\d{1,2})\/0?(\d{1,2})\b/g, (_,d,m)=>`${+d}/${+m}`).replace(/\s+/g, ' ').trim();
  return `atividade:${year}:${createHash('sha256').update(evidence).digest('hex')}`;
}

function normalizedNumber(value) {
  return String(value || '').replace(/\D/g, '').replace(/^0+/, '') || '0';
}

// Só produz uma chave quando o ato e o município estão explícitos. Um número
// de lei sozinho não identifica evento: cada município tem sua numeração.
export function formalEventKey(item) {
  const facts = item.editorialFacts || {};
  const category = item.classification?.category || item.tipo_evento || item.category || '';
  if (category === 'ATUAÇÃO') return institutionalEventKey(item);
  if (!['ADESÃO', 'ADESÃO AUTORIZADA', 'SAÍDA', 'GOVERNANÇA', 'CRIAÇÃO'].includes(category)) return '';
  const evidence = normalizeForMatch(`${item.classification?.evidenceText || ''} ${item.title || ''}`);
  const act = String(facts.lei || '').match(/(\d[\d.]*)\s*\/\s*(20\d{2})/) ||
    evidence.match(/\blei(?: municipal| ordinaria| complementar)?\s*(?:n[ºo°.]?\s*)?(\d[\d.]*)\s*\/\s*(20\d{2})\b/);
  if (!act) return '';
  const municipality = normalizeForMatch(facts.municipio_emissor || facts.municipio || item.territoryName ||
    evidence.match(/\bmunicipio de ([a-z ]{3,65}?)\s+(?:no|ao|foi|fica|autoriza|ratifica|,|\.)/)?.[1] || '')
    .replace(/\s*\/[a-z]{2}$/, '');
  if (municipality.length < 3) return '';
  return `lei:${municipality}:${normalizedNumber(act[1])}/${act[2]}`;
}
