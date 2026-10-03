import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { canonicalUrl } from './dedupe.mjs';
import { classifyItem } from './classifier.mjs';
import { normalizeWhitespace } from './text.mjs';

const FIELDS = [
  'id', 'primeira_coleta', 'ultima_coleta', 'data_publicacao', 'tipo_evento',
  'etapa', 'situacao_analise', 'efeito_na_participacao', 'tipo_documento',
  'consorcio', 'sigla', 'municipio', 'uf', 'titulo', 'fonte', 'url',
  'trecho', 'pontuacao', 'revisao_ia', 'enviado_em',
];

function safeText(value, limit = 500) {
  return normalizeWhitespace(String(value || ''))
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF omitido]')
    .replace(/\b\d{11}\b/g, '[identificador omitido]')
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, '[email omitido]')
    .slice(0, limit);
}

function documentType(item) {
  const text = item.kind === 'gazette'
    ? `${item.title || ''} ${item.classification?.evidenceText || ''}`.slice(0, 500)
    : String(item.title || '');
  if (/\bprojeto de lei\b/i.test(text)) return 'projeto de lei';
  if (/\blei (?:municipal|ordin[aá]ria|n[ºo°.]|complementar)\b/i.test(text)) return 'lei';
  if (/\bcontrato de rateio\b/i.test(text)) return 'contrato de rateio';
  if (/\bprotocolo de inten[cç][oõ]es\b/i.test(text)) return 'protocolo de intenções';
  if (/\b(?:resolu[cç][aã]o|ac[oó]rd[aã]o|decis[aã]o)\b/i.test(text)) return 'decisão ou resolução';
  return item.kind === 'gazette' ? 'ato oficial (tipo a verificar)' : 'notícia ou página';
}

function stage(item, type) {
  if (type === 'projeto de lei') return 'proposta — não aprovada';
  if (item.classification?.category === 'ADESÃO AUTORIZADA' ||
    /\bautoriza\b.{0,100}\b(?:ingresso|ades[aã]o|integrar)\b/i.test(item.classification?.evidenceText || '')) {
    return 'autorização — ingresso não comprovado';
  }
  if (item.kind === 'gazette') return 'ato publicado — efeito a verificar';
  return 'relato — conferir documento original';
}

function analysisStatus(item, sentAt) {
  const ai = item.aiReview?.status;
  if (ai === 'rejected') return 'rejeitado pela revisão automática';
  if (ai === 'disputed') return 'divergente — requer revisão humana';
  if (item.classification?.category === 'GERAL' || (item.classification?.score ?? 0) < 5) {
    return 'triagem: sem evento relevante comprovado';
  }
  if (sentAt) return item.classification?.evidenceText
    ? 'publicado pelo radar — não confirmado manualmente'
    : 'legado sem texto — publicação antiga, requer conferência';
  if (ai === 'approved') return 'aprovado pela IA — não confirmado manualmente';
  return 'candidato — requer revisão';
}

export function catalogRecord(item, firstSeenAt, lastSeenAt, sentAt = '') {
  const url = canonicalUrl(item.url || '');
  if (!/^https?:\/\//i.test(url)) return null;
  const id = createHash('sha256').update(url).digest('hex');
  const type = documentType(item);
  const title = safeText(item.title, 300);
  const territory = item.territoryName || /^Diário Oficial de (.+?) \([A-Z]{2}\)$/i.exec(title)?.[1] || '';
  const stateCode = item.stateCode || /\(([A-Z]{2})\)$/.exec(title)?.[1] || '';
  return {
    id,
    primeira_coleta: firstSeenAt || '', ultima_coleta: lastSeenAt || '',
    data_publicacao: item.publishedAt || '', tipo_evento: item.classification?.category || 'NÃO CLASSIFICADO',
    etapa: stage(item, type), situacao_analise: analysisStatus(item, sentAt),
    efeito_na_participacao: 'não inferido automaticamente', tipo_documento: type,
    consorcio: safeText(item.entityName, 180), sigla: safeText(item.entityAlias, 40),
    municipio: safeText(territory, 100), uf: safeText(stateCode, 2),
    titulo: title, fonte: safeText(item.source, 120), url,
    trecho: safeText(item.classification?.evidenceText || (item.classification?.category !== 'GERAL' ? item.summary : ''), 500),
    pontuacao: item.classification?.score ?? '', revisao_ia: item.aiReview?.status || '', enviado_em: sentAt || '',
  };
}

function statusPriority(status) {
  if (status.startsWith('legado')) return 0;
  if (status.startsWith('rejeitado') || status.startsWith('divergente')) return 5;
  if (status.startsWith('publicado')) return 4;
  if (status.startsWith('aprovado')) return 3;
  if (status.startsWith('candidato')) return 2;
  return 1;
}

export function mergeCatalogRecord(existing, incoming) {
  if (!existing) return incoming;
  const incomingBetter = statusPriority(incoming.situacao_analise) > statusPriority(existing.situacao_analise) ||
    (statusPriority(incoming.situacao_analise) === statusPriority(existing.situacao_analise) &&
      (incoming.trecho.length > existing.trecho.length ||
        (incoming.pontuacao || 0) > (existing.pontuacao || 0)));
  const best = incomingBetter ? incoming : existing;
  return { ...best,
    primeira_coleta: [existing.primeira_coleta, incoming.primeira_coleta].filter(Boolean).sort()[0] || '',
    ultima_coleta: [existing.ultima_coleta, incoming.ultima_coleta].filter(Boolean).sort().at(-1) || '',
    enviado_em: existing.enviado_em || incoming.enviado_em || '',
    consorcio: best.consorcio || existing.consorcio || incoming.consorcio,
    sigla: best.sigla || existing.sigla || incoming.sigla,
    trecho: [existing.trecho, incoming.trecho].sort((a, b) => b.length - a.length)[0],
    tipo_documento: /(?:a verificar|notícia ou página)/.test(best.tipo_documento)
      ? [existing.tipo_documento, incoming.tipo_documento].find((type) => !/(?:a verificar|notícia ou página)/.test(type)) || best.tipo_documento
      : best.tipo_documento,
    etapa: best.etapa === 'relato — conferir documento original' && incoming.etapa !== best.etapa
      ? incoming.etapa : best.etapa,
    municipio: best.municipio || existing.municipio || incoming.municipio,
    uf: best.uf || existing.uf || incoming.uf,
    data_publicacao: best.data_publicacao || existing.data_publicacao || incoming.data_publicacao,
  };
}

export function mergeStateIntoCatalog(records, state) {
  const seenByUrl = new Map(Object.values(state.seen || {}).filter((row) => row.url)
    .map((row) => [canonicalUrl(row.url), row]));
  for (const observation of Object.values(state.observations || {})) {
    const original = observation.item;
    const preservedEvidence = original?.classification?.evidenceText;
    const recheckItem = preservedEvidence
      ? { ...original, excerpts: [preservedEvidence, original.summary].filter(Boolean) }
      : original;
    const classification = original?.aiReview?.status === 'approved' && original.aiReview.category
      ? { ...classifyItem(recheckItem), category: original.aiReview.category }
      : original ? classifyItem(recheckItem) : null;
    const item = original ? { ...original, classification } : null;
    if (!item?.url) continue;
    const sent = seenByUrl.get(canonicalUrl(item.url))?.sentAt || '';
    const row = catalogRecord(item, observation.firstSeenAt, observation.lastSeenAt, sent);
    if (row) records.set(row.id, mergeCatalogRecord(records.get(row.id), row));
  }
  for (const seen of Object.values(state.seen || {})) {
    const row = catalogRecord({ title: seen.title, url: seen.url, source: seen.source,
      publishedAt: seen.publishedAt, classification: { category: seen.category, score: 5 } },
    seen.sentAt, seen.sentAt, seen.sentAt);
    if (!row) continue;
    const old = records.get(row.id);
    if (old) {
      records.set(row.id, { ...old, enviado_em: seen.sentAt || old.enviado_em,
        situacao_analise: old.tipo_evento === 'GERAL' || /^(rejeitado|divergente)/.test(old.situacao_analise)
          ? old.situacao_analise : old.trecho
            ? 'publicado pelo radar — não confirmado manualmente'
            : 'legado sem texto — publicação antiga, requer conferência' });
    } else records.set(row.id, row);
  }
  for (const pending of Object.values(state.pending || {})) {
    const item = pending.item;
    if (!item) continue;
    const row = catalogRecord(item, pending.queuedAt, pending.queuedAt);
    if (row) records.set(row.id, mergeCatalogRecord(records.get(row.id), row));
  }
  return records;
}

function csvCell(value) {
  const raw = String(value ?? '');
  const text = /^[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function loadCatalog(file) {
  try {
    const rows = (await readFile(file, 'utf8')).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
    return new Map(rows.map((row) => [row.id, row]));
  } catch (error) {
    if (error.code === 'ENOENT') return new Map();
    throw error;
  }
}

export async function saveCatalog(directory, records) {
  await mkdir(directory, { recursive: true });
  const all = [...records.values()].sort((a, b) => a.id.localeCompare(b.id));
  const relevant = all.filter((row) => row.tipo_evento !== 'GERAL' && row.tipo_evento !== 'NÃO CLASSIFICADO');
  await writeFile(path.join(directory, 'arquivo-coletas.ndjson'), all.map((row) => JSON.stringify(row)).join('\n') + '\n');
  await writeFile(path.join(directory, 'eventos.csv'), [FIELDS.join(','), ...relevant.map((row) =>
    FIELDS.map((field) => csvCell(row[field])).join(','))].join('\n') + '\n', 'utf8');
  const consortia = new Map();
  for (const row of relevant) {
    if (!row.consorcio) continue;
    const key = `${row.consorcio.toLowerCase()}|${row.sigla.toLowerCase()}`;
    const old = consortia.get(key);
    consortia.set(key, { nome: row.consorcio, sigla: row.sigla,
      registros: (old?.registros || 0) + 1, fonte_exemplo: old?.fonte_exemplo || row.url,
      situacao: 'identidade citada na fonte — composição não verificada' });
  }
  const entityFields = ['nome', 'sigla', 'registros', 'fonte_exemplo', 'situacao'];
  await writeFile(path.join(directory, 'consorcios.csv'), [entityFields.join(','),
    ...[...consortia.values()].sort((a, b) => a.nome.localeCompare(b.nome)).map((row) =>
      entityFields.map((field) => csvCell(row[field])).join(','))].join('\n') + '\n', 'utf8');
  const counts = new Map();
  for (const row of relevant) counts.set(row.tipo_evento, (counts.get(row.tipo_evento) || 0) + 1);
  const recent = [...relevant].filter((row) => !/^(rejeitado|divergente|legado)/.test(row.situacao_analise))
    .sort((a, b) => (b.data_publicacao || b.primeira_coleta).localeCompare(a.data_publicacao || a.primeira_coleta))
    .slice(0, 15);
  const summary = [
    '# Panorama da base histórica', '',
    `- ${all.length} documentos recuperados do histórico de coletas.`,
    `- ${relevant.length} registros relacionados a eventos de consórcios, **ainda não confirmados manualmente**.`,
    `- ${consortia.size} ${consortia.size === 1 ? 'consórcio identificado' : 'consórcios identificados'} pelo nome explícito nos metadados. Os demais documentos continuam acessíveis por link.`,
    '', '## Registros por tema', '',
    '| Tema | Registros |', '|---|---:|',
    ...[...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => `| ${name} | ${count} |`),
    '', '## Registros recentes para conferir', '',
    '| Publicação | Tema e etapa | Situação | Documento |', '|---|---|---|---|',
    ...recent.map((row) => `| ${(row.data_publicacao || row.primeira_coleta).slice(0, 10)} | ${row.tipo_evento} — ${row.etapa.replaceAll('|', '\\|')} | ${row.situacao_analise.replaceAll('|', '\\|')} | [${row.titulo.replaceAll('|', '\\|').replaceAll('[', '\\[').replaceAll(']', '\\]')}](${row.url}) |`),
    '', 'Veja todos os registros em `eventos.csv`. Classificação automática, publicação pelo radar e autorização legal não comprovam sozinhas a composição de um consórcio.', '',
  ];
  await writeFile(path.join(directory, 'resumo.md'), summary.join('\n'), 'utf8');
  return { all: all.length, relevant: relevant.length, consortia: consortia.size };
}
