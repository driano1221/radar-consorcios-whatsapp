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

async function readCsvColumns(name) {
  const firstLine = (await readFile(path.join(catalog, name), 'utf8')).split(/\r?\n/, 1)[0];
  return firstLine.split(',').map((value) => value.trim()).filter(Boolean);
}

async function readNdjson(name) {
  return (await readFile(path.join(catalog, name), 'utf8'))
    .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

const TABLES = [
  ['eventos', 'Eventos', 'Fatos e candidatos relacionados a consórcios; só a revisão editorial confirma um acontecimento.'],
  ['consorcios', 'Consórcios', 'Identidades encontradas nos documentos. Não é cadastro oficial nem composição atual.'],
  ['participacoes', 'Participações', 'Relações município–consórcio com evidência documental revisada.'],
  ['vinculos-documentos', 'Vínculos documentais', 'Menções que conectam documentos e consórcios; menção não comprova adesão.'],
  ['identidade-pendente', 'Identidade pendente', 'Documentos cujo consórcio ainda não pôde ser identificado com segurança.'],
  ['arquivo-coletas', 'Arquivo de coletas', 'Todos os documentos guardados, inclusive descartes e títulos sem texto.'],
  ['revisoes-eventos', 'Revisões editoriais', 'Decisões humanas lacradas ao trecho do documento e sua justificativa.'],
];

const COLUMN_DOCS = {
  id: 'Identificador técnico estável da linha; não é CNPJ.',
  documento_id: 'ID do documento no arquivo de coletas.',
  documento_relacionado: 'ID de outro documento que representa o mesmo episódio.',
  consorcio_id: 'ID da identidade do consórcio nesta base.',
  primeira_coleta: 'Data em que o radar encontrou esta URL pela primeira vez.',
  ultima_coleta: 'Data da última vez em que o radar encontrou esta URL.',
  data_publicacao: 'Data informada pelo feed, portal ou edição; pode não ser a data do fato.',
  data_noticia_original: 'Data publicada na página original, quando recuperada.',
  data_fato: 'Data exata do acontecimento, somente quando comprovada.',
  mes_fato: 'Mês do acontecimento quando o dia exato não foi comprovado.',
  tipo_evento: 'Categoria atribuída ao acontecimento ou hipótese de triagem.',
  decisao_base: 'Situação do fato para o catálogo: confirmado, candidato ou descartado.',
  decisao_alerta: 'Situação do envio ao WhatsApp; pode diferir da decisão da base.',
  motivo_alerta: 'Explicação da decisão de enviar ou não enviar.',
  etapa: 'Estágio comprovado: proposta, autorização, ato assinado ou atuação.',
  situacao_analise: 'Descrição da revisão, da pendência ou do descarte.',
  efeito_na_participacao: 'Efeito comprovado sobre a participação municipal; vazio ou não inferido não significa ausência de efeito.',
  tipo_documento: 'Natureza da fonte, como lei, contrato, notícia ou diário.',
  consorcio: 'Nome do consórcio mencionado no registro.',
  nome: 'Denominação da identidade do consórcio.',
  sigla: 'Sigla associada à entidade quando identificada.',
  cnpj: 'CNPJ atribuído ao consórcio apenas quando a fonte permite a associação.',
  aliases: 'Outros nomes ou grafias encontrados para a mesma identidade.',
  municipio: 'Município citado ou relacionado ao consórcio.',
  cnpj_municipio: 'CNPJ do município, distinto do CNPJ do consórcio.',
  uf: 'Unidade da Federação associada ao registro.',
  titulo: 'Título capturado da publicação; pode ser genérico em diários oficiais.',
  fonte: 'Portal ou veículo em que o registro foi encontrado.',
  fonte_inicial: 'Primeira fonte usada para registrar a identidade.',
  fonte_ultima_evidencia: 'Endereço do documento da última evidência de participação.',
  url: 'Endereço original do documento ou da notícia.',
  article_url: 'Endereço da página original quando o resultado veio de um agregador.',
  url_evidencia: 'Endereço do documento que sustenta o vínculo.',
  trecho: 'Excerto guardado pelo radar; não é necessariamente o texto integral.',
  evidencia: 'Trecho ou descrição específica que sustenta a decisão.',
  nome_mencionado: 'Nome do consórcio como aparece neste documento.',
  sigla_mencionada: 'Sigla do consórcio como aparece neste documento.',
  cnpj_mencionado: 'CNPJ citado no documento; não significa associação já validada.',
  origem: 'Parte do documento de onde saiu o vínculo.',
  pontuacao: 'Pontuação da regra de triagem; não é probabilidade nem validação humana.',
  revisao_ia: 'Resultado da revisão automática por IA, quando executada.',
  enviado_em: 'Data do envio ao WhatsApp, se houve.',
  documentos_vinculados: 'Quantidade de documentos ligados à identidade.',
  situacao: 'Estado da identidade, participação ou vínculo nesta tabela.',
  ano_ingresso: 'Ano de adesão, apenas quando comprovado; vazio significa desconhecido.',
  ano_ultima_evidencia_participacao: 'Ano do documento mais recente que comprova participação; não é ano de ingresso.',
  motivo: 'Justificativa da pendência ou da revisão.',
  decisao: 'Decisão humana sobre o documento: confirmar, corrigir, descartar ou duplicar.',
  categoria: 'Categoria atribuída após a revisão editorial.',
  fonte_evidencia: 'Endereço da fonte consultada na revisão.',
  fatos: 'Dados estruturados extraídos e conferidos na revisão.',
  trecho_sha256: 'Hash do trecho revisado; impede reaplicar a decisão se o texto mudar.',
  publicar: 'Indica se um fato confirmado também deve gerar alerta; falso mantém o fato na base.',
  motivo_publicacao: 'Explicação de por que o alerta foi bloqueado.',
  article_attempted_at: 'Data da última tentativa de recuperar o texto original.',
  article_attempts: 'Número de tentativas de recuperar o artigo.',
  article_text_sha256: 'Hash do texto integral recuperado, guardado separadamente.',
  article_reader: 'Leitor que extraiu o texto da página.',
  article_recovery_reason: 'Motivo pelo qual a leitura integral não foi possível.',
  article_suggested_category: 'Categoria sugerida após ler o texto; não altera sozinha a decisão.',
  article_suggested_score: 'Pontuação da sugestão após recuperação de texto.',
  article_suggestion_evidence: 'Trecho usado para a sugestão após recuperação.',
  article_duplicate_of: 'ID de outro documento com o mesmo texto recuperado.',
};

const FIRST_COLUMNS = {
  eventos: ['titulo', 'tipo_evento', 'decisao_base', 'decisao_alerta', 'consorcio', 'municipio', 'data_fato', 'data_publicacao'],
  consorcios: ['nome', 'sigla', 'cnpj', 'situacao', 'documentos_vinculados'],
  participacoes: ['consorcio', 'municipio', 'ano_ingresso', 'ano_ultima_evidencia_participacao', 'situacao'],
  'vinculos-documentos': ['nome_mencionado', 'situacao', 'evidencia', 'documento_id'],
  'identidade-pendente': ['titulo', 'motivo', 'tipo_evento'],
  'arquivo-coletas': ['titulo', 'fonte', 'tipo_evento', 'decisao_base', 'data_publicacao'],
  'revisoes-eventos': ['documento_id', 'decisao', 'categoria', 'motivo', 'evidencia'],
};

export function makeBaseTable(id, rows, columns = []) {
  const definition = TABLES.find(([key]) => key === id);
  const keys = columns.length ? columns : [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const preferred = FIRST_COLUMNS[id] || [];
  const ordered = [...preferred.filter((key) => keys.includes(key)), ...keys.filter((key) => !preferred.includes(key))];
  return { id, title: definition?.[1] || id, description: definition?.[2] || '',
    columns: ordered.map((key) => ({ key, label: key.replaceAll('_', ' '),
      description: COLUMN_DOCS[key] || `Campo técnico “${key}” preservado como consta na fonte da tabela.` })),
    rows };
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

function brazilDay(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(parsed);
  const field = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${field.year}-${field.month}-${field.day}`;
}

export function dashboardSourceCatalog(config = {}) {
  const sources = [];
  const add = (family, name, url, enabled = true, mode = 'Coleta ativa', fallback = '') => {
    sources.push({ family, name, url: url || '', enabled, mode, fallback });
  };
  if (config.googleNews) add('Google Notícias', `Buscas por consórcios (${config.googleNews.queries?.length || 0} consultas)`,
    'https://news.google.com/', config.googleNews.enabled !== false);
  if (config.queridoDiario) add('Querido Diário', `Diários oficiais (${config.queridoDiario.queryGroups?.length || 0} grupos de termos)`,
    config.queridoDiario.baseUrl, config.queridoDiario.enabled !== false);
  for (const feed of config.rssFeeds?.feeds || []) add('Feeds RSS', feed.enabled === false && feed.name === 'CIGA' ? 'CIGA (feed RSS antigo)' : feed.name, feed.url,
    config.rssFeeds.enabled !== false && feed.enabled !== false);
  for (const site of config.webScrapers?.sites || []) add('Portais e diários', site.name, site.url,
    config.webScrapers.enabled !== false && site.enabled !== false,
    site.publish === false || config.webScrapers.publish === false && site.publish !== true ? 'Coleta em prévia' : 'Coleta ativa', site.fallback);
  for (const site of config.sapl?.sites || []) add('Câmaras (SAPL)', site.name, site.url,
    config.sapl.enabled !== false && site.enabled !== false);
  if (config.ciga) add('CIGA', 'Notícias do Consórcio CIGA', config.ciga.baseUrl, config.ciga.enabled !== false);
  return sources;
}

export function buildDashboardData({ archive, events, consortia, links, pendingIdentity,
  participations = [], decisions = {}, editorialReviews = [], pdfRecovery = [],
  articleTexts = [], sourceHealth = {}, runs = {}, baseTables = [], sourceConfig = {} }, generatedAt = new Date().toISOString()) {
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
  const primarySources = ['Google News', 'Querido Diário', 'Feeds RSS', 'Scrapers web', 'SAPL', 'CIGA'];
  const latestDay = brazilDay(latestRun?.at);
  const todayRuns = latestDay ? orderedRuns.filter((run) => brazilDay(run.at) === latestDay) : [];
  const todayNew = latestDay ? items.filter((item) => brazilDay(item.firstSeenAt) === latestDay &&
    item.firstSeenAt <= latestRun.at) : [];
  const collection = latestRun ? {
    at: latestRun.at,
    rawCollected: Number(latestRun.collected) || 0,
    newDocuments: recentItems.length,
    newCandidates: recentItems.filter((item) => item.activeCandidate).length,
    today: { day: latestDay, runs: todayRuns.length, newDocuments: todayNew.length },
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
    sourceCatalog: dashboardSourceCatalog(sourceConfig),
    items,
    baseTables,
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
  const [eventColumns, consortiumColumns, participationColumns, linkColumns, pendingColumns] = await Promise.all(
    ['eventos.csv', 'consorcios.csv', 'participacoes.csv', 'vinculos-documentos.csv', 'identidade-pendente.csv']
      .map(readCsvColumns));
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
  const sourceConfig = JSON.parse(await readFile(path.join(root, 'config', 'default.json'), 'utf8'));
  const data = buildDashboardData({ archive, events, consortia, links, pendingIdentity,
    editorialReviews, participations, pdfRecovery, articleTexts, decisions, sourceHealth: state.health || {}, runs: state.runs || {},
    sourceConfig,
    baseTables: [
      makeBaseTable('eventos', events, eventColumns),
      makeBaseTable('consorcios', consortia, consortiumColumns),
      makeBaseTable('participacoes', participations, participationColumns),
      makeBaseTable('vinculos-documentos', links, linkColumns),
      makeBaseTable('identidade-pendente', pendingIdentity, pendingColumns),
      makeBaseTable('arquivo-coletas', archive),
      makeBaseTable('revisoes-eventos', editorialReviews),
    ] });
  await mkdir(destination, { recursive: true });
  await Promise.all(['index.html', 'style.css', 'redesign.css', 'registry.css', 'app.js', 'triage-model.mjs'].map((name) =>
    copyFile(path.join(root, 'dashboard', 'src', name), path.join(destination, name))));
  await writeFile(path.join(destination, 'data.json'), `${JSON.stringify(data)}\n`, 'utf8');
  console.log(`[painel] ${data.stats.documents} documentos; ${data.stats.eventCandidates} eventos candidatos; ${data.stats.consortiaCandidates} identidades. Arquivos em ${destination}`);
}
