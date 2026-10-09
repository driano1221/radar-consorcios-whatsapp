import { normalizeForMatch } from './text.mjs';

function normalizedNumber(value) {
  return String(value || '').replace(/\D/g, '').replace(/^0+/, '') || '0';
}

// Só produz uma chave quando o ato e o município estão explícitos. Um número
// de lei sozinho não identifica evento: cada município tem sua numeração.
export function formalEventKey(item) {
  const facts = item.editorialFacts || {};
  const category = item.classification?.category || item.tipo_evento || item.category || '';
  if (!['ADESÃO', 'ADESÃO AUTORIZADA', 'SAÍDA', 'GOVERNANÇA', 'CRIAÇÃO'].includes(category)) return '';
  const evidence = normalizeForMatch(`${item.classification?.evidenceText || ''} ${item.title || ''}`);
  const act = String(facts.lei || '').match(/(\d[\d.]*)\s*\/\s*(20\d{2})/) ||
    evidence.match(/\blei(?: municipal| ordinaria| complementar)?\s*(?:n[ºo°.]?\s*)?(\d[\d.]*)\s*\/\s*(20\d{2})\b/);
  if (!act) return '';
  const municipality = normalizeForMatch(facts.municipio || item.territoryName ||
    evidence.match(/\bmunicipio de ([a-z ]{3,65}?)\s+(?:no|ao|foi|fica|autoriza|ratifica|,|\.)/)?.[1] || '')
    .replace(/\s*\/[a-z]{2}$/, '');
  if (municipality.length < 3) return '';
  return `lei:${municipality}:${normalizedNumber(act[1])}/${act[2]}`;
}
