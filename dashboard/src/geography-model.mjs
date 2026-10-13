// UF do acontecimento, não do servidor que hospeda a notícia.
const VALID_UFS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
const STATE_NAMES = [
  ['Mato Grosso do Sul', 'MS'], ['Rio Grande do Sul', 'RS'], ['Rio Grande do Norte', 'RN'],
  ['Minas Gerais', 'MG'], ['Mato Grosso', 'MT'], ['São Paulo', 'SP'], ['Rio de Janeiro', 'RJ'],
  ['Espírito Santo', 'ES'], ['Santa Catarina', 'SC'], ['Paraíba', 'PB'], ['Paraná', 'PR'],
  ['Pernambuco', 'PE'], ['Alagoas', 'AL'], ['Sergipe', 'SE'], ['Bahia', 'BA'], ['Ceará', 'CE'],
  ['Goiás', 'GO'], ['Pará', 'PA'], ['Amazonas', 'AM'], ['Maranhão', 'MA'], ['Piauí', 'PI'],
  ['Rondônia', 'RO'], ['Roraima', 'RR'], ['Acre', 'AC'], ['Amapá', 'AP'], ['Tocantins', 'TO'],
];

function codes(text) {
  const found = [];
  for (const match of String(text || '').matchAll(/\(([A-Z]{2})\)|\/([A-Z]{2})\b|\b(?:TCE|TC|MP)[-– ]?([A-Z]{2})\b/gu)) {
    const uf = match[1] || match[2] || match[3];
    if (VALID_UFS.has(uf)) found.push(uf);
  }
  return [...new Set(found)];
}

function namedStates(text) {
  const found = [];
  const occupied = [];
  for (const [name, uf] of STATE_NAMES) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b(?:estado d[eo]|n[oa]|d[eo]|da|do)\\s+${escaped}(?=$|[^\\p{L}])`, 'igu');
    for (const match of String(text || '').matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (occupied.some(([from, to]) => start < to && end > from)) continue;
      occupied.push([start, end]);
      found.push(uf);
    }
  }
  return [...new Set(found)];
}

function result(ufs, basis, evidence = '') {
  return { ufs: [...new Set(ufs)].filter((uf) => VALID_UFS.has(uf)), basis, evidence };
}

export function resolveGeography(row = {}, item = {}, reviewed = {}) {
  if (reviewed.ufs?.length) return result(reviewed.ufs, 'revisão documental', reviewed.evidence || '');
  const recorded = String(row.uf || '').split(/[,;/ ]+/).filter((uf) => VALID_UFS.has(uf));
  if (recorded.length) return result(recorded, 'catálogo', row.municipio || row.titulo || '');

  const facts = item.editorialReview?.facts || {};
  const factPlaces = [facts.uf, facts.municipio, ...(Array.isArray(facts.municipios) ? facts.municipios : [])]
    .filter(Boolean).join(' ');
  const factCodes = codes(factPlaces);
  if (factCodes.length) return result(factCodes, 'revisão editorial', factPlaces);

  const title = row.titulo || item.title || '';
  const titleCodes = codes(title);
  if (titleCodes.length) return result(titleCodes, 'título', title);

  const titleNames = namedStates(title);
  if (titleNames.length === 1) return result(titleNames, 'título', title);

  const directUrl = item.url || row.url || '';
  let hostname = '';
  try { hostname = new URL(directUrl).hostname.toLowerCase(); } catch { /* URL incompleta */ }
  const governmentDomain = /(?:^|\.)([a-z]{2})\.(?:gov|leg)\.br$/i.exec(hostname)?.[1]?.toUpperCase();
  if (VALID_UFS.has(governmentDomain)) return result([governmentDomain], 'domínio oficial', hostname);

  const body = String(item.fullText || item.evidence || row.trecho || '').slice(0, 700);
  const bodyCodes = codes(body);
  if (bodyCodes.length === 1) return result(bodyCodes, 'trecho da publicação', body.slice(0, 220));
  const bodyNames = namedStates(body);
  if (bodyNames.length === 1) return result(bodyNames, 'trecho da publicação', body.slice(0, 220));
  return result([], 'sem localização segura');
}
