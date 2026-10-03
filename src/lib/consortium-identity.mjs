import { createHash } from 'node:crypto';
import { normalizeForMatch, normalizeWhitespace } from './text.mjs';

const CNPJ = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/;
const NAME_START = /\bcons[oó]rcio\s+(?:p[uú]blico\s+)?(?:intermunicipal|interfederativo|multifinalit[aá]rio|p[uú]blico)\b/giu;
const ACRONYM_AFTER = /^\s*(?:[–—-]\s*|\(\s*)([A-Z][A-Za-z0-9-]{2,14}(?:\s+[A-Z][A-Z0-9-]{2,14})?)\b/;
const STOP = /\s+(?:inscrit[oa]|com\s+(?:a|o)\s+finalidade|referente|atrav[eé]s|mediante|firmou|assina|cria|projeta|para\s+atrair|em\s+favor|e\s+o\s+Munic[ií]pio)\b/i;
const GENERIC = /^(?:cons[oó]rcio\s+(?:p[uú]blico\s+)?(?:intermunicipal|de\s+sa[uú]de|p[uú]blico)|cons[oó]rcios\s+p[uú]blicos)$/i;

export function normalizeCnpj(value = '') {
  const digits = String(value).replace(/\D/g, '');
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return '';
  for (const size of [12, 13]) {
    const weights = size === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, i) => total + Number(digits[i]) * weight, 0);
    const check = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (check !== Number(digits[size])) return '';
  }
  return digits;
}

export function identityKey(name) {
  return normalizeForMatch(name).replace(/[^a-z0-9]+/g, ' ').trim();
}

function cleanName(value) {
  let text = normalizeWhitespace(value)
    .split(/\s+[–—-]\s+|\s*\([A-Z][A-Z\d-]{2,15}\)/)[0]
    .split(/[.,;:()]|\.\.\./)[0]
    .split(STOP)[0]
    .replace(/\s+(?:e|de|da|do|dos|das|para|na|no|com|em|a|o)$/i, '')
    .trim();
  if (text.length < 28 || GENERIC.test(text) || /\b(?:cria|assina|firma|autoriza|agenda|licita[cç][aã]o|questionado|previa|poder[aá]|ente|estatuto|contrato|lei|prefeitura|cl[aá]usula)\b/i.test(text)) return '';
  if (/\.{2,}|…/.test(value) && text.endsWith(' d')) return '';
  return text.slice(0, 180);
}

export function findIdentityMentions(row) {
  if (!row || row.tipo_evento === 'GERAL' || row.tipo_evento === 'NÃO CLASSIFICADO') return [];
  const fields = [
    ['metadado', row.consorcio || ''],
    ['trecho', row.trecho || ''],
    ['título', row.titulo || ''],
  ];
  const mentions = [];
  for (const curated of row.curatedMentions || []) {
    const name = cleanName(curated.nome || '');
    if (!name || !/^https:\/\//i.test(curated.fonte_evidencia || '')) continue;
    mentions.push({ name, acronym: curated.sigla || '', cnpj: normalizeCnpj(curated.cnpj || ''),
      origin: 'fonte complementar', evidence: curated.evidencia || name,
      evidenceUrl: curated.fonte_evidencia });
  }
  for (const [origin, text] of fields) {
    if (origin === 'metadado') {
      const name = cleanName(text);
      if (name) mentions.push({ name, acronym: (row.sigla || '').trim(), cnpj: '', origin, evidence: text });
      continue;
    }
    for (const match of text.matchAll(NAME_START)) {
      const rest = text.slice(match.index, match.index + 190);
      const before = text.slice(Math.max(0, match.index - 28), match.index);
      const precedingParenthesis = /\b([A-Z][A-Z0-9-]{2,14})\s*\(\s*$/.exec(before)?.[1];
      const precedingDash = /\b([A-Z][A-Z0-9-]{2,14})\s*[–—-]\s*$/.exec(before)?.[1];
      const delimiter = /\s*[–—-]\s+|\s*\(/g;
      let candidate = precedingParenthesis && rest.includes(')')
        ? { name: rest.slice(0, rest.indexOf(')')), acronym: precedingParenthesis, end: rest.indexOf(')') + 1 }
        : precedingDash && /[.;]/.test(rest)
          ? { name: rest.split(/[.;]/)[0], acronym: precedingDash, end: rest.search(/[.;]/) + 1 }
          : undefined;
      if (!candidate) {
        for (const boundary of rest.matchAll(delimiter)) {
          const tail = rest.slice(boundary.index);
          const acronymMatch = ACRONYM_AFTER.exec(tail);
          if (!acronymMatch) continue;
          const acronym = acronymMatch[1];
          const afterAlias = tail.slice(acronymMatch[0].length);
          if (!/^[A-Z0-9 -]+$/.test(acronym) &&
            !(origin === 'trecho' && /^\s*[,;.)]/.test(afterAlias))) continue;
          if (origin === 'título' && /^\s+[\p{L}]/u.test(afterAlias)) continue;
          candidate = { name: rest.slice(0, boundary.index), acronym, end: boundary.index + acronymMatch[0].length };
          break;
        }
      }
      if (!candidate || /\bcons[oó]rcio\b/i.test(candidate.name.slice(match[0].length))) continue;
      const name = cleanName(candidate.name);
      if (!name) continue;
      const acronym = candidate.acronym;
      const following = rest.slice(candidate.end, candidate.end + 130);
      const cnpjMatch = CNPJ.exec(following);
      const cnpjContext = cnpjMatch ? following.slice(0, cnpjMatch.index) : '';
      const cnpj = /\b(?:inscrit[oa]|CNPJ)\b/i.test(cnpjContext) && !/\b(?:munic[ií]pio|prefeitura)\b/i.test(cnpjContext)
        ? normalizeCnpj(cnpjMatch[0]) : '';
      mentions.push({ name, acronym, cnpj, origin,
        evidence: normalizeWhitespace(text.slice(Math.max(0, match.index - 25), Math.min(text.length, match.index + candidate.end + 95))).slice(0, 240) });
    }
  }
  const unique = new Map();
  for (const mention of mentions) {
    const key = identityKey(mention.name);
    const old = unique.get(key);
    if (!old || (mention.origin === 'fonte complementar' ? 8 : 0) + (mention.cnpj ? 4 : 0) + (mention.acronym ? 2 : 0) >
      (old.origin === 'fonte complementar' ? 8 : 0) + (old.cnpj ? 4 : 0) + (old.acronym ? 2 : 0)) unique.set(key, mention);
  }
  return [...unique.values()];
}

export function newIdentityId(name) {
  return `cons_${createHash('sha256').update(identityKey(name)).digest('hex').slice(0, 16)}`;
}

export function buildIdentityCatalog(rows, previous = []) {
  const identities = new Map(previous.map((entity) => [entity.id, { ...entity, aliases: [...(entity.aliases || [])] }]));
  const byName = new Map();
  const byCnpj = new Map();
  for (const entity of identities.values()) {
    for (const name of [entity.nome, ...entity.aliases]) byName.set(identityKey(name), entity.id);
    if (entity.cnpj) byCnpj.set(entity.cnpj, entity.id);
  }
  const links = [];
  for (const row of rows) {
    for (const mention of findIdentityMentions(row)) {
      const key = identityKey(mention.name);
      const nameId = byName.get(key);
      const cnpjId = mention.cnpj ? byCnpj.get(mention.cnpj) : undefined;
      if (nameId && cnpjId && nameId !== cnpjId) {
        links.push({ documento_id: row.id, consorcio_id: '', situacao: 'conflito de identidade — revisão humana',
          nome_mencionado: mention.name, sigla_mencionada: mention.acronym, cnpj_mencionado: mention.cnpj,
          origem: mention.origin, evidencia: mention.evidence, url: row.url,
          url_evidencia: mention.evidenceUrl || row.url });
        continue;
      }
      const id = cnpjId || nameId || newIdentityId(mention.name);
      let entity = identities.get(id);
      if (!entity) {
        entity = { id, nome: mention.name, sigla: mention.acronym, cnpj: mention.cnpj,
          aliases: [], situacao: 'candidato — identidade não conferida', fonte_inicial: row.url };
        identities.set(id, entity);
      } else {
        if (mention.cnpj && entity.cnpj && mention.cnpj !== entity.cnpj) {
          links.push({ documento_id: row.id, consorcio_id: '', situacao: 'CNPJ divergente — revisão humana',
            nome_mencionado: mention.name, sigla_mencionada: mention.acronym, cnpj_mencionado: mention.cnpj,
            origem: mention.origin, evidencia: mention.evidence, url: row.url,
            url_evidencia: mention.evidenceUrl || row.url });
          continue;
        }
        if (key !== identityKey(entity.nome) && !entity.aliases.some((alias) => identityKey(alias) === key)) entity.aliases.push(mention.name);
        if (!entity.cnpj && mention.cnpj) entity.cnpj = mention.cnpj;
        if (!entity.sigla && mention.acronym) entity.sigla = mention.acronym;
      }
      byName.set(key, id);
      if (mention.cnpj) byCnpj.set(mention.cnpj, id);
      links.push({ documento_id: row.id, consorcio_id: id,
        situacao: mention.origin === 'fonte complementar'
          ? 'fonte complementar conferida — identidade pendente de revisão humana'
          : 'menção automática — identidade não conferida',
        nome_mencionado: mention.name, sigla_mencionada: mention.acronym, cnpj_mencionado: mention.cnpj,
        origem: mention.origin, evidencia: mention.evidence, url: row.url,
        url_evidencia: mention.evidenceUrl || row.url });
    }
  }
  const byAcronym = new Map();
  for (const entity of identities.values()) {
    const key = identityKey(entity.sigla).replaceAll(' ', '');
    if (!key || key.length < 5) continue;
    const current = byAcronym.get(key);
    byAcronym.set(key, current && current !== entity.id ? null : entity.id);
  }
  for (const row of rows) {
    const content = `${row.trecho || ''} ${row.titulo || ''}`;
    if (!/\bcons[oó]rcio\b/i.test(content)) continue;
    for (const [key, id] of byAcronym) {
      if (!id || links.some((link) => link.documento_id === row.id && link.consorcio_id === id)) continue;
      const entity = identities.get(id);
      const acronym = entity.sigla;
      const escaped = acronym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      const match = new RegExp(`\\b${escaped}\\b`, 'i').exec(content);
      if (!match) continue;
      const evidence = normalizeWhitespace(content.slice(Math.max(0, match.index - 90), match.index + match[0].length + 90));
      if (!/\bcons[oó]rcio\b/i.test(evidence)) continue;
      links.push({ documento_id: row.id, consorcio_id: id,
        situacao: 'sigla conhecida no contexto — revisão humana', nome_mencionado: '',
        sigla_mencionada: acronym, cnpj_mencionado: '', origem: 'sigla', evidencia: evidence.slice(0, 240),
        url: row.url, url_evidencia: row.url });
    }
  }
  const linkedIds = new Set(links.map((link) => link.consorcio_id).filter(Boolean));
  const retained = [...identities.values()].filter((entity) =>
    linkedIds.has(entity.id) || entity.situacao === 'revisado');
  return { identities: retained.sort((a, b) => a.id.localeCompare(b.id)), links };
}
