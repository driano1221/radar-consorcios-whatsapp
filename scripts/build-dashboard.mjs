import { readFile, mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { classifyItem, isStaleLegislativeDocument } from '../src/lib/classifier.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const catalog = path.join(root, 'data', 'catalogo');
const destination = path.join(root, 'dashboard', 'dist');

function csvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted && char === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (!quoted && char === ',') { row.push(cell); cell = ''; }
    else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell); if (row.some(Boolean)) rows.push(row);
      row = []; cell = '';
    } else cell += char;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [headers, ...data] = rows;
  return data.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

async function readCsv(name) {
  return csvRows(await readFile(path.join(catalog, name), 'utf8'));
}

async function readNdjson(name) {
  return (await readFile(path.join(catalog, name), 'utf8'))
    .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

function comparableText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function contentQuality(title, excerpt) {
  const text = comparableText(excerpt);
  if (!text) return 'sem_trecho';
  const heading = comparableText(title);
  if (text.length >= 25 && (heading.includes(text) || text === heading)) return 'apenas_titulo';
  return 'trecho_disponivel';
}

export function buildDashboardData({ archive, events, consortia, links, pendingIdentity,
  decisions = {}, editorialReviews = [], sourceHealth = {} }, generatedAt = new Date().toISOString()) {
  const currentEvents = events.filter((row) => !isStaleLegislativeDocument({
    kind: 'news', title: row.titulo, publishedAt: row.data_publicacao,
  }));
  const eventById = new Map(currentEvents.map((row) => [row.id, row]));
  const eventIds = new Set(eventById.keys());
  const pendingIds = new Map(pendingIdentity.map((row) => [row.documento_id, row.motivo]));
  const reviewById = new Map(editorialReviews.filter((review) => review.documento_id && review.motivo)
    .map((review) => [review.documento_id, review]));
  const linkedByDocument = new Map();
  for (const link of links) {
    if (!linkedByDocument.has(link.documento_id)) linkedByDocument.set(link.documento_id, []);
    linkedByDocument.get(link.documento_id).push({
      consortiumId: link.consorcio_id, status: link.situacao,
      name: link.nome_mencionado, evidence: link.evidencia,
      evidenceUrl: link.url_evidencia,
    });
  }
  const items = archive.map((row) => {
    const decision = decisions[row.id] || null;
    const curated = eventById.get(row.id);
    const inEvents = Boolean(curated);
    const stale = isStaleLegislativeDocument({ kind: 'news', title: row.titulo, publishedAt: row.data_publicacao });
    const review = reviewById.get(row.id);
    const rejectedByReview = review?.decisao === 'nao_evento' && review.trecho_sha256 ===
      createHash('sha256').update(row.trecho || '').digest('hex');
    const reason = stale ? 'Ato antigo com data recente de indexação.'
      : rejectedByReview ? `Rejeitado por revisão editorial — ${review.motivo}`
      : curated?.situacao_analise?.startsWith('categoria corrigida') ? curated.situacao_analise
        : decision?.reason || curated?.situacao_analise || row.situacao_analise || 'Motivo individual ainda não registrado.';
    return {
      id: row.id, title: row.titulo, source: row.fonte,
      url: decision?.articleUrl || row.article_url || row.url,
      publishedAt: row.data_publicacao, firstSeenAt: row.primeira_coleta,
      lastSeenAt: decision?.lastSeenAt || row.ultima_coleta,
      category: inEvents ? curated.tipo_evento : 'GERAL',
      score: stale || rejectedByReview ? '' : decision?.score ?? row.pontuacao,
      baseStatus: inEvents ? 'evento_candidato' : 'arquivo_bruto',
      decisionStatus: stale || rejectedByReview ? 'descartado' : decision?.status || (inEvents ? 'historico' : 'sem_evento'),
      reason, classificationReasons: decision?.classificationReasons || [],
      reasonBasis: stale || rejectedByReview ? 'regra ou revisão atual' : decision?.reasonBasis || 'catálogo',
      stage: curated?.etapa || row.etapa,
      analysis: inEvents ? curated.situacao_analise : stale ? 'triagem: ato antigo' : row.situacao_analise,
      documentType: curated?.tipo_documento || row.tipo_documento,
      evidence: curated?.trecho || row.trecho,
      contentQuality: contentQuality(row.titulo, curated?.trecho || row.trecho),
      sentAt: row.enviado_em, aiStatus: decision?.aiStatus || row.revisao_ia,
      previewOnly: Boolean(decision?.previewOnly),
      identityPending: pendingIds.get(row.id) || '',
      links: linkedByDocument.get(row.id) || [],
      runId: decision?.runId || '', observedCount: decision?.observedCount || null,
    };
  }).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  const categories = {};
  const sources = {};
  for (const item of items) {
    if (!eventIds.has(item.id)) continue;
    categories[item.category] = (categories[item.category] || 0) + 1;
    sources[item.source] = (sources[item.source] || 0) + 1;
  }
  const collectionHealth = Object.values(sourceHealth).filter((row) => row && row.name).map((row) => ({
    name: row.name, status: row.status, checkedAt: row.checkedAt || '',
    lastSuccessAt: row.lastSuccessAt || '', itemCount: row.itemCount ?? null,
    consecutiveFailures: row.consecutiveFailures || 0, message: row.message || '',
  }));
  return {
    generatedAt,
    lastCollectionAt: items[0]?.lastSeenAt || '',
    disclaimer: 'O painel mostra documentos e hipóteses de eventos. Não comprova composição municipal ou efeito jurídico.',
    stats: {
      documents: items.length, eventCandidates: eventIds.size,
      consortiaCandidates: consortia.length,
      documentLinks: links.filter((row) => row.consorcio_id).length,
      pendingIdentity: pendingIds.size,
      sent: items.filter((row) => row.sentAt).length,
      recentDecisions: items.filter((row) => decisions[row.id]).length,
      insufficientContent: items.filter((row) => row.contentQuality !== 'trecho_disponivel').length,
      categories, sources,
    },
    collectionHealth,
    items,
    consortia: consortia.map((row) => ({
      id: row.id, name: row.nome, alias: row.sigla, cnpj: row.cnpj,
      documents: Number(row.documentos_vinculados || 0), status: row.situacao,
      aliases: row.aliases,
    })).sort((a, b) => b.documents - a.documents || a.name.localeCompare(b.name, 'pt-BR')),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [archive, events, consortia, links, pendingIdentity, editorialReviews] = await Promise.all([
    readNdjson('arquivo-coletas.ndjson'), readCsv('eventos.csv'), readCsv('consorcios.csv'),
    readCsv('vinculos-documentos.csv'), readCsv('identidade-pendente.csv'), readNdjson('revisoes-eventos.ndjson'),
  ]);
  const state = JSON.parse(await readFile(path.join(root, 'state', 'news-state.json'), 'utf8'));
  const decisions = { ...Object.fromEntries(Object.entries(state.observations || {}).map(([id, observation]) => {
    const item = observation.item || {};
    const evidence = item.classification?.evidenceText;
    const classification = classifyItem(evidence ? { ...item, excerpts: [evidence, item.summary].filter(Boolean) } : item);
    return [id, {
      status: classification.category === 'GERAL' ? 'descartado' : 'historico',
      reason: classification.reasons?.find((value) => value.startsWith('rejeitado:')) ||
        (classification.category === 'GERAL' ? 'Não foi identificado evento consorcial comprovado.' : 'Candidato histórico; decisão individual não foi preservada.'),
      score: classification.score,
      classificationReasons: classification.reasons || [],
      lastSeenAt: observation.lastSeenAt,
      articleUrl: item.articleUrl || '',
      reasonBasis: 'recalculado com as regras atuais',
    }];
  })), ...state.decisions };
  const data = buildDashboardData({ archive, events, consortia, links, pendingIdentity,
    editorialReviews, decisions, sourceHealth: state.health || {} });
  await mkdir(destination, { recursive: true });
  await Promise.all(['index.html', 'style.css', 'app.js'].map((name) =>
    copyFile(path.join(root, 'dashboard', 'src', name), path.join(destination, name))));
  await writeFile(path.join(destination, 'data.json'), `${JSON.stringify(data)}\n`, 'utf8');
  console.log(`[painel] ${data.stats.documents} documentos; ${data.stats.eventCandidates} eventos candidatos; ${data.stats.consortiaCandidates} identidades. Arquivos em ${destination}`);
}
