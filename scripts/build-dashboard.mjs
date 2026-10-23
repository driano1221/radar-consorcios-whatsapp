import { readFile, mkdir, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { classifyItem, isStaleLegislativeDocument } from '../src/lib/classifier.mjs';
import { resolveGeography } from '../dashboard/src/geography-model.mjs';
import { compareNewestDiscovery } from '../dashboard/src/triage-model.mjs';
import {newsCsv} from '../dashboard/src/news-view.mjs';
import { writeFlowDiagrams } from './build-flow-diagram.mjs';
import { dashboardAlternatives, textPreview } from './dashboard-recovery.mjs';
import { validAlternativeDecision } from '../src/lib/alternative-triage.mjs';
import { partitionDashboard } from './dashboard-package.mjs';
import { categoryGroup, categoryLabel, reviewChecks, loadOriginalTriage, validOriginalTriage } from '../src/lib/simple-triage.mjs';
import {canonicalUrl} from '../src/lib/dedupe.mjs';

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
  ['eventos', 'Eventos', 'Fatos confirmados e casos em Revisar comigo, com categoria, etapa e evidência da triagem.'],
  ['consorcios', 'Consórcios', 'Identidades encontradas nos documentos. Não é cadastro oficial nem composição atual.'],
  ['participacoes', 'Participações', 'Relações município–consórcio com evidência documental revisada.'],
  ['vinculos-documentos', 'Vínculos documentais', 'Menções que conectam documentos e consórcios; menção não comprova adesão.'],
  ['identidade-pendente', 'Sinalizações de identidade', 'Histórico de documentos sinalizados na extração; alguns já foram descartados ou esclarecidos. Os pontos atuais ficam na triagem.'],
  ['arquivo-coletas', 'Arquivo de coletas', 'Arquivo bruto preservado: mostra os valores da captura, antes das revisões. A decisão atual está em Publicações e Eventos. Inclui descartes e títulos sem texto.'],
  ['atos', 'Fatos encontrados nos documentos', 'Fatos de uma mesma fonte, cada um com decisão e página próprias; a fonte não é contada novamente como fato.'],
  ['revisoes-eventos', 'Revisões editoriais', 'Decisões documentais lacradas ao trecho, com justificativa e método de revisão. Não são todas revisões humanas: confira o método de cada registro.'],
];

const COLUMN_DOCS = {
  id: 'Identificador técnico estável da linha; não é CNPJ.',
  documento_id: 'ID do documento no arquivo de coletas.',
  documento_pai_id: 'ID da edição ou PDF que contém este ato.',
  chave_ato: 'Identificador estável do ato dentro do PDF, independente da página.',
  pagina_inicio: 'Primeira página do PDF em que o ato aparece.',
  pagina_fim: 'Última página do PDF em que o ato aparece.',
  documento_relacionado: 'ID de outro documento que representa o mesmo episódio.',
  consorcio_id: 'ID da identidade do consórcio nesta base.',
  primeira_coleta: 'Data em que o radar encontrou esta URL pela primeira vez.',
  ultima_coleta: 'Data da última vez em que o radar encontrou esta URL.',
  data_publicacao: 'Data informada pelo feed, portal ou edição; pode não ser a data do fato.',
  data_noticia_original: 'Data publicada na página original, quando recuperada.',
  data_fato: 'Data exata do acontecimento, somente quando comprovada.',
  mes_fato: 'Mês do acontecimento quando o dia exato não foi comprovado.',
  ano_fato: 'Ano comprovado no documento revisado; não presume dia, mês nem ano de ingresso.',
  tipo_evento: 'Categoria atribuída ao acontecimento ou hipótese de triagem.',
  decisao_base: 'Decisão da triagem: confirmado, descartado ou revisão conjunta. Valores antigos são preservados no arquivo bruto.',
  decisao_alerta: 'Situação do envio ao WhatsApp; pode diferir da decisão da base.',
  motivo_alerta: 'Explicação da decisão de enviar ou não enviar.',
  etapa: 'Estágio comprovado: proposta, autorização, ato assinado ou atuação.',
  situacao_analise: 'Descrição da revisão, da pendência ou do descarte.',
  efeito_na_participacao: 'Efeito comprovado sobre a participação municipal; vazio ou não inferido não significa ausência de efeito.',
  tipo_documento: 'Natureza da fonte, como lei, contrato, notícia ou diário.',
  abrangencia: 'Nacional para orientações gerais; não representa a sede de um consórcio.',
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
  evidencia_triagem: 'Trecho da fonte que sustenta a decisão; confira o método e o endereço para distinguir original, alternativa e revisão humana.',
  fonte_evidencia_triagem: 'URL da fonte que fundamentou a decisão, com página quando disponível.',
  metodo_triagem: 'Indica se a decisão veio de regras automáticas, fonte alternativa ou revisão retroativa validada.',
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
  atos: ['titulo', 'tipo_evento', 'decisao_base', 'pagina_inicio', 'pagina_fim', 'documento_pai_id'],
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
  if (review?.fatos?.data_publicacao_nao_comprovada) return '';
  const verified = review?.fatos?.data_publicacao_original;
  if (/^\d{4}-\d{2}-\d{2}$/.test(verified || '')) return `${verified}T12:00:00Z`;
  if (review?.fatos?.precisao_data === 'ano') return '';
  if (row.data_noticia_original && Number.isFinite(Date.parse(row.data_noticia_original))) return row.data_noticia_original;
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

export function hasVerifiedMultiConsortiumNames(facts, text) {
  const aliases = facts?.consorcios;
  if (!Array.isArray(aliases) || aliases.length < 2 || !text) return false;
  return aliases.every((alias) => {
    const safeAlias = String(alias).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!safeAlias) return false;
    return new RegExp(`Cons[oó]rcio\\s+[\\p{L}\\p{M}\\s-]{12,150}\\(\\s*${safeAlias}\\s*\\)`, 'iu').test(text);
  });
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
  acts = [], participations = [], decisions = {}, editorialReviews = [], pdfRecovery = [],
  articleTexts = [], alternativeTexts = [], alternativeDecisions = [], originalDecisions = new Map(), sourceHealth = {}, runs = {}, deliveryQueue = [], baseTables = [], sourceConfig = {}, geographyReviews = {} }, generatedAt = new Date().toISOString()) {
  const queuedUrls = new Set(deliveryQueue.map(item=>canonicalUrl(item.url||'')));
  const currentEvents = events.filter((row) => !isStaleLegislativeDocument({
    kind: 'news', title: row.titulo, publishedAt: publicationDate(row),
  }));
  const eventById = new Map(currentEvents.map((row) => [row.id, row]));
  const eventIds = new Set(eventById.keys());
  const pendingIds = new Map(pendingIdentity.map((row) => [row.documento_id, row.motivo]));
  const reviewById = new Map(editorialReviews.filter((review) => review.documento_id && review.motivo)
    .map((review) => [review.documento_id, review]));
  const autoById = new Map(alternativeDecisions.map(d => [d.documento_id, d]));
  const humanIds = new Set(editorialReviews.map(r => r.documento_id));
  const pdfById = new Map(pdfRecovery.filter((row) => row.documento_id && Array.isArray(row.trechos))
    .map((row) => [row.documento_id, row]));
  const articleTextById = new Map(articleTexts.filter((row) => row.documento_id && row.texto)
    .map((row) => [row.documento_id, row]));
  const actsByParent = new Map();
  for (const act of acts) {
    if (!actsByParent.has(act.documento_pai_id)) actsByParent.set(act.documento_pai_id, []);
    actsByParent.get(act.documento_pai_id).push({ id: act.id, title: act.titulo,
      page: Number(act.pagina_inicio), decision: act.decisao_base });
  }
  const linkedByDocument = new Map();
  for (const link of links) {
    if (!linkedByDocument.has(link.documento_id)) linkedByDocument.set(link.documento_id, []);
    linkedByDocument.get(link.documento_id).push({
      consortiumId: link.consorcio_id, status: link.situacao,
      name: link.nome_mencionado, evidence: link.evidencia,
      evidenceUrl: link.url_evidencia,
    });
  }
  const items = [...archive, ...acts].map((row) => {
    const storedAuto = autoById.get(row.id);
    const auto = validAlternativeDecision(row, storedAuto, alternativeTexts, humanIds) ? storedAuto : null;
    const isSplitParent = actsByParent.has(row.id);
    const isAct = Boolean(row.documento_pai_id);
    const decision = decisions[row.id] || null;
    const curated = eventById.get(row.id);
    const inEvents = Boolean(curated);
    const auditReview = reviewById.get(row.id);
    const auditValid = auditReview?.trecho_sha256 === createHash('sha256').update(row.trecho || '').digest('hex');
    const review = isSplitParent ? null : auditReview;
    const reviewValid = review?.trecho_sha256 === createHash('sha256').update(row.trecho || '').digest('hex');
    const stale = !(reviewValid && review.lote_retroativo && review.publicar === false) &&
      isStaleLegislativeDocument({ kind: 'news', title: row.titulo, publishedAt: publicationDate(row) });
    // Um ato antigo continua fora de eventos atuais, mas a revisão que explica
    // por que ele foi descartado deve permanecer visível ao usuário.
    const appliedReview = reviewValid ? review : null;
    const recovered = pdfById.get(row.documento_pai_id || row.id);
    const preferredPages = [row.pagina_inicio, row.pagina_fim,
      review?.fatos?.pagina_pdf, ...(review?.fatos?.paginas_pdf || [])]
      .map(Number).filter(Boolean);
    const relevantSnippets = isAct ? recovered?.trechos?.filter((snippet) =>
      snippet.chave_ato ? snippet.chave_ato === row.chave_ato :
        Number(snippet.pagina) >= Number(row.pagina_inicio) && Number(snippet.pagina) <= Number(row.pagina_fim)) : recovered?.trechos;
    const pdfEvidence = distinctPdfSnippets(relevantSnippets, preferredPages);
    const articleText = articleTextById.get(row.documento_pai_id || row.id);
    const pdfText = (relevantSnippets || []).map((snippet) => snippet.texto || '').join(' ');
    const pdfProof = pdfText && inEvents && !appliedReview && curated.tipo_evento === 'ADESÃO'
      ? classifyItem({ kind: 'gazette', title: row.titulo, rawText: pdfText,
        summary: pdfText, excerpts: [pdfText], url: row.url }) : null;
    const pdfReassessment = pdfProof?.category === 'GOVERNANÇA' &&
      pdfProof.stage === 'alteração do protocolo; ingresso novo não comprovado';
    const rejectedByReview = appliedReview?.decisao === 'nao_evento';
    const duplicateByReview = appliedReview?.decisao === 'duplicata';
    const ruleReclassified = /^categoria recalculada pelas regras atuais/i.test(row.situacao_analise || '');
    const correctedOutOfBase = !inEvents && row.decisao_base === 'descartado' && ruleReclassified;
    const rejectedEvent = inEvents && (rejectedByReview || duplicateByReview || (!appliedReview &&
      (/^(?:rejeitado|divergente)/i.test(curated.situacao_analise || '') ||
        ['rejeitado', 'descartado'].includes(decision?.status))));
    const legacyUnverified = inEvents && !appliedReview &&
      /^legado sem texto/i.test(curated.situacao_analise || '');
    const activeCandidate = inEvents && !stale && !rejectedEvent && !legacyUnverified;
    const recoveredSuggestion = !appliedReview && !stale && Boolean(row.article_suggested_category);
    const pendingReview = activeCandidate && !['confirmar_evento', 'nao_evento', 'duplicata'].includes(appliedReview?.decisao)
      || recoveredSuggestion;
    const reason = isSplitParent ? `Rejeitada como registro adicional para evitar duplicação: os ${actsByParent.get(row.id).length} fatos desta fonte já foram registrados separadamente, com suas próprias decisões. Consulte os registros vinculados.`
      : stale ? 'Ato antigo com data recente de indexação.'
      : rejectedByReview ? `Rejeitado por revisão editorial — ${review.motivo}`
      : duplicateByReview ? `Duplicata vinculada a ${review.documento_relacionado} — ${review.motivo}`
      : recoveredSuggestion ? `O texto integral recuperado sugere ${row.article_suggested_category}, mas a decisão ainda não foi refeita. ${row.article_suggestion_evidence || ''}`.trim()
      : correctedOutOfBase ? `${row.situacao_analise}.${row.enviado_em ? ' Foi enviado antes da correção; o histórico do envio foi mantido.' : ''}`
      : appliedReview?.motivo ? appliedReview.motivo
        : pdfReassessment ? `Leitura do PDF (página ${pdfEvidence[0]?.page || '?'}) indica alteração de protocolo; não comprova nova adesão. Categoria anterior: ADESÃO. Conferência humana pendente.`
        : ruleReclassified ? [decision?.reason, row.situacao_analise].filter(Boolean).join(' ') :
          decision?.reason || curated?.situacao_analise || row.situacao_analise || 'Motivo individual ainda não registrado.';
    return {
      id: row.id, title: appliedReview?.titulo || row.titulo, source: sourceName(row),
      deliveryQueued: queuedUrls.has(canonicalUrl(row.url)),
      originalTitle: appliedReview?.titulo ? row.titulo : '',
      consortium: appliedReview?.fatos?.consorcio ?? curated?.consorcio ?? row.consorcio ?? '',
      consortiumAcronym: appliedReview?.fatos?.sigla ?? curated?.sigla ?? row.sigla ?? '',
      municipality: appliedReview?.fatos?.municipio ?? curated?.municipio ?? row.municipio ?? '',
      uf: appliedReview?.fatos?.uf ?? curated?.uf ?? row.uf ?? '',
      primaryDocuments: auditValid ? (auditReview.documentos_primarios || []).map(d => ({
        title:d.titulo,url:d.url,page:d.pagina,excerpt:d.trecho,sha256:d.pdf_sha256,
      })) : [],
      sourceDivergence: auditValid ? auditReview.divergencia_fonte || null : null,
      documentaryReviewAt: auditValid && auditReview.documentos_primarios?.length ? auditReview.revisado_em || '' : '',
      publishedYear: appliedReview?.fatos?.precisao_data === 'ano' ? appliedReview.fatos.ano : null,
      documentParentId: row.documento_pai_id || '',
      splitPublication: isSplitParent,
      relatedActs: actsByParent.get(row.documento_pai_id || row.id) || [],
      actPage: isAct ? Number(row.pagina_inicio) : null,
      url: decision?.articleUrl || row.article_url || row.url,
      publishedAt: publicationDate(row, appliedReview), publishedDateSource: appliedReview?.fatos?.data_publicacao_nao_comprovada
        ? 'nao_comprovada' : appliedReview?.fatos?.data_publicacao_original
        ? 'revisao_editorial' : row.data_noticia_original && Number.isFinite(Date.parse(row.data_noticia_original))
          ? 'fonte_original' : row.data_publicacao ? 'catalogo'
        : publicationDate(row) ? 'url_edicao' : '',
      firstSeenAt: row.primeira_coleta,
      lastSeenAt: decision?.lastSeenAt || row.ultima_coleta,
      category: rejectedByReview || duplicateByReview ? 'GERAL'
        : appliedReview?.categoria || (pdfReassessment ? 'GOVERNANÇA' : inEvents ? curated.tipo_evento : 'GERAL'),
      score: stale || rejectedByReview || duplicateByReview || correctedOutOfBase ? ''
        : ruleReclassified ? row.pontuacao : decision?.score ?? row.pontuacao,
      baseStatus: inEvents ? 'evento_candidato' : 'arquivo_bruto',
      baseDecision: isSplitParent ? 'descartado' : rejectedByReview || duplicateByReview ? 'descartado'
        : appliedReview?.decisao === 'confirmar_evento' ? 'confirmado'
          : recoveredSuggestion ? 'candidato'
            : !inEvents ? 'descartado'
              : curated?.decisao_base || row.decisao_base || 'candidato',
      alertDecision: isSplitParent ? 'historico' : rejectedByReview || duplicateByReview ? 'descartado'
        : curated?.decisao_alerta || row.decisao_alerta || '',
      alertReason: isSplitParent ? 'A edição inteira não gera alerta; cada ato é avaliado separadamente.'
        : rejectedByReview || duplicateByReview ? review.motivo
        : curated?.motivo_alerta || row.motivo_alerta || '',
      eventAt: curated?.data_fato || row.data_fato || '',
      eventMonth: curated?.mes_fato || row.mes_fato || '',
      originalPublishedAt: curated?.data_noticia_original || row.data_noticia_original || '',
      activeCandidate, pendingReview, rejectedEvent, legacyUnverified,
      decisionStatus: isSplitParent ? 'descartado'
        : stale || rejectedByReview || duplicateByReview || correctedOutOfBase ? 'descartado'
        : appliedReview?.decisao === 'confirmar_evento' ? 'confirmado'
          : rejectedEvent ? 'rejeitado' : legacyUnverified || recoveredSuggestion ? 'revisao' : pdfReassessment ? 'revisao'
            : decision?.status || (inEvents ? 'historico' : 'sem_evento'),
      reason, classificationReasons: ruleReclassified
        ? [row.situacao_analise.split('; ').at(-1)].filter(Boolean) : decision?.classificationReasons || [],
      reasonBasis: stale || rejectedByReview || ruleReclassified ? 'regra ou revisão atual'
        : pdfReassessment ? 'releitura automática do PDF' : decision?.reasonBasis || 'catálogo',
      stage: rejectedByReview || duplicateByReview ? appliedReview.etapa || ''
        : pdfReassessment ? pdfProof.stage : appliedReview?.etapa || curated?.etapa || row.etapa,
      analysis: inEvents ? curated.situacao_analise : stale ? 'triagem: ato antigo' : row.situacao_analise,
      documentType: curated?.tipo_documento || row.tipo_documento,
      evidence: pdfReassessment ? pdfProof.evidenceText : appliedReview?.evidencia || curated?.trecho || row.trecho,
      pdfEvidence,
      pdfEvidenceUrl: isAct ? row.url : recovered?.url_pdf || recovered?.url || '',
      pdfReassessment: Boolean(pdfReassessment),
      contentQuality: contentQuality(row.titulo, articleText?.texto || curated?.trecho || row.trecho),
      fullText: articleText?.texto || '', fullTextReader: articleText?.leitor || '',
      originalReading: articleText ? { url: articleText.url_artigo || row.article_url || row.url,
        recoveredAt: articleText.recuperado_em || '', reader: articleText.leitor || '',
        pdf: Boolean(articleText.pdf_sha256), excerpt: textPreview(articleText.texto) } : null,
      alternativeSources: dashboardAlternatives(row.id, alternativeTexts, appliedReview, auto),
      articleRecoveryReason: row.article_recovery_reason || '',
      articleAttempts: Number(row.article_attempts || 0),
      articleNextAttemptAt: row.article_next_attempt_at || '',
      articleDuplicateOf: row.article_duplicate_of || '',
      recoverySuggestion: !appliedReview && row.article_suggested_category ? {
        category: row.article_suggested_category,
        score: Number(row.article_suggested_score || 0),
        evidence: row.article_suggestion_evidence || '',
      } : null,
      sentAt: row.enviado_em, aiStatus: decision?.aiStatus || row.revisao_ia,
      previewOnly: Boolean(decision?.previewOnly),
      identityPending: !activeCandidate || appliedReview?.fatos?.identidade_nao_aplicavel || appliedReview?.fatos?.consorcio || hasVerifiedMultiConsortiumNames(appliedReview?.fatos, articleText?.texto)
        ? '' : pendingIds.get(row.id) || '',
      editorialReview: appliedReview ? {
        decision: appliedReview.decisao, reason: appliedReview.motivo,
        evidence: appliedReview.evidencia, evidenceUrl: appliedReview.fonte_evidencia || '',
        facts: appliedReview.fatos || {},
        relatedDocumentId: appliedReview.documento_relacionado || '',
      } : null,
      links: linkedByDocument.get(row.id) || [],
      runId: decision?.runId || '', observedCount: decision?.observedCount || null,
      ...(auto ? {
        automaticAlternativeReview: { status: auto.status, reason: auto.reason, evidence: auto.evidence || '',
          sourceUrl: auto.sourceUrl || '', sourceId: auto.sourceId || '', reviewedAt: auto.reviewedAt,
          relatedDocumentId: auto.relatedDocumentId || '' },
        baseDecision: auto.status === 'aceito' ? 'confirmado' : auto.status === 'pendente' ? 'candidato' : 'descartado',
        category: auto.status === 'aceito' ? auto.category : 'GERAL',
        score: auto.score || 0, stage: auto.stage || '', reason: auto.reason,
        analysis: `Triagem automática por regras e IA com fonte alternativa — ${auto.status}: ${auto.reason}`,
        baseStatus: auto.status === 'aceito' ? 'evento_confirmado_automatico' : 'arquivo_bruto',
        aiStatus: auto.status === 'aceito' ? 'approved' : auto.status === 'descartado' ? 'rejected' : '',
        reasonBasis: 'regras e IA com fonte alternativa', evidence: auto.evidence || '',
        contentQuality: auto.evidence ? 'trecho_disponivel' : contentQuality(row.titulo, row.trecho),
        decisionStatus: auto.status === 'pendente' ? 'revisao' : auto.status === 'aceito' ? 'confirmado' : 'descartado',
        activeCandidate: ['aceito', 'pendente'].includes(auto.status), pendingReview: auto.status === 'pendente',
        rejectedEvent: ['descartado', 'duplicata'].includes(auto.status), legacyUnverified: false,
        recoverySuggestion: null, pdfReassessment: false,
        alertDecision: auto.status === 'aceito' ? 'historico' : auto.status === 'pendente' ? 'previa' : 'descartado',
        alertReason: 'Decisão da base por texto recuperado; não libera envio nem reenvio.',
      } : {}),
    };
  }).map(item => {
    const row = archive.find(row => row.id === item.id);
    const stored = originalDecisions.get(item.id);
    if (!item.editorialReview && row && stored && !validOriginalTriage(row, stored)) Object.assign(item, {
      baseDecision:'processando',pendingReview:false,rejectedEvent:false,
      reason:'Revalidar automaticamente a prova após mudança do registro.',
      automaticOriginalReview:{...stored,status:'processando',reason:'Revalidar automaticamente a prova após mudança do registro.',checks:[]},
    });
    if (!item.editorialReview && row && validOriginalTriage(row, stored)) Object.assign(item, {
      baseDecision: stored.status, category: stored.status === 'descartado' ? 'GERAL' : stored.category,
      stage: stored.stage, reason: stored.reason, evidence: stored.evidence || item.evidence,
      contentQuality: stored.evidence ? 'trecho_disponivel' : item.contentQuality,
      pendingReview: stored.status === 'revisao', rejectedEvent: stored.status === 'descartado',
      decisionStatus: stored.status, automaticOriginalReview: stored,
      recoverySuggestion: null, pdfReassessment: false,
      alertDecision: item.sentAt ? 'enviado' : 'historico',
      alertReason: 'Lote histórico reavaliado; não autoriza envio ou reenvio.',
    });
    const liveTriage = row?.triagem_automatica ||
      (!['confirmado','descartado'].includes(row?.decisao_base) ? decisions[item.id]?.triage : null);
    if (!item.editorialReview && !item.automaticOriginalReview && !item.automaticAlternativeReview && liveTriage?.version >= 1) Object.assign(item, {
      baseDecision: liveTriage.status, category: liveTriage.category, stage: liveTriage.stage,
      reason: liveTriage.reason, evidence: liveTriage.evidence || item.evidence, automaticOriginalReview: liveTriage,
      contentQuality: liveTriage.evidence ? 'trecho_disponivel' : item.contentQuality,
      pendingReview: liveTriage.status === 'revisao', rejectedEvent: liveTriage.status === 'descartado',
      recoverySuggestion: null, pdfReassessment: false,
    });
    const curated = eventById.get(item.id);
    const automated = !item.editorialReview && !item.automaticAlternativeReview &&
      ['confirmado', 'revisao', 'descartado'].includes(curated?.decisao_base) && /pela triagem/.test(curated?.situacao_analise || '');
    if (automated && !item.automaticOriginalReview) Object.assign(item, {
      baseDecision: curated.decisao_base, pendingReview: curated.decisao_base === 'revisao',
      rejectedEvent: curated.decisao_base === 'descartado', decisionStatus: curated.decisao_base,
      category: curated.tipo_evento, reason: curated.situacao_analise,
      evidence: curated.evidencia_triagem || curated.trecho || item.evidence,
      stage: curated.etapa || item.stage, recoverySuggestion: null, pdfReassessment: false,
      reasonBasis: curated.metodo_triagem || 'triagem automática com evidência',
    });
    if (['confirmar_evento','corrigir_categoria'].includes(item.editorialReview?.decision)) item.baseDecision='confirmado';
    if (!['confirmado', 'descartado', 'revisao', 'processando'].includes(item.baseDecision)) {
      item.baseDecision = 'processando'; item.pendingReview = false;
      item.reason ||= 'Processamento automático ainda não concluiu a prova do ato; não exige revisão humana.';
    }
    item.pendingReview = item.baseDecision === 'revisao';
    item.categoryFamily = categoryGroup(item.category);
    item.categoryDisplay = categoryLabel(item.category);
    item.reviewChecks = item.baseDecision === 'revisao' ? item.automaticOriginalReview?.checks || reviewChecks(item.reason, item.category) : [];
    return item;
  }).sort(compareNewestDiscovery);
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
    ? items.filter((item) => !item.documentParentId && item.firstSeenAt > previousRun.at && item.firstSeenAt <= latestRun.at) : [];
  const primarySources = ['Google News', 'Querido Diário', 'Feeds RSS', 'Scrapers web', 'SAPL', 'CIGA'];
  const latestDay = brazilDay(latestRun?.at);
  const todayRuns = latestDay ? orderedRuns.filter((run) => brazilDay(run.at) === latestDay) : [];
  const todayNew = latestDay ? items.filter((item) => !item.documentParentId && brazilDay(item.firstSeenAt) === latestDay &&
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
  const itemById = new Map(items.map((item) => [item.id, item]));
  const geographicTables = baseTables.map((table) => {
    if (table.id === 'arquivo') return { ...table, rows: table.rows.map(row => itemById.get(row.id)?.splitPublication
      ? { ...row, decisao_base: 'descartado', situacao_analise: itemById.get(row.id).reason } : row) };
    if (table.id !== 'eventos') return table;
    const addedColumns = [
      { key: 'uf_criterio', label: 'Como a UF foi identificada', description: 'Origem da localização: catálogo, revisão editorial, título, domínio oficial, trecho ou revisão documental.' },
      { key: 'uf_evidencia', label: 'Evidência da UF', description: 'Texto que permitiu associar a publicação a uma ou mais unidades da Federação.' },
      { key: 'uf_fonte', label: 'Fonte da UF', description: 'Documento ou página consultada para determinar a localização.' },
    ];
    return { ...table, columns: [...table.columns, ...addedColumns], rows: table.rows.map((row) => {
      const item = itemById.get(row.id) || {};
      const reviewed = geographyReviews[row.id] || {};
      const geography = resolveGeography(row, item, reviewed);
      return { ...row, categoria_grupo: categoryGroup(row.tipo_evento), uf: geography.ufs.join('/'), uf_criterio: geography.basis,
        uf_evidencia: geography.evidence, uf_fonte: reviewed.source || item.url || row.url || '' };
    }) };
  });
  return {
    generatedAt,
    lastCollectionAt: collection?.at || items.reduce((latest, item) =>
      Date.parse(item.lastSeenAt) > Date.parse(latest || '1970-01-01') ? item.lastSeenAt : latest, ''),
    collection,
    disclaimer: 'O painel mostra documentos e hipóteses de eventos. Não comprova composição municipal ou efeito jurídico.',
    stats: {
      documents: archive.length, acts: acts.length, eventCandidates: items.filter((row) => row.activeCandidate).length,
      pendingReview: items.filter((row) => row.baseDecision === 'revisao').length,
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
      confirmed: items.filter((row) => row.baseDecision === 'confirmado').length,
      editoriallyDiscarded: items.filter((row) => row.editorialReview?.decision === 'nao_evento').length,
      duplicates: items.filter((row) => row.editorialReview?.decision === 'duplicata').length,
      categories, sources,
    },
    collectionHealth,
    sourceCatalog: dashboardSourceCatalog(sourceConfig),
    items,
    baseTables: geographicTables,
    geographyReviews,
    consortia: consortia.map((row) => ({
      id: row.id, name: row.nome, alias: row.sigla, cnpj: row.cnpj,
      documents: Number(row.documentos_vinculados || 0), status: row.situacao,
      aliases: row.aliases, sourceInitial: row.fonte_inicial,
      participations: participationsByConsortium.get(row.id) || [],
    })).sort((a, b) => b.documents - a.documents || a.name.localeCompare(b.name, 'pt-BR')),
  };
}

function redactPublicText(value) {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[e-mail omitido]')
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF omitido]')
    .replace(/\b\d{10,20}@g\.us\b/g, '[grupo omitido]');
}

function redactPublicValue(value) {
  if (typeof value === 'string') return redactPublicText(value);
  if (Array.isArray(value)) return value.map(redactPublicValue);
  if (value && typeof value === 'object') return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, redactPublicValue(entry)]));
  return value;
}

export function buildPublicDashboardData(data) {
  const publicData = redactPublicValue(data);
  publicData.public = true;
  publicData.items = publicData.items.map((item) => ({
    ...item,
    hasFullText: Boolean(item.fullText),
    fullText: '',
    alternativeSources: (item.alternativeSources || []).map((source) => ({
      ...source, hasFullText: Boolean(source.fullText), fullText: '',
    })),
  }));
  return publicData;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [archive, acts, events, consortia, links, pendingIdentity, editorialReviews, participations, pdfRecovery, articleTexts, alternativeTexts, alternativeDecisions] = await Promise.all([
    readNdjson('arquivo-coletas.ndjson'), readCsv('atos.csv'), readCsv('eventos.csv'), readCsv('consorcios.csv'),
    readCsv('vinculos-documentos.csv'), readCsv('identidade-pendente.csv'), readNdjson('revisoes-eventos.ndjson'),
    readCsv('participacoes.csv'),
    Promise.all([readNdjson('recuperacao-pdf.ndjson'), readNdjson('recuperacao-pdf-grandes.ndjson'),
      readNdjson('recuperacao-pdf-curada.ndjson'),
      readNdjson('recuperacao-pdf-google.ndjson').catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error))])
      .then(([standard, large, curated, google]) => [...standard, ...large.filter((row) => row.trechos?.length), ...curated, ...google]),
    readNdjson('textos-artigos.ndjson').catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error)),
    readNdjson('fontes-alternativas.ndjson').catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error)),
    readNdjson('triagem-fontes-alternativas.ndjson').catch((error) => error.code === 'ENOENT' ? [] : Promise.reject(error)),
  ]);
  const state = JSON.parse(await readFile(path.join(root, 'state', 'news-state.json'), 'utf8'));
  const [eventColumns, actColumns, consortiumColumns, participationColumns, linkColumns, pendingColumns] = await Promise.all(
    ['eventos.csv', 'atos.csv', 'consorcios.csv', 'participacoes.csv', 'vinculos-documentos.csv', 'identidade-pendente.csv']
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
  const geographyReviews = JSON.parse(await readFile(path.join(catalog, 'ufs-revisadas.json'), 'utf8'));
  const data = buildDashboardData({ archive, acts, events, consortia, links, pendingIdentity,
    editorialReviews, participations, pdfRecovery, articleTexts, alternativeTexts, alternativeDecisions, decisions, sourceHealth: state.health || {}, runs: state.runs || {},
    sourceConfig, geographyReviews, originalDecisions: await loadOriginalTriage(catalog),
    deliveryQueue: Object.values(state.pending || {}).map(entry=>entry.item).filter(Boolean),
    baseTables: [
      makeBaseTable('eventos', events, eventColumns),
      makeBaseTable('atos', acts, actColumns),
      makeBaseTable('consorcios', consortia, consortiumColumns),
      makeBaseTable('participacoes', participations, participationColumns),
      makeBaseTable('vinculos-documentos', links, linkColumns),
      makeBaseTable('identidade-pendente', pendingIdentity, pendingColumns),
      makeBaseTable('arquivo-coletas', archive),
      makeBaseTable('revisoes-eventos', editorialReviews),
    ] });
  const publicMode = process.argv.includes('--public');
  const outputData = publicMode ? buildPublicDashboardData(data) : data;
  await mkdir(destination, { recursive: true });
  await Promise.all(['index.html', 'style.css', 'redesign.css', 'registry.css', 'results.css', 'app.js', 'news-view.mjs', 'snapshot-loader.mjs', 'recovery-view.mjs', 'primary-evidence-view.mjs', 'triage-model.mjs', 'results-model.mjs', 'geography-model.mjs'].map((name) =>
    copyFile(path.join(root, 'dashboard', 'src', name), path.join(destination, name))));
  await writeFlowDiagrams(destination);
  await writeFile(path.join(destination,'noticias.csv'),newsCsv(outputData.items));
  const {manifest,files}=partitionDashboard(outputData);
  await mkdir(path.join(destination,'parts'),{recursive:true});
  await Promise.all([...files].map(([name,content])=>writeFile(path.join(destination,name),content,'utf8')));
  await Promise.all([
    writeFile(path.join(destination,'snapshot.json'),JSON.stringify(manifest)+'\n','utf8'),
    writeFile(path.join(destination, 'data.json'), `${JSON.stringify(outputData)}\n`, 'utf8'),
    writeFile(path.join(destination, 'version.json'), `${JSON.stringify({ generatedAt: outputData.generatedAt,
      lastCollectionAt: outputData.lastCollectionAt })}\n`, 'utf8'),
  ]);
  console.log(`[painel] ${data.stats.documents} documentos; ${data.stats.eventCandidates} eventos candidatos; ${data.stats.consortiaCandidates} identidades. Modo ${publicMode ? 'público' : 'local'} em ${destination}`);
}
