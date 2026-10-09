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

function publicationDate(row, review = null) {
  const verified = review?.fatos?.data_publicacao_original;
  if (/^\d{4}-\d{2}-\d{2}$/.test(verified || '')) return `${verified}T12:00:00Z`;
  if (row.data_publicacao) return row.data_publicacao;
  const match = /^https:\/\/data\.queridodiario\.ok\.org\.br\/\d+\/(\d{4}-\d{2}-\d{2})\//.exec(row.url || '');
  return match ? `${match[1]}T12:00:00Z` : '';
}

function sourceName(row) {
  if (row.fonte) return row.fonte;
  if (/^https:\/\/data\.queridodiario\.ok\.org\.br\//.test(row.url || '')) return 'Querido Diário';
  return '';
}

export function contentQuality(title, excerpt) {
  const text = comparableText(excerpt);
  if (!text) return 'sem_trecho';
  const heading = comparableText(title);
  if (text.length >= 25 && (heading.includes(text) || text === heading)) return 'apenas_titulo';
  return 'trecho_disponivel';
}

function distinctPdfSnippets(snippets, preferredPages = []) {
  const selected = [];
  const ranked = [...(snippets || [])].sort((a, b) =>
    Number(preferredPages.includes(Number(b.pagina))) - Number(preferredPages.includes(Number(a.pagina))));
  const ordered = [
    ...preferredPages.map((page) => ranked.find((snippet) => Number(snippet.pagina) === page)).filter(Boolean),
    ...ranked,
  ];
  for (const snippet of ordered) {
    const text = String(snippet.texto || '').trim();
    const words = new Set(comparableText(text).split(' ').filter((word) => word.length > 3));
    if (!text || selected.some((prior) => {
      if (prior.page !== Number(snippet.pagina)) return false;
      const common = [...words].filter((word) => prior.words.has(word)).length;
      return common / Math.min(words.size || 1, prior.words.size || 1) > 0.68;
    })) continue;
    selected.push({ page: Number(snippet.pagina) || null,
      column: snippet.coluna || '', text, words });
    if (selected.length >= 4) break;
  }
  return selected.map(({ words, ...item }) => item);
}

export function buildDashboardData({ archive, events, consortia, links, pendingIdentity,
  participations = [], decisions = {}, editorialReviews = [], pdfRecovery = [],
  articleTexts = [], sourceHealth = {}, runs = {} }, generatedAt = new Date().toISOString()) {
  const currentEvents = events.filter((row) => !isStaleLegislativeDocument({
    kind: 'news', title: row.titulo, publishedAt: row.data_publicacao,
  }));
  const eventById = new Map(currentEvents.map((row) => [row.id, row]));
  const eventIds = new Set(eventById.keys());
  const pendingIds = new Map(pendingIdentity.map((row) => [row.documento_id, row.motivo]));
  const reviewById = new Map(editorialReviews.filter((review) => review.documento_id && review.motivo)
    .map((review) => [review.documento_id, review]));
  const pdfById = new Map(pdfRecovery.filter((row) => row.documento_id && Array.isArray(row.trechos))
    .map((row) => [row.documento_id, row]));
  const articleTextById = new Map(articleTexts.filter((row) => row.documento_id && row.texto)
    .map((row) => [row.documento_id, row]));
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
    const stale = isStaleLegislativeDocument({ kind: 'news', title: row.titulo, publishedAt: publicationDate(row) });
    const review = reviewById.get(row.id);
    const reviewValid = review?.trecho_sha256 === createHash('sha256').update(row.trecho || '').digest('hex');
    // Um ato antigo continua fora de eventos atuais, mas a revisão que explica
    // por que ele foi descartado deve permanecer visível ao usuário.
    const appliedReview = reviewValid ? review : null;
    const recovered = pdfById.get(row.id);
    const preferredPages = [review?.fatos?.pagina_pdf, ...(review?.fatos?.paginas_pdf || [])]
      .map(Number).filter(Boolean);
    const pdfEvidence = distinctPdfSnippets(recovered?.trechos, preferredPages);
    const articleText = articleTextById.get(row.id);
    const pdfText = (recovered?.trechos || []).map((snippet) => snippet.texto || '').join(' ');
    const pdfProof = pdfText && inEvents && !appliedReview && curated.tipo_evento === 'ADESÃO'
      ? classifyItem({ kind: 'gazette', title: row.titulo, rawText: pdfText,
        summary: pdfText, excerpts: [pdfText], url: row.url }) : null;
    const pdfReassessment = pdfProof?.category === 'GOVERNANÇA' &&
      pdfProof.stage === 'alteração do protocolo; ingresso novo não comprovado';
    const rejectedByReview = appliedReview?.decisao === 'nao_evento';
    const duplicateByReview = appliedReview?.decisao === 'duplicata';
    const rejectedEvent = inEvents && (rejectedByReview || duplicateByReview || (!appliedReview &&
      (/^(?:rejeitado|divergente)/i.test(curated.situacao_analise || '') ||
        ['rejeitado', 'descartado'].includes(decision?.status))));
    const legacyUnverified = inEvents && !appliedReview &&
      /^legado sem texto/i.test(curated.situacao_analise || '');
    const activeCandidate = inEvents && !stale && !rejectedEvent && !legacyUnverified;
    const pendingReview = activeCandidate && !['confirmar_evento', 'nao_evento', 'duplicata'].includes(appliedReview?.decisao);
    const reason = stale ? 'Ato antigo com data recente de indexação.'
      : rejectedByReview ? `Rejeitado por revisão editorial — ${review.motivo}`
      : duplicateByReview ? `Duplicata vinculada a ${review.documento_relacionado} — ${review.motivo}`
      : appliedReview?.motivo ? appliedReview.motivo
        : pdfReassessment ? `Leitura do PDF (página ${pdfEvidence[0]?.page || '?'}) indica alteração de protocolo; não comprova nova adesão. Categoria anterior: ADESÃO. Conferência humana pendente.`
        : decision?.reason || curated?.situacao_analise || row.situacao_analise || 'Motivo individual ainda não registrado.';
    return {
      id: row.id, title: row.titulo, source: sourceName(row),
      url: decision?.articleUrl || row.article_url || row.url,
      publishedAt: publicationDate(row, appliedReview), publishedDateSource: appliedReview?.fatos?.data_publicacao_original
        ? 'revisao_editorial' : row.data_publicacao ? 'catalogo'
        : publicationDate(row) ? 'url_edicao' : '',
      firstSeenAt: row.primeira_coleta,
      lastSeenAt: decision?.lastSeenAt || row.ultima_coleta,
      category: rejectedByReview || duplicateByReview ? 'GERAL'
        : appliedReview?.categoria || (pdfReassessment ? 'GOVERNANÇA' : inEvents ? curated.tipo_evento : 'GERAL'),
      score: stale || rejectedByReview || duplicateByReview ? '' : decision?.score ?? row.pontuacao,
      baseStatus: inEvents ? 'evento_candidato' : 'arquivo_bruto',
      baseDecision: curated?.decisao_base || row.decisao_base || (inEvents ? 'candidato' : 'descartado'),
      alertDecision: curated?.decisao_alerta || row.decisao_alerta || '',
      alertReason: curated?.motivo_alerta || row.motivo_alerta || '',
      eventAt: curated?.data_fato || row.data_fato || '',
      eventMonth: curated?.mes_fato || row.mes_fato || '',
      originalPublishedAt: curated?.data_noticia_original || row.data_noticia_original || '',
      activeCandidate, pendingReview, rejectedEvent, legacyUnverified,
      decisionStatus: stale || rejectedByReview || duplicateByReview ? 'descartado'
        : appliedReview?.decisao === 'confirmar_evento' ? 'confirmado'
          : rejectedEvent ? 'rejeitado' : legacyUnverified ? 'revisao' : pdfReassessment ? 'revisao'
            : decision?.status || (inEvents ? 'historico' : 'sem_evento'),
      reason, classificationReasons: decision?.classificationReasons || [],
      reasonBasis: stale || rejectedByReview ? 'regra ou revisão atual' : pdfReassessment ? 'releitura automática do PDF' : decision?.reasonBasis || 'catálogo',
      stage: rejectedByReview || duplicateByReview ? ''
        : pdfReassessment ? pdfProof.stage : appliedReview?.etapa || curated?.etapa || row.etapa,
      analysis: inEvents ? curated.situacao_analise : stale ? 'triagem: ato antigo' : row.situacao_analise,
      documentType: curated?.tipo_documento || row.tipo_documento,
      evidence: pdfReassessment ? pdfProof.evidenceText : curated?.trecho || row.trecho,
      pdfEvidence,
      pdfEvidenceUrl: recovered?.url_pdf || recovered?.url || '',
      pdfReassessment: Boolean(pdfReassessment),
      contentQuality: contentQuality(row.titulo, curated?.trecho || row.trecho),
      fullText: articleText?.texto || '', fullTextReader: articleText?.leitor || '',
      articleRecoveryReason: row.article_recovery_reason || '',
      articleAttempts: Number(row.article_attempts || 0),
      articleDuplicateOf: row.article_duplicate_of || '',
      recoverySuggestion: !appliedReview && row.article_suggested_category ? {
        category: row.article_suggested_category,
        score: Number(row.article_suggested_score || 0),
        evidence: row.article_suggestion_evidence || '',
      } : null,
      sentAt: row.enviado_em, aiStatus: decision?.aiStatus || row.revisao_ia,
      previewOnly: Boolean(decision?.previewOnly),
      identityPending: appliedReview?.fatos?.consorcio ? '' : pendingIds.get(row.id) || '',
      editorialReview: appliedReview ? {
        decision: appliedReview.decisao, reason: appliedReview.motivo,
        evidence: appliedReview.evidencia, evidenceUrl: appliedReview.fonte_evidencia || '',
        facts: appliedReview.fatos || {},
        relatedDocumentId: appliedReview.documento_relacionado || '',
      } : null,
      links: linkedByDocument.get(row.id) || [],
      runId: decision?.runId || '', observedCount: decision?.observedCount || null,
    };
  }).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
  const categories = {};
  const sources = {};
  for (const item of items) {
    if (!item.pendingReview) continue;
    categories[item.category] = (categories[item.category] || 0) + 1;
    sources[item.source] = (sources[item.source] || 0) + 1;
  }
  const collectionHealth = Object.values(sourceHealth).filter((row) => row && row.name).map((row) => ({
    name: row.name, status: row.status, checkedAt: row.checkedAt || '',
    lastSuccessAt: row.lastSuccessAt || '', itemCount: row.itemCount ?? null,
    consecutiveFailures: row.consecutiveFailures || 0, message: row.message || '',
  }));
  const orderedRuns = Object.values(runs).filter((run) => run?.at)
    .sort((a, b) => a.at.localeCompare(b.at));
  const latestRun = orderedRuns.at(-1);
  const previousRun = orderedRuns.at(-2);
  const recentItems = latestRun && previousRun
    ? items.filter((item) => item.firstSeenAt > previousRun.at && item.firstSeenAt <= latestRun.at) : [];
  const primarySources = ['Google News', 'Querido Diário', 'Feeds RSS', 'Scrapers web'];
  const collection = latestRun ? {
    at: latestRun.at,
    rawCollected: Number(latestRun.collected) || 0,
    newDocuments: recentItems.length,
    newCandidates: recentItems.filter((item) => item.activeCandidate).length,
    previousAt: previousRun?.at || '',
    sources: primarySources.map((name) => ({ name,
      count: Number(latestRun.health?.find((row) => row.name === name)?.itemCount) || 0 })),
  } : null;
  const participationsByConsortium = new Map();
  for (const participation of participations) {
    if (!participationsByConsortium.has(participation.consorcio_id)) participationsByConsortium.set(participation.consorcio_id, []);
    participationsByConsortium.get(participation.consorcio_id).push(participation);
  }
  return {
    generatedAt,
    lastCollectionAt: collection?.at || items[0]?.lastSeenAt || '',
    collection,
    disclaimer: 'O painel mostra documentos e hipóteses de eventos. Não comprova composição municipal ou efeito jurídico.',
    stats: {
      documents: items.length, eventCandidates: items.filter((row) => row.activeCandidate).length,
      pendingReview: items.filter((row) => row.pendingReview).length,
      eventRecords: eventIds.size,
      rejectedEventRecords: items.filter((row) => row.rejectedEvent).length,
      legacyUnverifiedRecords: items.filter((row) => row.legacyUnverified).length,
      consortiaCandidates: consortia.length,
      documentLinks: links.filter((row) => row.consorcio_id).length,
      pendingIdentity: items.filter((row) => row.identityPending).length,
      sent: items.filter((row) => row.sentAt).length,
      recentDecisions: items.filter((row) => decisions[row.id]).length,
      insufficientContent: items.filter((row) => row.contentQuality !== 'trecho_disponivel' && !row.pdfEvidence.length).length,
      insufficientActive: items.filter((row) => row.activeCandidate && !row.editorialReview && row.contentQuality !== 'trecho_disponivel' && !row.pdfEvidence.length).length,
      insufficientLegacy: items.filter((row) => row.legacyUnverified && !row.editorialReview && row.contentQuality !== 'trecho_disponivel' && !row.pdfEvidence.length).length,
      insufficientRaw: items.filter((row) => !row.activeCandidate && !row.legacyUnverified && !row.rejectedEvent && !row.editorialReview &&
        row.contentQuality !== 'trecho_disponivel' && !row.pdfEvidence.length).length,
      titleOnlyUnverified: items.filter((row) => !row.editorialReview && !row.pdfEvidence.length &&
        !row.fullText && row.contentQuality !== 'trecho_disponivel').length,
      recoveredSuggestions: items.filter((row) => row.recoverySuggestion).length,
      missingSourceCandidates: items.filter((row) => row.activeCandidate && !row.source).length,
      confirmed: items.filter((row) => row.editorialReview?.decision === 'confirmar_evento').length,
      editoriallyDiscarded: items.filter((row) => row.editorialReview?.decision === 'nao_evento').length,
      duplicates: items.filter((row) => row.editorialReview?.decision === 'duplicata').length,
      categories, sources,
    },
    collectionHealth,
    items,
    consortia: consortia.map((row) => ({
      id: row.id, name: row.nome, alias: row.sigla, cnpj: row.cnpj,
      documents: Number(row.documentos_vinculados || 0), status: row.situacao,
      aliases: row.aliases, sourceInitial: row.fonte_inicial,
      participations: participationsByConsortium.get(row.id) || [],
    })).sort((a, b) => b.documents - a.documents || a.name.localeCompare(b.name, 'pt-BR')),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [archive, events, consortia, links, pendingIdentity, editorialReviews, participations, pdfRecovery, articleTexts] = await Promise.all([
    readNdjson('arquivo-coletas.ndjson'), readCsv('eventos.csv'), readCsv('consorcios.csv'),
    readCsv('vinculos-documentos.csv'), readCsv('identidade-pendente.csv'), readNdjson('revisoes-eventos.ndjson'),
    readCsv('participacoes.csv'),
    Promise.all([readNdjson('recuperacao-pdf.ndjson'), readNdjson('recuperacao-pdf-grandes.ndjson'),
      readNdjson('recuperacao-pdf-curada.ndjson'),
      readNdjson('recuperacao-pdf-google.ndjson').catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error))])
      .then(([standard, large, curated, google]) => [...standard, ...large.filter((row) => row.trechos?.length), ...curated, ...google]),
    readNdjson('textos-artigos.ndjson').catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error)),
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
    editorialReviews, participations, pdfRecovery, articleTexts, decisions, sourceHealth: state.health || {}, runs: state.runs || {} });
  await mkdir(destination, { recursive: true });
  await Promise.all(['index.html', 'style.css', 'app.js'].map((name) =>
    copyFile(path.join(root, 'dashboard', 'src', name), path.join(destination, name))));
  await writeFile(path.join(destination, 'data.json'), `${JSON.stringify(data)}\n`, 'utf8');
  console.log(`[painel] ${data.stats.documents} documentos; ${data.stats.eventCandidates} eventos candidatos; ${data.stats.consortiaCandidates} identidades. Arquivos em ${destination}`);
}
