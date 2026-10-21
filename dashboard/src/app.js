import { triageBucket, pendingKinds, pendingLabels } from './triage-model.mjs';
import { buildResults } from './results-model.mjs';
import { recoveredSourcesView } from './recovery-view.mjs';
import { primaryEvidenceView } from './primary-evidence-view.mjs';
import {fetchSnapshot,hydrateTable} from './snapshot-loader.mjs';

const $ = (selector) => document.querySelector(selector);
const state = { data: null, view: 'overview', selectedItem: '', selectedOverviewItem: '', limit: 40,
  baseTableId: 'eventos', baseLimit: 25, baseRowIndex: 0, resultPeriod: 'all', resultMode: 'discovery' };
const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
const dateOnly = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'America/Sao_Paulo' });
const number = new Intl.NumberFormat('pt-BR');

function node(tag, className = '', value = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (value !== '') element.textContent = String(value);
  return element;
}
function date(value, time = false) {
  const parsed = new Date(value);
  return value && !Number.isNaN(parsed.getTime()) ? (time ? dateTime : dateOnly).format(parsed) : 'Não informada';
}
function formatCnpj(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 14
    ? digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '';
}
function publicationLabel(item) {
  return item.publishedYear ? `Ano do documento: ${item.publishedYear}` : `Publicado em: ${date(item.publishedAt)}`;
}
function safeUrl(value) {
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : ''; }
  catch { return ''; }
}
function hasRecoveredFullText(item) { return Boolean(item.fullText || item.hasFullText); }
function link(label, url) {
  const href = safeUrl(url);
  if (!href) return node('span', 'detail-copy', label);
  const anchor = node('a', 'detail-link', `${label} ↗`);
  anchor.href = href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
  return anchor;
}
function label(text) { return node('div', 'detail-label', text.toUpperCase()); }
function displayTitle(item) {
  return item.editorialReview && /^Diário Oficial de /i.test(item.title) && item.stage
    ? item.stage : item.title;
}
function sourceMessage(row) {
  if (/timeout|aborted due to timeout/i.test(row.message)) return 'A consulta demorou demais e expirou.';
  if (/\b503\b/.test(row.message)) return 'O site estava temporariamente indisponível (erro 503).';
  return row.message || 'A fonte respondeu parcialmente ou não entregou dados nesta coleta.';
}
function status(item) {
  if (item.baseDecision === 'confirmado') return ['Confirmada', 'event'];
  if (item.baseDecision === 'revisao') return ['Revisar comigo', 'wait'];
  if (item.baseDecision === 'descartado') return ['Rejeitada', 'raw'];
  if (item.automaticAlternativeReview) return item.automaticAlternativeReview.status === 'pendente'
    ? ['Fonte alternativa · conferir conflito', 'wait']
    : [item.baseDecision === 'confirmado' ? 'Aceito automaticamente · fonte alternativa' : 'Descartado automaticamente · fonte alternativa', item.baseDecision === 'confirmado' ? 'event' : 'raw'];
  if (item.baseDecision === 'desdobrado') return ['Edição · ver atos separados', 'raw'];
  if (item.editorialReview?.decision === 'confirmar_evento') return ['Conferido · aceito', 'event'];
  if (item.editorialReview?.decision === 'nao_evento') return ['Conferido · descartado', 'raw'];
  if (item.editorialReview?.decision === 'duplicata') return ['Conferido · duplicata', 'raw'];
  if (item.editorialReview?.decision === 'corrigir_categoria') return ['Conferido · corrigido', 'event'];
  if (item.rejectedEvent) return ['Rejeitado pela triagem', 'raw'];
  if (item.legacyUnverified) return ['Legado por verificar', 'wait'];
  if (item.articleDuplicateOf) return ['Mesmo texto de outra publicação', 'raw'];
  if (item.baseDecision === 'descartado' && item.recoverySuggestion) return ['Fora da base · nova pista', 'raw'];
  if (item.baseDecision === 'descartado' && item.decisionStatus === 'revisao') return ['Fora da base · revisar', 'raw'];
  if (item.recoverySuggestion) return ['Texto recuperado · revisar', 'wait'];
  if (item.baseStatus === 'arquivo_bruto' && item.contentQuality !== 'trecho_disponivel' && !item.pdfEvidence?.length && !hasRecoveredFullText(item))
    return ['Só título · sem conclusão', 'wait'];
  if (needsAttention(item)) return ['Precisa conferir', 'wait'];
  if (item.baseStatus === 'evento_candidato') return ['Possível achado', 'event'];
  return ['Fora da lista', 'raw'];
}
function readableReason(item) {
  if (item.automaticOriginalReview) return item.automaticOriginalReview.reason;
  if (item.automaticAlternativeReview) return item.automaticAlternativeReview.reason;
  if (item.baseDecision === 'desdobrado') return item.reason;
  if (item.editorialReview?.reason) return item.editorialReview.reason;
  if (item.baseDecision === 'confirmado') return item.reason || 'Confirmada pela triagem com evidência no documento original.';
  if (item.rejectedEvent) return item.reason || 'A triagem rejeitou este registro; ele permanece no histórico para consulta.';
  if (item.legacyUnverified) return 'Registro antigo ainda sem reconfirmação documental. O texto pode estar disponível, mas a decisão precisa de prova revisada.';
  if (item.pdfReassessment) return item.reason || 'A categoria foi reavaliada pelo PDF e precisa de conferência.';
  if (item.articleDuplicateOf) return 'O texto integral recuperado é idêntico ao de outra publicação já guardada. Não contar como um segundo achado.';
  if (item.recoverySuggestion) return 'A decisão da base não mudou. O texto recuperado sugeriu outro enquadramento, que ainda precisa ser conferido na fonte.';
  if (item.identityPending) return `O fato foi guardado, mas a identidade do consórcio ainda precisa de prova: ${item.identityPending}.`;
  if (item.decisionStatus === 'revisao') return item.reason || 'A revisão automática divergiu da decisão anterior; conferir o documento.';
  if (item.contentQuality !== 'trecho_disponivel' && !item.pdfEvidence?.length && item.baseStatus !== 'evento_candidato')
    return 'Ainda não há prova suficiente para aceitar ou descartar. É preciso obter a publicação integral ou outro documento oficial.';
  if (/ato antigo com data recente/i.test(item.reason)) return 'É um ato antigo que reapareceu em uma busca recente. Não é uma novidade.';
  if ((item.reason || '').startsWith('Rejeitado por revisão editorial')) return item.reason.replace('Rejeitado por revisão editorial — ', 'Uma revisão mostrou que ');
  if (item.baseStatus === 'evento_candidato') {
    if (item.category === 'PROPOSTA DE ADESÃO') return 'O texto fala de uma proposta. Ele não comprova que o município já entrou no consórcio.';
    if (item.category === 'ADESÃO AUTORIZADA') return 'Uma lei autorizou a entrada, mas ainda não comprova que ela aconteceu.';
    if (item.decisionStatus === 'previa') return 'Parece relevante, mas esta fonte ainda está em teste e o achado precisa ser conferido.';
    return 'O texto parece tratar de um acontecimento sobre consórcios. Foi guardado para consulta, mas ainda precisa de conferência.';
  }
  if (/recrutamento|concurso|processo seletivo/i.test(item.reason)) return 'É uma seleção de pessoal, não uma mudança importante na vida do consórcio.';
  if (/ata de pre[cç]os|contrata[cç][aã]o/i.test(item.reason)) return 'Trata de uma compra ou contratação, não de entrada de município no consórcio.';
  return 'O texto não mostrou um acontecimento sobre consórcios que deva entrar na lista principal.';
}
function deckItems() {
  const query = $('#deck-search').value.toLocaleLowerCase('pt-BR').trim();
  const filter = $('#deck-filter').value;
  const category = $('#deck-category').value;
  return state.data.items.filter((item) => (filter === 'all' || triageBucket(item) === filter ||
    pendingKinds.some((kind) => kind.key === filter && kind.matches(item))) &&
    (!category || item.categoryFamily === category) &&
    (!query || [item.title, item.source, item.stage, item.category,
      item.links.map((link) => link.name).join(' ')].join(' ').toLocaleLowerCase('pt-BR').includes(query)));
}
function openItem(item) {
  $('#status-filter').value = 'all';
  $('#search').value = '';
  state.limit = Math.max(40, state.data.items.findIndex((row) => row.id === item.id) + 1);
  state.selectedItem = item.id;
  switchView('feed', true);
}
function renderDeck() {
  const items = deckItems();
  const counts = { accepted: 0, rejected: 0, pending: 0 };
  for (const row of state.data.items) counts[triageBucket(row)] += 1;
  const rejectedDocuments = state.data.items.filter((row) => !row.documentParentId &&
    row.baseDecision !== 'desdobrado' && triageBucket(row) === 'rejected').length;
  $('#triage-summary').replaceChildren(...[
    [state.data.stats.documents, 'publicações arquivadas'],
    [counts.accepted, 'fatos confirmados'],
    [rejectedDocuments, 'publicações fora da base'],
    [counts.pending, 'Revisar comigo'],
  ].map(([value, title]) => {
    const box = node('div', 'summary-number');
    box.append(node('strong', '', number.format(value)), node('span', '', title)); return box;
  }));
  renderCollectionCompare();
  $('#pending-breakdown').replaceChildren(...[{ key: 'pending', title: 'Revisar comigo',
    description: 'Abra o caso para ver a fonte e o que precisa ser checado.', matches: item => triageBucket(item) === 'pending' }].map((kind) => {
    const count = state.data.items.filter(kind.matches).length;
    const button = node('button', 'pending-kind'); button.type = 'button';
    button.title = `${kind.title}: ${kind.description} Clique para ver os registros.`;
    button.append(node('strong', '', number.format(count)), node('span', '', kind.title),
      node('small', '', kind.description));
    button.addEventListener('click', () => { $('#deck-filter').value = kind.key;
      state.selectedOverviewItem = ''; $('#deck-stack').scrollTop = 0; renderDeck(); $('#decision-stage').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    return button;
  }));
  if (!items.some((item) => item.id === state.selectedOverviewItem)) state.selectedOverviewItem = items[0]?.id || '';
  const list = $('#deck-stack');
  const previousScroll = list.scrollTop;
  const listHead = node('div', 'overview-list-head', `${number.format(items.length)} ${items.length === 1 ? 'registro' : 'registros'} nesta seleção · mais recentes pela primeira coleta${state.data.stats.acts ? ` · inclui ${number.format(state.data.stats.acts)} atos separados` : ''}`);
  const rows = items.slice(0, 80).map((item) => {
    const bucket = triageBucket(item);
    const row = node('button', `overview-row ${bucket}${item.id === state.selectedOverviewItem ? ' active' : ''}`);
    row.type = 'button'; row.setAttribute('aria-pressed', String(item.id === state.selectedOverviewItem));
    row.title = readableReason(item);
    const body = node('span', 'overview-row-body');
    body.append(node('strong', '', displayTitle(item)), node('small', '', item.source || 'Fonte não informada'));
    const dates = node('span', 'overview-dates');
    dates.append(node('small', '', item.documentParentId ? 'Origem coletada em' : 'Coletado em'), node('time', '', date(item.firstSeenAt)),
      node('small', '', item.publishedYear ? 'Ano do documento' : 'Publicado em'), node('time', '', item.publishedYear || date(item.publishedAt)));
    row.append(dates, body,
      node('span', `overview-verdict ${bucket}`, item.baseDecision === 'desdobrado' ? 'Edição · ver atos' : bucket === 'accepted' ? 'Confirmada' : bucket === 'rejected' ? 'Rejeitada' : 'Revisar comigo'));
    row.addEventListener('click', () => {
      state.selectedOverviewItem = item.id; renderDeck();
      if (window.matchMedia('(max-width: 780px)').matches) $('#overview-detail').scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start',
      });
    });
    return row;
  });
  list.replaceChildren(listHead, ...rows);
  list.scrollTop = previousScroll;
  if (!items.length) list.append(node('p', 'empty', 'Nenhuma publicação corresponde à busca.'));
  if (items.length > 80) list.append(node('p', 'overview-more', 'Exibindo as 80 primeiras. Use a busca ou abra o arquivo completo para ver todas.'));
  renderOverviewDetail(items.find((item) => item.id === state.selectedOverviewItem));
}
function renderCollectionCompare() {
  const target = $('#collection-compare');
  const collection = state.data.collection;
  if (!collection) {
    target.replaceChildren(node('p', 'empty', 'Ainda não há uma execução registrada para separar os números da última coleta.'));
    return;
  }
  const day = node('section', 'collection-scope');
  day.append(node('span', 'collection-scope-label', `NO DIA ${date(collection.at)}`),
    node('strong', '', number.format(collection.today?.newDocuments || 0)),
    node('p', '', `documentos novos no arquivo, em ${number.format(collection.today?.runs || 0)} ${collection.today?.runs === 1 ? 'execução' : 'execuções'}.`));
  const run = node('section', 'collection-scope');
  run.append(node('span', 'collection-scope-label', `ÚLTIMA EXECUÇÃO · ${date(collection.at, true)}`),
    node('strong', '', number.format(collection.newDocuments)),
    node('p', '', `documentos novos entre ${number.format(collection.rawCollected)} resultados retornados pelas fontes.`));
  target.replaceChildren(day, run);
  target.append(node('p', 'collection-definition', 'Os quatro totais do acervo são históricos. “Resultado” pode repetir publicação conhecida; “documento novo” conta sua primeira entrada no arquivo.'));
}
function renderOverviewDetail(item) {
  const panel = $('#overview-detail');
  if (!item) { panel.replaceChildren(node('p', 'empty', 'Selecione uma publicação para ler a decisão.')); return; }
  const bucket = triageBucket(item);
  const decision = item.baseDecision === 'desdobrado' ? 'Edição · ver atos' : bucket === 'accepted' ? 'Confirmada' : bucket === 'rejected' ? 'Rejeitada' : 'Revisar comigo';
  const reasonTitle = item.baseDecision === 'desdobrado' ? 'O que esta edição contém' : bucket === 'accepted' ? 'Por que entrou' : bucket === 'rejected' ? 'Por que ficou fora' : 'O que falta para concluir';
  const rawEvidence = item.editorialReview?.evidence || item.automaticAlternativeReview?.evidence || item.pdfEvidence?.[0]?.text ||
    (item.contentQuality === 'trecho_disponivel' ? item.evidence : '');
  const evidence = /\.{10,}/.test(rawEvidence) && !item.editorialReview ? '' : rawEvidence;
  const evidenceTitle = item.automaticAlternativeReview ? 'Prova na fonte alternativa · regras e IA' : item.pdfEvidence?.length && !item.editorialReview ?
    `Trecho localizado · página ${item.pdfEvidence[0].page || 'não identificada'}` : 'Trecho ou informação disponível';
  const head = node('div', 'overview-detail-head');
  head.append(node('span', `overview-verdict ${bucket}`, decision), node('span', 'overview-id', item.id.slice(0, 8).toUpperCase()));
  const why = node('section', `overview-why ${bucket}`);
  why.append(node('h4', '', reasonTitle), node('p', '', readableReason(item)));
  const proof = node('section', 'overview-proof');
  proof.append(node('h4', '', evidenceTitle), node('blockquote', '', evidence || (rawEvidence
    ? 'O trecho coletado parece ser índice ou rodapé e não comprova o fato. Confira a fonte original.'
    : 'Nenhum trecho de prova foi recuperado para esta publicação. Confira a fonte original.')));
  const actions = node('div', 'overview-actions');
  actions.append(link(item.documentParentId ? 'Abrir ato oficial' : 'Abrir publicação original', item.url));
  if (item.documentParentId) {
    const parent = state.data.items.find(row => row.id === item.documentParentId);
    if (parent) {
      const original = node('button', 'detail-link', 'Ver notícia original preservada →');
      original.addEventListener('click', () => openItem(parent)); actions.append(original);
    }
  }
  if (item.editorialReview?.evidenceUrl) proof.append(link('Abrir fonte usada na decisão', item.editorialReview.evidenceUrl));
  if (item.automaticAlternativeReview?.sourceUrl) proof.append(link('Abrir fonte alternativa usada na decisão', item.automaticAlternativeReview.sourceUrl));
  const full = node('button', 'detail-link', 'Ver ficha completa →'); full.type = 'button';
  full.addEventListener('click', () => openItem(item)); actions.append(full);
  const back = node('button', 'detail-link overview-back', 'Voltar à lista ↑'); back.type = 'button';
  back.addEventListener('click', () => $('#deck-stack').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  actions.append(back);
  panel.replaceChildren(head, node('h3', '', displayTitle(item)),
    node('p', 'overview-source', item.source || 'Fonte não informada'),
    node('p', 'overview-date-summary', item.categoryDisplay || item.category),
    node('p', 'overview-date-summary', `${publicationLabel(item)} · ${item.documentParentId ? 'Coleta da publicação de origem' : 'Primeira coleta'}: ${date(item.firstSeenAt, true)}`),
    why, proof, actions);
  if (item.reviewChecks?.length) {
    const checks = node('div', 'overview-proof');
    checks.append(node('strong', '', 'O que você precisa checar'));
    for (const check of item.reviewChecks) checks.append(node('p', '', check));
    panel.append(checks);
  }
  const recovery = recoveredSourcesView(item, { document, date, compact: true });
  if (recovery) panel.append(recovery);
  const primary = primaryEvidenceView(item, {document});
  if (primary) panel.append(primary);
  const pending = item.automaticOriginalReview ? [] : pendingLabels(item);
  if (pending.length) panel.append(node('p', 'overview-caveat', `Também a conferir: ${pending.join(' · ')}.`));
  panel.append(node('p', 'overview-caveat', 'Só notícias confirmadas podem seguir para o WhatsApp, respeitando data, novidade e limites. Revisões do acervo não geram reenvio.'));
}
function renderOverview() { renderDeck(); }
function feedRow(item, index, selected, onClick) {
  const button = node('button', `feed-item${selected ? ' active' : ''}`); button.type = 'button';
  button.title = readableReason(item);
  const body = node('div'); const top = node('div', 'item-top');
  const [statusText, tone] = status(item);
  const bucket = triageBucket(item);
  top.append(node('span', `decision-flag ${bucket}`, item.baseDecision === 'desdobrado' ? 'Edição · ver atos' : bucket === 'accepted' ? 'Confirmada' : bucket === 'rejected' ? 'Fora da base' : 'Candidata'),
    node('span', 'item-date', `${item.documentParentId ? 'Origem coletada em' : 'Coletado em'} ${date(item.firstSeenAt)}`));
  const bottom = node('div', 'item-bottom');
  bottom.append(node('span', `status-dot ${tone}`), node('span', '', `${item.source || 'Origem não informada'} · ${statusText}`));
  body.append(top, node('strong', '', displayTitle(item)),
    node('small', 'publication-date', publicationLabel(item)), bottom);
  button.append(node('span', 'item-number', String(index + 1).padStart(2, '0')), body);
  button.addEventListener('click', onClick);
  return button;
}
function renderDetailedRecord(item, target) {
  const panel = $(target);
  if (!item) { panel.replaceChildren(node('p', 'empty', 'Selecione uma publicação para ver os detalhes.')); return; }
  const [statusText, tone] = status(item);
  const head = node('div', 'detail-kicker');
  head.append(node('span', '', item.documentParentId ? 'SOBRE ESTE ATO' : 'SOBRE ESTA PUBLICAÇÃO'),
    node('span', '', item.id.slice(0, 8).toUpperCase()));
  const decision = node('div', `decision-card ${tone}`);
  const verdict = item.baseDecision === 'desdobrado' ? 'PUBLICAÇÃO — DECISÕES NOS ATOS ABAIXO'
    : item.automaticAlternativeReview ? (item.baseDecision === 'confirmado' ? 'SIM — ACEITO POR REGRAS E IA COM FONTE ALTERNATIVA' : item.baseDecision === 'descartado' ? 'NÃO — FORA DA BASE, COM FONTE ALTERNATIVA' : 'EXCEÇÃO — LEITURAS SEM CONCORDÂNCIA SEGURA')
    : item.editorialReview?.decision === 'confirmar_evento' ? 'SIM — ACHADO CONFERIDO E ACEITO'
    : item.editorialReview?.decision === 'nao_evento' ? 'NÃO — DESCARTADO APÓS CONFERÊNCIA'
      : item.editorialReview?.decision === 'duplicata' ? 'NÃO — JÁ REPRESENTADO POR OUTRA PUBLICAÇÃO'
      : item.editorialReview?.decision === 'corrigir_categoria' ? 'SIM — CATEGORIA CORRIGIDA APÓS CONFERÊNCIA'
        : item.rejectedEvent ? 'NÃO — REJEITADO PELA TRIAGEM'
        : item.legacyUnverified ? 'PENDENTE — REGISTRO ANTIGO POR VERIFICAR'
        : item.pdfReassessment ? 'PRECISA CONFERIR — CATEGORIA REAVALIADA PELO PDF'
        : item.articleDuplicateOf ? 'NÃO — MESMO TEXTO DE OUTRA PUBLICAÇÃO'
        : item.recoverySuggestion ? 'PRECISA CONFERIR — TEXTO RECUPERADO SUGERE UM ACHADO'
        : item.baseStatus === 'evento_candidato' ? 'REVISAR COMIGO'
          : item.contentQuality !== 'trecho_disponivel' && !item.pdfEvidence?.length ? 'SEM CONCLUSÃO — TEXTO NÃO RECUPERADO'
            : 'NÃO — FICOU FORA DA LISTA PRINCIPAL';
  decision.append(node('b', '', verdict),
    node('p', '', readableReason(item)));
  const grid = node('div', 'detail-grid');
  const fields = [
    ['ASSUNTO', item.baseDecision === 'desdobrado' ? 'Edição com atos separados' : item.rejectedEvent ? 'Não classificado como achado'
      : item.baseStatus === 'evento_candidato' || item.baseDecision === 'confirmado' ? (item.categoryDisplay || item.category) : 'Não classificado como achado'],
    ['BASE', item.baseDecision === 'desdobrado' ? 'Decisão por ato' : item.baseDecision === 'confirmado' ? 'Fato confirmado' : item.baseDecision === 'descartado'
      ? 'Fora da base de eventos' : 'Revisar comigo'],
    ...(item.actPage ? [['PÁGINA DO ATO', String(item.actPage)]] : []),
    ['ALERTA', item.automaticAlternativeReview ? 'Recuperação para a base — não libera envio' : item.alertDecision === 'historico' ? 'Não enviar — fato antigo'
      : item.alertDecision === 'enviado' ? item.baseDecision === 'descartado'
        ? 'Enviado antes da correção' : 'Já enviado'
        : item.alertDecision === 'elegivel' ? 'Pode ser avaliado para envio'
          : item.alertDecision === 'previa' ? 'Fonte em teste — não enviar'
          : item.alertDecision === 'data_inconsistente' ? 'Data precisa de conferência'
            : item.alertDecision === 'data_nao_verificada' ? 'Data original não verificada'
            : item.alertDecision === 'descartado' ? 'Não enviar' : 'Ainda sem decisão'],
    ...(item.stage && displayTitle(item) !== item.stage ? [['ETAPA COMPROVADA', item.stage]] : []),
    ...(item.eventAt ? [['DATA DO FATO', date(item.eventAt)]] : []),
    ...(item.eventMonth ? [['MÊS DO FATO', item.eventMonth.slice(5) + '/' + item.eventMonth.slice(0, 4)]] : []),
    ...(item.originalPublishedAt ? [['DATA NA FONTE ORIGINAL', date(item.originalPublishedAt)]] : []),
    [item.publishedYear ? 'ANO DO DOCUMENTO' : item.publishedDateSource === 'url_edicao' ? 'DATA DA EDIÇÃO' : 'PUBLICADO EM', item.publishedYear || date(item.publishedAt)],
    ['PRIMEIRA COLETA', date(item.firstSeenAt, true)],
    ['ENCONTRADO PELA ÚLTIMA VEZ', date(item.lastSeenAt, true)],
    ['WHATSAPP', item.sentAt ? `Enviado em ${date(item.sentAt, true)}` : 'Não foi enviado'],
  ];
  for (const [name, value] of fields) {
    const field = node('div'); field.append(node('span', '', name), node('strong', '', value)); grid.append(field);
  }
  panel.replaceChildren(head, node('h3', 'detail-head', displayTitle(item)),
    node('div', 'detail-meta', `${item.source || 'Fonte não informada'}${displayTitle(item) !== item.title ? ` · ${item.title}` : ''}`),
    decision, grid);
  if (item.relatedActs?.length) {
    panel.append(label('Atos individualizados nesta publicação'));
    for (const act of item.relatedActs) {
      const button = node('button', 'detail-link', `Pág. ${act.page} · ${act.title}${act.decision === 'confirmado' ? ' · aceito' : act.decision === 'descartado' ? ' · descartado' : ''} →`);
      button.type = 'button';
      button.addEventListener('click', () => {
        $('#status-filter').value = 'all'; state.selectedItem = act.id; renderFeed();
      });
      panel.append(button);
    }
  }
  if (item.alertReason && item.alertDecision !== 'enviado') panel.append(label('Por que essa decisão de alerta?'),
    node('p', 'detail-copy', item.alertReason));
  if (item.editorialReview) {
    const facts = Object.entries(item.editorialReview.facts || {});
    if (facts.length) {
      panel.append(label('Informações confirmadas e limites'));
      for (const [key, value] of facts) {
        const field = node('div', 'identity-row');
        field.append(node('small', '', key.replaceAll('_', ' ').toUpperCase()),
          node('strong', '', Array.isArray(value) ? value.join(', ') : value));
        panel.append(field);
      }
    }
    panel.append(label('Evidência usada na conferência'), node('p', 'detail-copy evidence', item.editorialReview.evidence));
    if (item.editorialReview.evidenceUrl) panel.append(link('Abrir documento usado na conferência', item.editorialReview.evidenceUrl));
    if (item.editorialReview.relatedDocumentId) {
      const related = state.data.items.find((row) => row.id === item.editorialReview.relatedDocumentId);
      if (related) {
        const button = node('button', 'detail-link', `Ver publicação vinculada: ${related.title} →`);
        button.type = 'button';
        button.addEventListener('click', () => { state.selectedItem = related.id; renderFeed(); });
        panel.append(button);
      }
    }
  }
  if (item.contentQuality !== 'trecho_disponivel' && !item.editorialReview) {
    const warning = node('div', 'content-warning');
    warning.append(node('strong', '', item.pdfEvidence?.length ? 'Trechos recuperados do PDF' : item.contentQuality === 'sem_trecho' ? 'Nenhum trecho foi coletado' : 'Só o título foi coletado'),
      node('p', '', item.pdfEvidence?.length ? 'Abaixo estão os trechos localizados por página; o documento integral precisa ser conferido na fonte.' : 'O texto integral não está nesta base. Abra a publicação original para avaliar o conteúdo.'));
    panel.append(warning);
  }
  if (item.recoverySuggestion) {
    const suggestion = node('div', 'content-warning');
    suggestion.append(node('strong', '', `Sugestão para conferir: ${item.recoverySuggestion.category}`),
      node('p', '', item.recoverySuggestion.evidence || 'Leia o texto integral antes de decidir.'));
    panel.append(suggestion);
  }
  if (item.fullText && !item.editorialReview) {
    const full = node('details', 'technical-details');
    full.append(node('summary', '', 'Ler texto integral recuperado'),
      node('p', 'detail-copy evidence', item.fullText));
    panel.append(full);
  } else if (item.hasFullText && !item.editorialReview) {
    panel.append(node('p', 'detail-copy', 'O texto integral foi recuperado para a triagem, mas não é republicado nesta página. Consulte a fonte original.'));
  }
  if (item.articleDuplicateOf) {
    const original = state.data.items.find((row) => row.id === item.articleDuplicateOf);
    if (original) {
      const button = node('button', 'detail-link', `Ver primeira publicação com o mesmo texto: ${original.title} →`);
      button.type = 'button';
      button.addEventListener('click', () => { $('#status-filter').value = 'raw'; state.selectedItem = original.id; renderFeed(); });
      panel.append(button);
    }
  }
  if (item.identityPending) {
    panel.append(label('O que falta conferir?'), node('p', 'detail-copy', 'Ainda não identificamos com segurança qual consórcio este documento menciona.'));
  }
  if (item.links.length) {
    panel.append(label(item.links.length === 1 ? 'Consórcio citado' : 'Consórcios citados neste documento'));
    for (const binding of item.links) {
      const row = node('div', 'identity-row');
      row.append(node('strong', '', binding.name || 'Consórcio mencionado'),
        node('small', '', binding.evidence || 'O documento menciona este consórcio; isso não confirma quem participa dele.'));
      if (binding.evidenceUrl && binding.evidenceUrl !== item.url) row.append(link('Conferir fonte do vínculo', binding.evidenceUrl));
      panel.append(row);
    }
  }
  // A revisão editorial traz a evidência conferida; o excerto histórico pode
  // conter menu, rodapé ou um corte antigo e não deve competir com ela.
  if (!item.editorialReview && item.evidence && item.contentQuality === 'trecho_disponivel') {
    panel.append(label('Trecho disponível (não é o texto integral)'), node('p', 'detail-copy evidence', item.evidence));
  }
  if (item.pdfEvidence?.length) {
    panel.append(label('Trechos localizados no PDF'));
    for (const snippet of item.pdfEvidence) {
      const location = `Página ${snippet.page || 'não identificada'}${snippet.column ? ` · ${snippet.column}` : ''}`;
      panel.append(node('small', 'detail-meta', location), node('p', 'detail-copy evidence', snippet.text));
    }
    if (item.pdfEvidenceUrl) panel.append(link('Abrir PDF para conferir a página', item.pdfEvidenceUrl));
  }
  panel.append(link('ABRIR PUBLICAÇÃO ORIGINAL', item.url));
  const technical = node('details', 'technical-details');
  technical.append(node('summary', '', 'Ver detalhes da análise'));
  technical.append(label('Motivo registrado'), node('p', 'detail-copy', item.reason));
  if (item.reasonBasis === 'recalculado com as regras atuais') technical.append(node('p', 'detail-copy', 'Este motivo foi reconstruído com as regras atuais; a decisão original daquela rodada não foi guardada individualmente.'));
  if (item.identityPending) technical.append(label('Identificação do consórcio'), node('p', 'detail-copy', item.identityPending));
  if (item.articleRecoveryReason) technical.append(label('Última falha ao recuperar texto'),
    node('p', 'detail-copy', `${item.articleRecoveryReason} · ${item.articleAttempts || 0} tentativa(s)`));
  if (item.classificationReasons.length) {
    technical.append(label('Sinais usados pelo robô'));
    const list = node('ul', 'reason-list');
    for (const reason of item.classificationReasons) list.append(node('li', '', reason));
    technical.append(list);
  }
  technical.append(label('Situação da análise'), node('p', 'detail-copy', item.analysis || 'Ainda não conferido manualmente.'));
  if (item.runId) technical.append(label('Última coleta'), node('p', 'detail-copy', `Rodada ${item.runId}; visto ${item.observedCount || 1} vez(es) recentemente.`));
  panel.append(technical);
}
function detail(item, target) {
  const panel = $(target);
  if (!item) { panel.replaceChildren(node('p', 'empty', 'Selecione uma publicação para ler a decisão.')); return; }
  const bucket = triageBucket(item);
  const verdict = item.baseDecision === 'desdobrado' ? 'Edição com atos separados' : bucket === 'accepted' ? 'Entrou na base' : bucket === 'rejected' ? 'Ficou fora da base' : 'Exceção: conferir';
  const intro = node('div', 'readable-intro');
  intro.append(node('span', `overview-verdict ${bucket}`, verdict), node('small', '', `Registro ${item.id.slice(0, 8).toUpperCase()}`));
  const decision = node('section', `readable-decision ${bucket}`);
  decision.append(node('h4', '', 'Por quê?'), node('p', '', readableReason(item)));
  const rawProof = item.editorialReview?.evidence || item.automaticAlternativeReview?.evidence || item.pdfEvidence?.[0]?.text ||
    (item.contentQuality === 'trecho_disponivel' ? item.evidence : '');
  const usableProof = /\.{10,}/.test(rawProof) && !item.editorialReview ? '' : rawProof;
  const proof = node('section', 'readable-proof');
  const location = item.pdfEvidence?.length && !item.editorialReview ?
    ` · página ${item.pdfEvidence[0].page || 'não identificada'}` : '';
  const proofTitle = item.automaticAlternativeReview ? 'Prova na fonte alternativa · regras e IA' : item.baseDecision === 'desdobrado' ? 'Trecho histórico da coleta; veja cada ato abaixo' : item.editorialReview ? 'Trecho usado na conferência' :
    bucket === 'rejected' ? `Trecho coletado — não prova o fato por si só${location}` : `Trecho disponível${location}`;
  const proofPreview = usableProof && !item.editorialReview && usableProof.length > 400
    ? `${usableProof.slice(0, 400).trimEnd()}…` : usableProof;
  proof.append(node('h4', '', proofTitle), node('blockquote', '', proofPreview || (rawProof
    ? 'O trecho coletado parece ser índice ou rodapé. Ele não comprova o fato; confira a fonte original.'
    : 'Não há trecho suficiente guardado. A publicação original precisa ser conferida.')));
  const alert = node('section', 'readable-alert');
  const alertText = item.sentAt ? item.baseDecision === 'descartado'
    ? `Enviado ao WhatsApp em ${date(item.sentAt, true)}, antes da correção. Hoje está fora da base de eventos.`
    : `Enviado ao WhatsApp em ${date(item.sentAt, true)}.`
    : item.baseDecision === 'desdobrado' ? 'A edição inteira não gera alerta; cada ato é avaliado separadamente.'
      : item.alertDecision === 'historico' ? `Não enviado: ${item.alertReason || 'é um fato histórico, não uma novidade da coleta.'}`
      : item.alertDecision === 'elegivel' ? 'Pode ser considerado para o WhatsApp após as verificações do envio.'
        : item.alertDecision === 'previa' ? 'Fonte em teste; não será enviado automaticamente.'
        : item.alertDecision === 'descartado' ? 'Não será enviado ao WhatsApp.'
          : 'O envio ao WhatsApp ainda depende de verificação.';
  alert.append(node('h4', '', 'E o WhatsApp?'), node('p', '', alertText));
  if (item.alertReason && !item.sentAt && item.alertDecision !== 'historico') alert.append(node('small', '', item.alertReason));
  const actions = node('div', 'readable-actions');
  actions.append(link(item.documentParentId ? 'Abrir ato oficial' : 'Abrir publicação original', item.url));
  if (item.documentParentId) {
    const parent = state.data.items.find(row => row.id === item.documentParentId);
    if (parent) {
      const original = node('button', 'detail-link', 'Ver notícia original preservada →');
      original.addEventListener('click', () => openItem(parent)); actions.append(original);
    }
  }
  if (item.editorialReview?.evidenceUrl) proof.append(link('Abrir fonte usada na decisão', item.editorialReview.evidenceUrl));
  if (item.automaticAlternativeReview?.sourceUrl) proof.append(link('Abrir fonte alternativa usada na decisão', item.automaticAlternativeReview.sourceUrl));
  let siblings = null;
  if (item.relatedActs?.length) {
    siblings = node('section', 'readable-proof');
    siblings.append(node('h4', '', 'Atos nesta publicação'));
    for (const act of item.relatedActs) {
      const button = node('button', 'detail-link', `Página ${act.page}: ${act.title} →`);
      button.type = 'button'; button.addEventListener('click', () => {
        $('#status-filter').value = 'all'; state.selectedItem = act.id; renderFeed();
      });
      siblings.append(button);
    }
  }
  const back = node('button', 'detail-link readable-back', 'Voltar à lista ↑'); back.type = 'button';
  back.addEventListener('click', () => $('#feed-list').scrollIntoView({ behavior: 'smooth', block: 'start' }));
  actions.append(back);
  const full = node('details', 'record-more');
  full.append(node('summary', '', 'Ver todas as datas, vínculos e detalhes da análise'));
  const fullBody = node('div'); fullBody.id = 'detail-full-record'; full.append(fullBody);
  panel.replaceChildren(intro, node('h3', 'detail-head', displayTitle(item)),
    node('p', 'readable-meta', item.source || 'Fonte não informada'),
    node('p', 'overview-date-summary', `${publicationLabel(item)} · ${item.documentParentId ? 'Coleta da publicação de origem' : 'Primeira coleta'}: ${date(item.firstSeenAt, true)}`),
    decision, proof, alert, ...(siblings ? [siblings] : []), actions,
    ...[primaryEvidenceView(item, {document}), recoveredSourcesView(item, { document, date })].filter(Boolean), full);
  renderDetailedRecord(item, '#detail-full-record');
  for (const selector of ['.detail-kicker', '.detail-head', '.detail-meta', '.decision-card']) {
    fullBody.querySelector(selector)?.remove();
  }
}
function filteredFeed() {
  const query = $('#search').value.toLocaleLowerCase('pt-BR').trim();
  const filter = $('#status-filter').value;
  return state.data.items.filter((item) => {
    if (filter === 'event' && triageBucket(item) !== 'pending') return false;
    if (filter === 'confirmed' && triageBucket(item) !== 'accepted') return false;
    if (filter === 'editorially-discarded' && triageBucket(item) !== 'rejected') return false;
    if (filter === 'auto-rejected' && !item.rejectedEvent) return false;
    if (filter === 'legacy' && !item.legacyUnverified) return false;
    if (filter === 'raw' && item.baseStatus !== 'arquivo_bruto') return false;
    if (filter === 'sent' && !item.sentAt) return false;
    if (filter === 'pending' && !needsAttention(item)) return false;
    if (filter === 'incomplete' && (!needsAttention(item) || item.contentQuality === 'trecho_disponivel' || item.pdfEvidence?.length || hasRecoveredFullText(item))) return false;
    return !query || [item.title, item.stage, item.source, item.category,
      item.links.map((row) => row.name).join(' '), Object.values(item.editorialReview?.facts || {}).join(' ')]
      .join(' ').toLocaleLowerCase('pt-BR').includes(query);
  });
}
function needsAttention(item) {
  if (item.editorialReview && item.editorialReview.decision !== 'corrigir_categoria') return false;
  return Boolean(item.identityPending || ['fila', 'previa', 'revisao'].includes(item.decisionStatus) ||
    item.recoverySuggestion ||
    (item.baseStatus === 'arquivo_bruto' && item.contentQuality !== 'trecho_disponivel' && !item.pdfEvidence?.length && !hasRecoveredFullText(item)));
}
function renderFeed() {
  const items = filteredFeed();
  $('#result-count').textContent = `${number.format(items.length)} ${items.length === 1 ? 'REGISTRO' : 'REGISTROS'}`;
  const visible = items.slice(0, state.limit);
  if (!visible.some((item) => item.id === state.selectedItem)) state.selectedItem = visible[0]?.id || '';
  $('#feed-list').replaceChildren(...visible.map((item, index) => feedRow(item, index, item.id === state.selectedItem, () => {
    state.selectedItem = item.id; renderFeed();
    if (window.matchMedia('(max-width: 780px)').matches) $('#detail').scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start',
    });
  })));
  if (!visible.length) $('#feed-list').append(node('p', 'empty', 'Nenhuma publicação corresponde à busca.'));
  $('#more-button').hidden = visible.length >= items.length;
  detail(visible.find((item) => item.id === state.selectedItem), '#detail');
}
function renderConsortia() {
  const query = $('#consortium-search').value.toLocaleLowerCase('pt-BR').trim();
  const rows = state.data.consortia.filter((row) => !query || [row.name, row.alias, row.cnpj, row.aliases]
    .join(' ').toLocaleLowerCase('pt-BR').includes(query));
  $('#consortium-count').textContent = `${number.format(rows.length)} ${rows.length === 1 ? 'CONSÓRCIO' : 'CONSÓRCIOS'}`;
  if (!rows.some((row) => row.id === state.selectedConsortium)) state.selectedConsortium = rows[0]?.id || '';
  $('#consortium-list').replaceChildren(...rows.map((row, index) => {
    const button = node('button', `feed-item${row.id === state.selectedConsortium ? ' active' : ''}`);
    button.type = 'button';
    const body = node('div'); const top = node('div', 'item-top');
    top.append(node('span', 'item-tag', row.alias || 'NOME ENCONTRADO'),
      node('span', 'item-date', `${row.documents} ${row.documents === 1 ? 'PUBLICAÇÃO' : 'PUBLICAÇÕES'}`));
    const bottom = node('div', 'item-bottom'); bottom.append(node('span', 'status-dot event'),
      node('span', '', formatCnpj(row.cnpj) || 'CNPJ não associado com segurança'));
    body.append(top, node('strong', '', row.name), bottom);
    button.append(node('span', 'item-number', String(index + 1).padStart(2, '0')), body);
    button.addEventListener('click', () => { state.selectedConsortium = row.id; renderConsortia(); });
    return button;
  }));
  if (!rows.length) $('#consortium-list').append(node('p', 'empty', 'Nenhum consórcio corresponde à busca.'));
  const row = rows.find((item) => item.id === state.selectedConsortium);
  const panel = $('#consortium-detail');
  if (!row) { panel.replaceChildren(node('p', 'empty', 'Selecione um consórcio para ver as publicações.')); return; }
  panel.replaceChildren(node('div', 'detail-kicker', 'SOBRE ESTE CONSÓRCIO'),
    node('h3', 'detail-head', row.name), node('div', 'detail-meta', row.alias || 'Sigla não identificada'));
  const box = node('div', 'decision-card');
  box.append(node('b', '', `CITADO EM ${row.documents} ${row.documents === 1 ? 'PUBLICAÇÃO' : 'PUBLICAÇÕES'}`),
    node('p', '', 'Encontrar o nome não confirma quais municípios fazem parte dele hoje.'));
  panel.append(box, label('CNPJ do consórcio'), node('p', 'detail-copy', formatCnpj(row.cnpj) || 'Ainda não associado com segurança.'),
    node('p', 'detail-copy', row.cnpj ? 'Identificador extraído do acervo; confira a fonte antes de usar em cruzamentos.' : 'A busca por CNPJ em atos oficiais e na base CNM ainda está pendente.'),
    label('Outros nomes encontrados'), node('p', 'detail-copy', row.aliases || 'Nenhum registrado.'));
  if (row.sourceInitial) panel.append(label('Primeira fonte que citou o consórcio'), link('Abrir publicação original', row.sourceInitial));
  if (row.participations?.length) {
    panel.append(label('Municípios com participação documentada'));
    for (const participation of row.participations) {
      const entry = node('div', 'identity-row');
      entry.append(node('strong', '', participation.municipio),
        node('small', '', `Ano de ingresso: ${participation.ano_ingresso || 'não identificado'} · Última evidência de participação: ${participation.ano_ultima_evidencia_participacao}`),
        link('Ver documento comprobatório', participation.fonte_ultima_evidencia));
      panel.append(entry);
    }
    panel.append(node('p', 'detail-copy', 'O ano da evidência não é, necessariamente, o ano em que o município entrou no consórcio.'));
  }
  const docs = state.data.items.filter((item) => item.links.some((binding) => binding.consortiumId === row.id))
    .sort((a, b) => (b.publishedAt || b.firstSeenAt).localeCompare(a.publishedAt || a.firstSeenAt));
  panel.append(label(`Linha do tempo documental (${docs.length})`));
  for (const item of docs) {
    const entry = node('div', 'identity-row');
    entry.append(node('strong', '', `${item.publishedYear || (item.publishedAt ? date(item.publishedAt) : `Coletado em ${date(item.firstSeenAt)}`)} · ${item.category}`),
      node('small', '', `${item.activeCandidate ? 'Achado na lista' : item.rejectedEvent ? 'Rejeitado' : item.legacyUnverified ? 'Legado pendente' : 'Arquivo bruto'} · ${item.source || 'Fonte não informada'}`),
      link(item.title, item.url));
    panel.append(entry);
  }
}
function tableValue(value) {
  if (value === null || value === undefined || value === '') return 'Não informado';
  if (Array.isArray(value)) return value.length ? value.join(', ') : 'Não informado';
  if (typeof value === 'object') return Object.keys(value).length ? JSON.stringify(value, null, 2) : 'Não informado';
  return String(value);
}
function currentTable() {
  return (state.data.baseTables || []).find((table) => table.id === state.baseTableId) || state.data.baseTables?.[0];
}
function filteredBaseRows(table) {
  const query = $('#base-search').value.toLocaleLowerCase('pt-BR').trim();
  return !query ? table.rows : table.rows.filter((row) =>
    table.columns.some(({ key }) => tableValue(row[key]).toLocaleLowerCase('pt-BR').includes(query)));
}
function renderBasePreview(table, row) {
  const target = $('#base-preview'); target.replaceChildren();
  if (!row) { target.append(node('p', 'empty', 'Selecione uma linha para examinar todos os campos.')); return; }
  const title = tableValue(row.titulo || row.nome || row.consorcio || row.municipio || row.id || row.documento_id);
  target.append(node('h3', '', title), node('p', 'preview-help', `Linha ${state.baseRowIndex + 1} · ${table.title}. Todos os campos da tabela aparecem abaixo, inclusive os vazios.`));
  for (const column of table.columns) {
    const field = node('div', 'base-field');
    const value = tableValue(row[column.key]);
    field.append(node('span', 'base-field-name', column.label), node('small', 'base-field-description', column.description));
    if (safeUrl(value) && /^(?:url|fonte_|article_url)/.test(column.key)) field.append(link('Abrir fonte', value));
    else field.append(node('strong', value === 'Não informado' ? 'missing-value' : '', value));
    target.append(field);
  }
}
const loadingTables=new WeakSet();
async function renderBase() {
  const tables = state.data.baseTables || [];
  $('#base-tabs').replaceChildren(...tables.map((table) => {
    const button = node('button', table.id === state.baseTableId ? 'base-tab active' : 'base-tab',
      `${table.title}  ${number.format(table.rowCount ?? table.rows.length)}`);
    button.type = 'button'; button.setAttribute('role', 'tab');
    button.setAttribute('aria-selected', table.id === state.baseTableId ? 'true' : 'false');
    button.addEventListener('click', () => { state.baseTableId = table.id; state.baseLimit = 25;
      state.baseRowIndex = 0; $('#base-search').value = ''; renderBase(); });
    return button;
  }));
  const table = currentTable();
  if (!table) return;
  if(table.rowParts&&!table.rowsLoaded){
    $('#base-table-title').textContent=table.title;
    $('#base-table-count').textContent=`${number.format(table.rowCount)} LINHAS · carregando`;
    $('#base-preview').replaceChildren(node('p','empty','Carregando a tabela completa…'));
    $('#base-table tbody').replaceChildren();
    if(loadingTables.has(table))return;
    loadingTables.add(table);const snapshot=state.data;
    try{
      const loaded=await hydrateTable(table,snapshot.generatedAt);
      if(state.data!==snapshot)return;
      snapshot.baseTables=snapshot.baseTables.map(row=>row===table?loaded:row);
      if(state.view==='base')renderBase();
    }catch(error){
      if(state.data===snapshot&&currentTable()===table){
        const retry=node('button','detail-link','Tentar carregar novamente');
        retry.addEventListener('click',()=>renderBase());
        $('#base-preview').replaceChildren(node('p','empty','Não foi possível carregar a tabela. Seus dados não foram apagados.'),retry);
      }
      console.warn('Falha ao carregar tabela:',error);
    }finally{loadingTables.delete(table);}
    return;
  }
  const rows = filteredBaseRows(table);
  state.baseRowIndex = Math.min(state.baseRowIndex, Math.max(0, rows.length - 1));
  $('#base-table-title').textContent = table.title;
  $('#base-table-description').textContent = table.description;
  $('#base-table-count').textContent = `${number.format(table.rows.length)} LINHAS · ${number.format(table.columns.length)} COLUNAS`;
  const previewColumns = table.columns.slice(0, 3);
  const head = $('#base-table thead'); const header = node('tr');
  for (const column of previewColumns) {
    const cell = node('th', '', column.label); cell.title = column.description; cell.scope = 'col'; header.append(cell);
  }
  head.replaceChildren(header);
  const visible = rows.slice(0, state.baseLimit);
  const body = $('#base-table tbody'); body.replaceChildren(...visible.map((row, index) => {
    const entry = node('tr', index === state.baseRowIndex ? 'active' : '');
    entry.tabIndex = 0; entry.setAttribute('aria-label', `Abrir linha ${index + 1} de ${table.title}`);
    const selectRow = () => { state.baseRowIndex = index; renderBase();
      if (window.matchMedia('(max-width:1170px)').matches) $('#base-preview').scrollIntoView({ behavior: 'smooth', block: 'start' }); };
    entry.addEventListener('click', selectRow);
    entry.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); selectRow(); } });
    for (const column of previewColumns) {
      const value = tableValue(row[column.key]);
      const cell = node('td', value === 'Não informado' ? 'missing-value' : '', value);
      cell.title = value; entry.append(cell);
    }
    return entry;
  }));
  if (!visible.length) { const empty = node('tr'); const cell = node('td', 'empty', 'Nenhuma linha corresponde à busca.');
    cell.colSpan = previewColumns.length || 1; empty.append(cell); body.append(empty); }
  $('#base-range').textContent = `MOSTRANDO ${number.format(visible.length)} DE ${number.format(rows.length)} LINHAS`;
  $('#base-more').hidden = visible.length >= rows.length;
  renderBasePreview(table, rows[state.baseRowIndex]);
  $('#glossary-count').textContent = `(${table.columns.length})`;
  $('#base-glossary').replaceChildren(...table.columns.map((column) => {
    const card = node('div', 'glossary-entry');
    card.append(node('strong', '', column.label), node('p', '', column.description)); return card;
  }));
}
function renderMethod() {
  const catalog = state.data.sourceCatalog || [];
  const familyCountNames = { 'Google Notícias': 'Google News', 'Querido Diário': 'Querido Diário',
    'Feeds RSS': 'Feeds RSS', 'Portais e diários': 'Scrapers web', 'Câmaras (SAPL)': 'SAPL', CIGA: 'CIGA' };
  const groups = [...new Set(catalog.map((row) => row.family))];
  const sourceTarget = $('#source-catalog');
  sourceTarget.replaceChildren(...groups.map((family) => {
    const rows = catalog.filter((row) => row.family === family);
    const count = state.data.collection?.sources?.find((row) => row.name === familyCountNames[family])?.count;
    const group = node('section', 'source-family');
    group.append(node('h3', '', family), node('p', 'source-family-count',
      `${rows.filter((row) => row.enabled).length} ${rows.filter((row) => row.enabled).length === 1 ? 'fonte ativa' : 'fontes ativas'}${count === undefined ? '' : ` · ${number.format(count)} resultados na última execução`}`));
    const list = node('ul', 'source-list');
    for (const row of rows) {
      const entry = node('li', row.enabled ? 'source-active' : 'source-disabled');
      const name = safeUrl(row.url) ? link(row.name, row.url) : node('strong', '', row.name);
      entry.append(name, node('span', 'source-mode', row.enabled ? row.mode : 'Desativada'));
      if (row.fallback) entry.append(node('small', '', `Cobertura alternativa: ${row.fallback}`));
      list.append(entry);
    }
    group.append(list); return group;
  }));
  if (groups.length) sourceTarget.prepend(node('p', 'source-overall',
    `${number.format(catalog.filter((row) => row.enabled).length)} fontes ativas na configuração · ${number.format(catalog.filter((row) => !row.enabled).length)} desativadas. Fontes em prévia são coletadas, mas não liberadas automaticamente para alertas.`));
  if (!groups.length) sourceTarget.append(node('p', 'empty', 'A configuração das fontes não está nesta fotografia do painel.'));
  const health = state.data.collectionHealth || [];
  const ai = health.find((row) => row.name === 'DeepSeek');
  $('#ai-runtime-status').textContent = ai
    ? `Na última execução: ${number.format(ai.itemCount || 0)} ${ai.itemCount === 1 ? 'revisão' : 'revisões'} pelo DeepSeek${ai.status === 'ok' ? ', sem erro registrado.' : '; houve uma falha ou resposta inconsistente, e itens sem validação não são liberados automaticamente.'}`
    : 'Na última execução, não há revisão do DeepSeek registrada.';
  const problems = health.filter((row) => ['error', 'degraded'].includes(row.status));
  const target = $('#method-health');
  target.replaceChildren(node('p', '', problems.length
    ? `${problems.length} consultas ou fontes registraram falha parcial na última situação guardada. As outras continuam independentes.`
    : 'Nenhuma falha de fonte registrada na última situação guardada.'));
  for (const row of problems) {
    const entry = node('div', 'method-health-row');
    entry.append(node('strong', '', row.name), node('span', '', sourceMessage(row)));
    target.append(entry);
  }
}
function svgElement(tag, attributes = {}, value = '') {
  const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, entry] of Object.entries(attributes)) element.setAttribute(key, String(entry));
  if (value !== '') element.textContent = value;
  return element;
}
function chartLabel(key, monthly) {
  const [year, month, day] = key.split('-');
  return monthly ? `${month}/${year.slice(2)}` : `${day}/${month}`;
}
function renderResultsChart(result) {
  const target = $('#results-chart'); target.replaceChildren();
  const { buckets, monthly } = result;
  if (!buckets.length) { target.append(node('p', 'results-empty', 'Ainda não há datas para este gráfico.')); return; }
  const mobile = window.matchMedia('(max-width: 650px)').matches;
  const chart = svgElement('svg', { viewBox: mobile ? '0 0 344 242' : '0 0 920 270', role: 'img',
    'aria-label': `Gráfico de ${buckets.length} períodos com ${result.confirmedCount} fatos confirmados. Consulte a tabela logo abaixo para os valores exatos.` });
  const title = svgElement('title', {}, 'Fatos confirmados por período'); chart.append(title);
  const max = Math.max(1, ...buckets.map((bucket) => bucket.count));
  const plot = mobile ? { left: 30, top: 18, right: 329, bottom: 192 }
    : { left: 42, top: 20, right: 900, bottom: 215 };
  const height = plot.bottom - plot.top;
  const gridSteps = Math.min(3, max);
  for (let step = 0; step <= gridSteps; step += 1) {
    const value = Math.round(max * step / gridSteps);
    const y = plot.bottom - height * step / gridSteps;
    chart.append(svgElement('line', { x1: plot.left, x2: plot.right, y1: y, y2: y, class: 'results-gridline' }),
      svgElement('text', { x: plot.left - 10, y: y + 4, class: 'results-axis-label', 'text-anchor': 'end' }, String(value)));
  }
  const slot = (plot.right - plot.left) / buckets.length;
  const width = Math.min(mobile ? 24 : 33, Math.max(mobile ? 3 : 5, slot * .58));
  const visibleTicks = Math.min(mobile ? 4 : 7, buckets.length);
  const tickStep = Math.max(1, Math.ceil((buckets.length - 1) / Math.max(1, visibleTicks - 1)));
  buckets.forEach((bucket, index) => {
    const x = plot.left + slot * (index + .5);
    const barHeight = bucket.count ? Math.max(3, bucket.count / max * height) : 0;
    const bar = svgElement('rect', { x: x - width / 2, y: plot.bottom - barHeight, width, height: barHeight,
      rx: Math.min(3, width / 4), class: `results-bar ${result.mode}` });
    bar.append(svgElement('title', {}, `${chartLabel(bucket.key, monthly)}: ${bucket.count} ${bucket.count === 1 ? 'fato' : 'fatos'}`));
    chart.append(bar);
    if (index % tickStep === 0 || index === buckets.length - 1) chart.append(svgElement('text', {
      x, y: plot.bottom + 24, class: 'results-axis-label', 'text-anchor': 'middle',
    }, chartLabel(bucket.key, monthly)));
  });
  target.append(chart);
  const details = node('details', 'results-chart-data');
  details.append(node('summary', '', 'Ler valores do gráfico'));
  const table = node('table'); const head = node('tr');
  head.append(node('th', '', 'Período'), node('th', '', 'Fatos'));
  table.append(head);
  for (const bucket of buckets) { const row = node('tr');
    row.append(node('td', '', chartLabel(bucket.key, monthly)), node('td', '', number.format(bucket.count))); table.append(row); }
  details.append(table); target.append(details);
}
function renderResultsBreakdown(title, subtitle, rows) {
  const card = node('section', 'results-breakdown');
  card.append(node('h3', '', title), node('p', '', subtitle));
  const top = rows.slice(0, 6);
  if (rows.length > 6) top.push({ name: 'Outros', count: rows.slice(6).reduce((sum, row) => sum + row.count, 0) });
  if (!top.length) { card.append(node('p', 'results-empty', 'Sem fatos neste período.')); return card; }
  const max = Math.max(...top.map((row) => row.count));
  for (const row of top) {
    const entry = node('div', 'results-breakdown-row');
    const textLine = node('div', 'results-breakdown-line');
    const name = node('span', '', row.name); name.title = row.name;
    textLine.append(name, node('strong', '', number.format(row.count)));
    const track = node('div', 'results-breakdown-track');
    const fill = node('span'); fill.style.width = `${row.count / max * 100}%`; track.append(fill);
    entry.append(textLine, track); card.append(entry);
  }
  return card;
}
function renderResults() {
  const result = buildResults(state.data, { period: state.resultPeriod, mode: state.resultMode });
  document.querySelectorAll('.results-period-button').forEach((button) => {
    const active = button.dataset.period === state.resultPeriod;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  });
  document.querySelectorAll('.results-mode button').forEach((button) => {
    const active = button.dataset.mode === state.resultMode;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  });
  const periodText = { all: 'desde o início', '30d': 'nos últimos 30 dias', '7d': 'nos últimos 7 dias' }[state.resultPeriod];
  const metric = (numberValue, heading, description, detail = '') => {
    const card = node('article', 'results-metric');
    card.append(node('span', 'results-metric-heading', heading), node('strong', '', number.format(numberValue)),
      node('p', '', description));
    if (detail) card.append(node('small', '', detail));
    return card;
  };
  $('#results-metrics').replaceChildren(
    metric(result.consortiaCount, 'CONSÓRCIOS IDENTIFICADOS', `Primeira menção no acervo ${periodText}.`,
      `${number.format(result.cnpjCount)} com CNPJ associado na base`),
    metric(result.confirmedCount, 'FATOS CONFIRMADOS', `No recorte ${state.resultMode === 'discovery' ? 'da descoberta' : 'da ocorrência'} ${periodText}.`,
      'Decisão “confirmado” na tabela de eventos'),
    metric(result.municipalityCount, 'MUNICÍPIOS COM PARTICIPAÇÃO', `Participação documentada e descoberta ${periodText}.`,
      'Não equivale a um censo de membros atuais'),
  );
  $('#results-chart-caption').textContent = state.resultMode === 'discovery'
    ? 'Data em que o radar encontrou cada registro pela primeira vez.'
    : 'Data do fato, quando comprovada; na falta dela, data da publicação original. Sem dia seguro, o registro não é colocado no gráfico diário.';
  $('#results-chart-note').textContent = state.resultMode === 'occurrence'
    ? `Ocorrência · ${result.monthly ? 'agrupamento mensal' : 'agrupamento diário'} · ${result.missingOccurrenceDate} ${result.missingOccurrenceDate === 1 ? 'registro descoberto no período sem data suficiente' : 'registros descobertos no período sem data suficiente'} para posicionar no tempo.`
    : `Descoberta · ${result.monthly ? 'agrupamento mensal' : 'agrupamento diário'} · ${result.undated} ${result.undated === 1 ? 'registro sem data plotável' : 'registros sem data plotável'} neste recorte.`;
  renderResultsChart(result);
  $('#results-breakdowns').replaceChildren(
    renderResultsBreakdown('Por assunto', 'Tipos dos fatos confirmados no período.', result.breakdowns.categories),
    renderResultsBreakdown('Por UF', 'Local do fato; uma notícia interestadual conta em cada UF envolvida.', result.breakdowns.states),
    renderResultsBreakdown('Por fonte', 'Veículos e portais onde o radar encontrou a publicação.', result.breakdowns.sources),
    renderResultsBreakdown('Consórcios em evidência', 'Menções nos fatos confirmados; um fato pode citar mais de um.', result.breakdowns.consortia),
  );
}
function switchView(view, focusDetail = false) {
  state.view = view;
  const titles = { overview: ['Triagem', 'Registro de publicações'], results: ['Resultados', 'Resultados do radar'], feed: ['Publicações', 'Arquivo de publicações'],
    base: ['Base completa', 'Base de dados'], method: ['Como funciona', 'Fluxo e critérios'] };
  document.querySelectorAll('.view').forEach((section) => section.classList.toggle('active', section.id === view));
  document.querySelectorAll('.nav-button').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  $('#breadcrumb-current').textContent = titles[view][0];
  $('#page-title').textContent = titles[view][1];
  const descriptions = { overview: 'O que entrou na base, o que foi descartado e qual documento sustenta cada decisão.',
    results: 'Consórcios, fatos e participação documentada, com recortes temporais e fontes visíveis.',
    feed: 'Todas as coletas guardadas, com filtros, evidências e fonte original.',
    base: 'Consulte cada tabela, inclusive colunas vazias, com explicação e prévia da linha.',
    method: 'Entenda onde entram as regras, a IA e a revisão humana.' };
  $('#page-description').textContent = descriptions[view];
  if (view === 'feed') renderFeed();
  if (view === 'overview') renderDeck();
  if (view === 'results') renderResults();
  if (view === 'base') renderBase();
  if (view === 'method') renderMethod();
  if (focusDetail && view === 'feed' && window.matchMedia('(max-width: 780px)').matches)
    $('#detail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  else window.scrollTo({ top: 0, behavior: 'smooth' });
}
function renderSnapshot() {
  $('#last-collection').textContent = date(state.data.lastCollectionAt, true);
  $('#generated-at').textContent = `Painel gerado em ${date(state.data.generatedAt, true)}`;
  $('#rail-mode').textContent = state.data.public ? 'Consulta pública' : 'Consulta local';
  $('#hosting-badge').textContent = state.data.public ? 'Consulta pública · atualização automática' : 'Consulta local · somente leitura';
  $('#footer-mode').textContent = `RADAR CONSÓRCIOS / CONSULTA ${state.data.public ? 'PÚBLICA' : 'LOCAL'}`;
  renderOverview();
  if (state.view === 'results') renderResults();
  if (state.view === 'feed') renderFeed();
  if (state.view === 'base') renderBase();
  if (state.view === 'method') renderMethod();
}
let refreshInProgress = false;
async function refreshPublishedData() {
  if (!state.data?.public || refreshInProgress || document.visibilityState === 'hidden') return;
  refreshInProgress = true;
  try {
    const versionResponse = await fetch(`./version.json?check=${Date.now()}`, { cache: 'no-store' });
    if (!versionResponse.ok) return;
    const version = await versionResponse.json();
    if (!version.generatedAt || version.generatedAt === state.data.generatedAt) return;
    const nextData = await fetchSnapshot(version.generatedAt);
    if (nextData.generatedAt !== version.generatedAt) return;
    state.data = nextData;
    renderSnapshot();
  } catch (error) {
    console.warn('A atualização do painel será tentada novamente.', error);
  } finally {
    refreshInProgress = false;
  }
}
async function init() {
  try {
    state.data = await fetchSnapshot();
    renderSnapshot();
    document.querySelectorAll('.nav-button').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
    document.querySelectorAll('.results-period-button').forEach((button) => button.addEventListener('click', () => {
      state.resultPeriod = button.dataset.period; renderResults();
    }));
    document.querySelectorAll('.results-mode button').forEach((button) => button.addEventListener('click', () => {
      state.resultMode = button.dataset.mode; renderResults();
    }));
    let resultChartMobile = window.matchMedia('(max-width: 650px)').matches;
    window.addEventListener('resize', () => {
      const nextMobile = window.matchMedia('(max-width: 650px)').matches;
      if (nextMobile !== resultChartMobile) { resultChartMobile = nextMobile; if (state.view === 'results') renderResultsChart(buildResults(state.data, { period: state.resultPeriod, mode: state.resultMode })); }
    });
    $('#open-feed').addEventListener('click', () => switchView('feed'));
    $('#deck-search').addEventListener('input', () => { state.selectedOverviewItem = ''; $('#deck-stack').scrollTop = 0; renderDeck(); });
    $('#deck-filter').addEventListener('change', () => { state.selectedOverviewItem = ''; $('#deck-stack').scrollTop = 0; renderDeck(); });
    $('#deck-category').addEventListener('change', () => { state.selectedOverviewItem = ''; $('#deck-stack').scrollTop = 0; renderDeck(); });
    $('#search').addEventListener('input', () => { state.limit = 40; renderFeed(); });
    $('#status-filter').addEventListener('change', () => { state.limit = 40; renderFeed(); });
    $('#more-button').addEventListener('click', () => { state.limit += 40; renderFeed(); });
    $('#base-search').addEventListener('input', () => { state.baseRowIndex = 0; state.baseLimit = 25; renderBase(); });
    $('#base-more').addEventListener('click', () => { state.baseLimit += 25; renderBase(); });
    if (state.data.public) {
      setInterval(refreshPublishedData, 5 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshPublishedData(); });
    }
  } catch (error) {
    console.error('Falha ao abrir painel:', error);
    $('#error').hidden = false;
  }
}
init();
