// Pure matching guards shared by discovery and triage (no network/dependencies).
export const matchNormal = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const stop = new Set('consorcio consorcios intermunicipal intermunicipais saude para pelo pela pelos pelas sobre noticia noticias semana mais esta este entre com dos das uma regio regiao regional prefeitura municipio municipios municipal publica publico noticia'.split(' '));
export const matchWords = s => [...new Set(matchNormal(String(s).split(/\s+-\s+/)[0]).match(/[a-z]{4,}/g) || [])].filter(w => !stop.has(w));
export const matchNumbers = s => [...new Set(matchNormal(String(s).split(/\s+-\s+/)[0]).match(/\b\d+\b/g) || [])];
const phase = title => {
  const value = matchNormal(title);
  if (/\b(projeto|proposta|possivel|cogita)\b/.test(value)) return 'proposta';
  if (/\b(autoriza|autorizada|autorizado|autorizacao)\b/.test(value)) return 'autorizacao';
  if (/\b(aderiu|ingressou|assinado|assinou|celebrou|celebrado)\b/.test(value)) return 'efetivado';
  return '';
};

// A retrieval match is necessary, but never sufficient to assert the same episode.
export function compareAlternative(original, candidate) {
  const title = original.titulo || original.title, other = candidate.titulo || candidate.title;
  const a = matchWords(title), b = matchWords(other), shared = a.filter(w => b.includes(w));
  const originalNumbers = matchNumbers(title), candidateNumbers = matchNumbers(other);
  const numberConflict = originalNumbers.some(n => !candidateNumbers.includes(n)) || candidateNumbers.some(n => !originalNumbers.includes(n));
  const negative = text => /\b(nao|nega|negou|boato|desmente|desmentiu|suposto|possivel|proposta|projeto)\b/.test(matchNormal(text));
  const statusConflict = negative(title) !== negative(other) || Boolean(phase(title) && phase(other) && phase(title) !== phase(other));
  const dates = [original.sourcePublishedAt || original.data_noticia_original,
    candidate.sourcePublishedAt || candidate.data_noticia_original].map(Date.parse);
  const dateVerified = dates.every(Number.isFinite);
  const dateConflict = dateVerified && Math.abs(dates[0] - dates[1]) > 7 * 86400000;
  const score = shared.length / Math.max(1, a.length);
  return { eligible: a.length >= 4 && shared.length >= 4 && score >= .7 && !numberConflict && !statusConflict && !dateConflict,
    shared, score, numberConflict, statusConflict, dateConflict, dateVerified, equivalenceConfirmed: false };
}

export function bodyQuantityConflict(originalTitle, body) {
  const quantities = text => [...matchNormal(text).matchAll(/\b(\d+(?:[.,]\d+)*)\s+(pacientes|municipios|leitos|procedimentos|cirurgias|pessoas)\b/g)];
  const actual = quantities(body);
  return quantities(originalTitle).some(([, count, unit]) => !actual.some(([, n, u]) => u === unit && n === count));
}
