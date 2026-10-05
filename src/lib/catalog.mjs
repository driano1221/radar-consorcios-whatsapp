import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { canonicalUrl } from './dedupe.mjs';
import { classifyItem, isStaleLegislativeDocument } from './classifier.mjs';
import { normalizeWhitespace } from './text.mjs';
import { buildIdentityCatalog } from './consortium-identity.mjs';

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
  await writeFile(path.join(directory, 'arquivo-coletas.ndjson'), all.map((row) => JSON.stringify(row)).join('\n') + '\n');
  let editorialReviews = [];
  try {
    editorialReviews = (await readFile(path.join(directory, 'revisoes-eventos.ndjson'), 'utf8'))
      .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const decisions = new Map(editorialReviews.filter((review) =>
    (review.decisao === 'nao_evento' || (review.decisao === 'corrigir_categoria' && review.categoria)) &&
    review.documento_id && review.evidencia && review.motivo &&
    /^[a-f0-9]{64}$/.test(review.trecho_sha256 || ''))
    .map((review) => [review.documento_id, review]));
  const reviewStillMatches = (row) => decisions.get(row.id)?.trecho_sha256 ===
    createHash('sha256').update(row.trecho || '').digest('hex');
  const reviewed = all.map((row) => {
    let result = row;
    if (reviewStillMatches(row)) {
      const review = decisions.get(row.id);
      result = { ...row,
      tipo_evento: review.decisao === 'nao_evento' ? 'GERAL' : review.categoria,
      etapa: review.etapa || row.etapa,
      situacao_analise: `${review.decisao === 'nao_evento' ? 'rejeitado' : 'categoria corrigida'} por revisão editorial — ${review.motivo}`,
      revisao_editorial: review };
    }
    // O arquivo bruto mantém inclusive envios antigos, mas uma data de indexação
    // recente não deve transformá-los em eventos atuais nas tabelas derivadas.
    if (isStaleLegislativeDocument({ kind: 'news', title: row.titulo, publishedAt: row.data_publicacao })) {
      return { ...result, tipo_evento: 'GERAL',
        situacao_analise: 'triagem: ato antigo com data recente de indexação' };
    }
    return result;
  });
  const relevant = reviewed.filter((row) => row.tipo_evento !== 'GERAL' && row.tipo_evento !== 'NÃO CLASSIFICADO');
  await writeFile(path.join(directory, 'eventos.csv'), [FIELDS.join(','), ...relevant.map((row) =>
    FIELDS.map((field) => csvCell(row[field])).join(','))].join('\n') + '\n', 'utf8');
  let previousIdentities = [];
  try {
    previousIdentities = (await readFile(path.join(directory, 'identidades.ndjson'), 'utf8'))
      .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  let reviewedEvidence = [];
  try {
    reviewedEvidence = (await readFile(path.join(directory, 'evidencias-complementares.ndjson'), 'utf8'))
      .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  let identityReviews = [];
  try {
    identityReviews = (await readFile(path.join(directory, 'revisoes-identidades.ndjson'), 'utf8'))
      .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const suppressedIdentity = new Map(identityReviews.filter((review) =>
    review.decisao === 'pendente' && review.documento_id && review.motivo &&
    /^https:\/\//.test(review.fonte_evidencia || '') &&
    /^[a-f0-9]{64}$/.test(review.trecho_sha256 || ''))
    .map((review) => [review.documento_id, review]));
  const evidenceByDocument = new Map();
  for (const item of reviewedEvidence) {
    if (!item.documento_id || !item.nome || !item.fonte_evidencia) continue;
    if (!evidenceByDocument.has(item.documento_id)) evidenceByDocument.set(item.documento_id, []);
    evidenceByDocument.get(item.documento_id).push(item);
  }
  const enriched = relevant.map((row) => ({ ...row,
    curatedMentions: evidenceByDocument.get(row.id) || [],
    suppressAutoIdentity: suppressedIdentity.get(row.id)?.trecho_sha256 ===
      createHash('sha256').update(row.trecho || '').digest('hex') }));
  const { identities, links } = buildIdentityCatalog(enriched, previousIdentities);
  await writeFile(path.join(directory, 'identidades.ndjson'), identities.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
  const linkFields = ['documento_id', 'consorcio_id', 'situacao', 'nome_mencionado',
    'sigla_mencionada', 'cnpj_mencionado', 'origem', 'evidencia', 'url', 'url_evidencia'];
  await writeFile(path.join(directory, 'vinculos-documentos.csv'), [linkFields.join(','),
    ...links.map((row) => linkFields.map((field) => csvCell(row[field])).join(','))].join('\n') + '\n', 'utf8');
  const linkedDocuments = new Set(links.map((link) => link.consorcio_id ? link.documento_id : '').filter(Boolean));
  const pendingIdentity = enriched.filter((row) => !linkedDocuments.has(row.id));
  const pendingFields = ['documento_id', 'motivo', 'tipo_evento', 'titulo', 'url'];
  await writeFile(path.join(directory, 'identidade-pendente.csv'), [pendingFields.join(','),
    ...pendingIdentity.map((row) => {
      const values = { documento_id: row.id,
        motivo: row.suppressAutoIdentity ? suppressedIdentity.get(row.id).motivo
          : row.trecho ? 'nome completo e sigla não confirmados no trecho' : 'sem trecho preservado',
        tipo_evento: row.tipo_evento, titulo: row.titulo, url: row.url };
      return pendingFields.map((field) => csvCell(values[field])).join(',');
    })].join('\n') + '\n', 'utf8');
  const mentionCounts = new Map();
  for (const link of links) if (link.consorcio_id) mentionCounts.set(link.consorcio_id, (mentionCounts.get(link.consorcio_id) || 0) + 1);
  const entityFields = ['id', 'nome', 'sigla', 'cnpj', 'aliases', 'documentos_vinculados', 'situacao', 'fonte_inicial'];
  await writeFile(path.join(directory, 'consorcios.csv'), [entityFields.join(','),
    ...identities.map((entity) => entityFields.map((field) => csvCell(field === 'aliases'
      ? entity.aliases.join(' | ') : field === 'documentos_vinculados'
        ? mentionCounts.get(entity.id) || 0 : entity[field])).join(','))].join('\n') + '\n', 'utf8');
  const counts = new Map();
  for (const row of relevant) counts.set(row.tipo_evento, (counts.get(row.tipo_evento) || 0) + 1);
  const recent = [...relevant].filter((row) => !/^(rejeitado|divergente|legado)/.test(row.situacao_analise))
    .sort((a, b) => (b.data_publicacao || b.primeira_coleta).localeCompare(a.data_publicacao || a.primeira_coleta))
    .slice(0, 15);
  const summary = [
    '# Panorama da base histórica', '',
    `- ${all.length} documentos recuperados do histórico de coletas.`,
    `- ${relevant.length} registros relacionados a eventos de consórcios, **ainda não confirmados manualmente**.`,
    `- ${identities.length} identidades candidatas de consórcios; ${links.filter((link) => link.consorcio_id).length} vínculos documentais, dos quais ${links.filter((link) => link.consorcio_id && link.origem === 'fonte complementar').length} apoiados em fonte complementar conferida. A identidade e os eventos ainda exigem validação independente.`,
    `- ${pendingIdentity.length} documentos relevantes sem identidade segura, listados em \`identidade-pendente.csv\`.`,
    '', '## Registros por tema', '',
    '| Tema | Registros |', '|---|---:|',
    ...[...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([name, count]) => `| ${name} | ${count} |`),
    '', '## Registros recentes para conferir', '',
    '| Publicação | Tema e etapa | Situação | Documento |', '|---|---|---|---|',
    ...recent.map((row) => `| ${(row.data_publicacao || row.primeira_coleta).slice(0, 10)} | ${row.tipo_evento} — ${row.etapa.replaceAll('|', '\\|')} | ${row.situacao_analise.replaceAll('|', '\\|')} | [${row.titulo.replaceAll('|', '\\|').replaceAll('[', '\\[').replaceAll(']', '\\]')}](${row.url}) |`),
    '', 'Veja todos os registros em `eventos.csv`. Classificação automática, publicação pelo radar e autorização legal não comprovam sozinhas a composição de um consórcio.', '',
  ];
  await writeFile(path.join(directory, 'resumo.md'), summary.join('\n'), 'utf8');
  return { all: all.length, relevant: relevant.length, consortia: identities.length,
    links: links.length, pendingIdentity: pendingIdentity.length };
}
