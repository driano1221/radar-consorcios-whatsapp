const $ = (selector) => document.querySelector(selector);
const state = { data: null, view: 'overview', selectedItem: '', selectedQueue: '', selectedConsortium: '', limit: 40 };
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
function safeUrl(value) {
  try { const url = new URL(value); return /^https?:$/.test(url.protocol) ? url.href : ''; }
  catch { return ''; }
}
function link(label, url) {
  const href = safeUrl(url);
  if (!href) return node('span', 'detail-copy', label);
  const anchor = node('a', 'detail-link', `${label} ↗`);
  anchor.href = href; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer';
  return anchor;
}
function label(text) { return node('div', 'detail-label', text.toUpperCase()); }
function status(item) {
  if (item.identityPending) return ['Identidade pendente', 'wait'];
  if (item.decisionStatus === 'previa') return ['Fonte em prévia', 'wait'];
  if (item.decisionStatus === 'fila') return ['Na fila', 'wait'];
  if (item.decisionStatus === 'revisao') return ['Revisão necessária', 'wait'];
  if (item.baseStatus === 'evento_candidato') return ['Evento candidato', 'event'];
  return ['Somente no arquivo', 'raw'];
}
function stat(index, value, title, foot) {
  const card = node('div', 'stat');
  card.append(node('div', 'stat-index', index), node('div', 'stat-value', number.format(value)),
    node('div', 'stat-label', title), node('div', 'stat-foot', foot));
  return card;
}
function renderOverview() {
  const { stats, items } = state.data;
  $('#stats').replaceChildren(
    stat('01 / ACERVO', stats.documents, 'Documentos arquivados', 'TODOS OS TIPOS DE COLETA'),
    stat('02 / TRIAGEM', stats.eventCandidates, 'Eventos candidatos', 'NÃO CONFIRMADOS MANUALMENTE'),
    stat('03 / IDENTIDADE', stats.consortiaCandidates, 'Consórcios candidatos', 'IDENTIDADES A CONFERIR'),
    stat('04 / PENDÊNCIAS', stats.pendingIdentity, 'Sem identidade segura', 'AGUARDAM LEITURA DOCUMENTAL'),
  );
  const categories = Object.entries(stats.categories).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(1, ...categories.map(([, count]) => count));
  $('#category-chart').replaceChildren(...categories.map(([name, count]) => {
    const row = node('div', 'category-row');
    const body = node('div'); const top = node('div', 'category-top');
    top.append(node('span', '', name), node('span', '', number.format(count)));
    const bar = node('div', 'bar'); const fill = node('span'); fill.style.width = `${Math.round(count / max * 100)}%`; bar.append(fill);
    body.append(top, bar); row.append(body); return row;
  }));
  $('#base-extra').replaceChildren(
    node('span', '', `${number.format(stats.documentLinks)} vínculos documentais`),
    node('span', '', `${number.format(stats.sent)} registros enviados ao WhatsApp`),
  );
  $('#overview-recent').replaceChildren(...items.filter((item) => item.baseStatus === 'evento_candidato').slice(0, 3).map((item) => {
    const button = node('button', 'recent-card'); button.type = 'button';
    button.append(node('span', 'item-tag', status(item)[0]), node('strong', '', item.title),
      node('small', '', `${item.source || 'Fonte não informada'}  ·  ${date(item.lastSeenAt)}`));
    button.addEventListener('click', () => { state.selectedItem = item.id; switchView('feed'); });
    return button;
  }));
}
function feedRow(item, index, selected, onClick) {
  const button = node('button', `feed-item${selected ? ' active' : ''}`); button.type = 'button';
  const body = node('div'); const top = node('div', 'item-top');
  const [statusText, tone] = status(item);
  top.append(node('span', 'item-tag', item.baseStatus === 'evento_candidato' ? item.category : statusText),
    node('span', 'item-date', date(item.lastSeenAt)));
  const bottom = node('div', 'item-bottom');
  bottom.append(node('span', `status-dot ${tone}`), node('span', '', `${item.source || 'Origem não informada'} · ${statusText}`));
  body.append(top, node('strong', '', item.title), bottom);
  button.append(node('span', 'item-number', String(index + 1).padStart(2, '0')), body);
  button.addEventListener('click', onClick);
  return button;
}
function detail(item, target) {
  const panel = $(target);
  if (!item) { panel.replaceChildren(node('p', 'empty', 'Selecione um documento para ver os detalhes.')); return; }
  const [statusText, tone] = status(item);
  const head = node('div', 'detail-kicker');
  head.append(node('span', '', 'FICHA DO DOCUMENTO'), node('span', '', item.id.slice(0, 8).toUpperCase()));
  const decision = node('div', `decision-card ${tone}`);
  decision.append(node('b', '', item.baseStatus === 'evento_candidato' ? 'ENTROU NA BASE DE EVENTOS CANDIDATOS' : 'NÃO ENTROU NA BASE DE EVENTOS'),
    node('p', '', item.reason));
  const grid = node('div', 'detail-grid');
  const fields = [
    ['CLASSIFICAÇÃO', item.baseStatus === 'evento_candidato' ? item.category : 'Sem evento validado'],
    ['PONTUAÇÃO', item.score === '' ? '—' : `${item.score} pontos`],
    ['PUBLICAÇÃO', date(item.publishedAt)], ['PRIMEIRA COLETA', date(item.firstSeenAt, true)],
    ['ÚLTIMA COLETA', date(item.lastSeenAt, true)], ['WHATSAPP', item.sentAt ? `Enviado em ${date(item.sentAt, true)}` : 'Não consta envio'],
  ];
  for (const [name, value] of fields) {
    const field = node('div'); field.append(node('span', '', name), node('strong', '', value)); grid.append(field);
  }
  panel.replaceChildren(head, node('h3', 'detail-head', item.title),
    node('div', 'detail-meta', `${item.source || 'Fonte não informada'} · ${item.documentType || 'Documento'}`),
    decision, grid);
  if (item.reasonBasis === 'recalculado com as regras atuais') panel.append(node('p', 'detail-copy', 'Motivo reconstruído com as regras atuais; a decisão original não foi preservada individualmente.'));
  if (item.identityPending) {
    panel.append(label('Identidade pendente'), node('p', 'detail-copy', item.identityPending));
  }
  if (item.links.length) {
    panel.append(label('Vínculos documentais'));
    for (const binding of item.links) {
      const row = node('div', 'identity-row');
      row.append(node('strong', '', binding.name || 'Consórcio mencionado'),
        node('small', '', binding.status || 'Menção ainda não conferida'));
      panel.append(row);
    }
  }
  if (item.evidence) {
    panel.append(label('Trecho preservado'), node('p', 'detail-copy evidence', item.evidence));
  }
  if (item.classificationReasons.length) {
    panel.append(label('Sinais da classificação'));
    const list = node('ul', 'reason-list');
    for (const reason of item.classificationReasons) list.append(node('li', '', reason));
    panel.append(list);
  }
  panel.append(label('Leitura editorial'), node('p', 'detail-copy', item.analysis || 'Ainda não conferido manualmente.'));
  if (item.runId) panel.append(label('Última rodada'), node('p', 'detail-copy', `Execução ${item.runId}; observado ${item.observedCount || 1} vez(es) no histórico recente.`));
  panel.append(link('ABRIR FONTE ORIGINAL', item.url));
}
function filteredFeed() {
  const query = $('#search').value.toLocaleLowerCase('pt-BR').trim();
  const filter = $('#status-filter').value;
  return state.data.items.filter((item) => {
    if (filter === 'event' && item.baseStatus !== 'evento_candidato') return false;
    if (filter === 'raw' && item.baseStatus !== 'arquivo_bruto') return false;
    if (filter === 'sent' && !item.sentAt) return false;
    if (filter === 'pending' && !needsAttention(item)) return false;
    return !query || [item.title, item.source, item.category, item.links.map((row) => row.name).join(' ')]
      .join(' ').toLocaleLowerCase('pt-BR').includes(query);
  });
}
function needsAttention(item) {
  return Boolean(item.identityPending || ['fila', 'previa', 'revisao'].includes(item.decisionStatus));
}
function renderFeed() {
  const items = filteredFeed();
  $('#result-count').textContent = `${number.format(items.length)} ${items.length === 1 ? 'DOCUMENTO' : 'DOCUMENTOS'}`;
  const visible = items.slice(0, state.limit);
  if (!visible.some((item) => item.id === state.selectedItem)) state.selectedItem = visible[0]?.id || '';
  $('#feed-list').replaceChildren(...visible.map((item, index) => feedRow(item, index, item.id === state.selectedItem, () => {
    state.selectedItem = item.id; renderFeed();
  })));
  if (!visible.length) $('#feed-list').append(node('p', 'empty', 'Nenhum documento corresponde aos filtros.'));
  $('#more-button').hidden = visible.length >= items.length;
  detail(visible.find((item) => item.id === state.selectedItem), '#detail');
}
function renderQueue() {
  const items = state.data.items.filter(needsAttention);
  $('#queue-count').textContent = `${number.format(items.length)} ${items.length === 1 ? 'ITEM' : 'ITENS'}`;
  if (!items.some((item) => item.id === state.selectedQueue)) state.selectedQueue = items[0]?.id || '';
  $('#queue-list').replaceChildren(...items.map((item, index) => feedRow(item, index, item.id === state.selectedQueue, () => {
    state.selectedQueue = item.id; renderQueue();
  })));
  if (!items.length) $('#queue-list').append(node('p', 'empty', 'Nenhuma pendência identificada nos dados disponíveis.'));
  detail(items.find((item) => item.id === state.selectedQueue), '#queue-detail');
}
function renderConsortia() {
  const query = $('#consortium-search').value.toLocaleLowerCase('pt-BR').trim();
  const rows = state.data.consortia.filter((row) => !query || [row.name, row.alias, row.cnpj, row.aliases]
    .join(' ').toLocaleLowerCase('pt-BR').includes(query));
  $('#consortium-count').textContent = `${number.format(rows.length)} ${rows.length === 1 ? 'IDENTIDADE' : 'IDENTIDADES'}`;
  if (!rows.some((row) => row.id === state.selectedConsortium)) state.selectedConsortium = rows[0]?.id || '';
  $('#consortium-list').replaceChildren(...rows.map((row, index) => {
    const button = node('button', `feed-item${row.id === state.selectedConsortium ? ' active' : ''}`);
    button.type = 'button';
    const body = node('div'); const top = node('div', 'item-top');
    top.append(node('span', 'item-tag', row.alias || 'IDENTIDADE CANDIDATA'),
      node('span', 'item-date', `${row.documents} DOC.`));
    const bottom = node('div', 'item-bottom'); bottom.append(node('span', 'status-dot event'),
      node('span', '', row.cnpj || 'CNPJ não associado com segurança'));
    body.append(top, node('strong', '', row.name), bottom);
    button.append(node('span', 'item-number', String(index + 1).padStart(2, '0')), body);
    button.addEventListener('click', () => { state.selectedConsortium = row.id; renderConsortia(); });
    return button;
  }));
  if (!rows.length) $('#consortium-list').append(node('p', 'empty', 'Nenhum consórcio corresponde à busca.'));
  const row = rows.find((item) => item.id === state.selectedConsortium);
  const panel = $('#consortium-detail');
  if (!row) { panel.replaceChildren(node('p', 'empty', 'Selecione uma identidade para ver os documentos.')); return; }
  panel.replaceChildren(node('div', 'detail-kicker', 'FICHA DA IDENTIDADE CANDIDATA'),
    node('h3', 'detail-head', row.name), node('div', 'detail-meta', row.alias || 'Sigla não identificada'));
  const box = node('div', 'decision-card');
  box.append(node('b', '', `${row.documents} VÍNCULO(S) DOCUMENTAL(IS)`),
    node('p', '', 'A menção em documentos não comprova a composição nem a situação jurídica atual.'));
  panel.append(box, label('CNPJ associado'), node('p', 'detail-copy', row.cnpj || 'Não identificado com segurança.'),
    label('Variações de nome'), node('p', 'detail-copy', row.aliases || 'Nenhuma registrada.'),
    label('Situação'), node('p', 'detail-copy', row.status || 'Candidata à conferência.'));
  const docs = state.data.items.filter((item) => item.links.some((binding) => binding.consortiumId === row.id));
  panel.append(label(`Documentos vinculados (${docs.length})`));
  for (const item of docs.slice(0, 12)) panel.append(link(item.title, item.url));
  if (docs.length > 12) panel.append(node('p', 'detail-copy', `Mais ${docs.length - 12} documento(s) estão na lista de coletas.`));
}
function switchView(view) {
  state.view = view;
  const titles = { overview: ['VISÃO GERAL', 'O que o Radar encontrou'], feed: ['ÚLTIMAS COLETAS', 'Cada documento, uma decisão'],
    queue: ['PARA ACOMPANHAR', 'Pendências à vista'], consortia: ['CONSÓRCIOS', 'Identidades documentais'] };
  document.querySelectorAll('.view').forEach((section) => section.classList.toggle('active', section.id === view));
  document.querySelectorAll('.nav-button').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  $('#breadcrumb-current').textContent = titles[view][0];
  $('#page-title').replaceChildren(node('span', '', titles[view][1]), node('span', 'period', '.'));
  const descriptions = { overview: 'Da coleta à base: acompanhe cada documento, a decisão de triagem e o que ainda precisa de conferência.',
    feed: 'A trajetória de cada achado, do arquivo bruto à publicação.',
    queue: 'Itens que ainda merecem atenção documental ou editorial.',
    consortia: 'Nomes e vínculos candidatos extraídos com cautela dos documentos.' };
  $('#page-description').textContent = descriptions[view];
  if (view === 'feed') renderFeed();
  if (view === 'queue') renderQueue();
  if (view === 'consortia') renderConsortia();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function init() {
  try {
    const response = await fetch('./data.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    state.data = await response.json();
    $('#last-collection').textContent = date(state.data.lastCollectionAt, true);
    $('#generated-at').textContent = `Painel gerado em ${date(state.data.generatedAt, true)}`;
    renderOverview();
    document.querySelectorAll('.nav-button').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));
    $('#open-feed').addEventListener('click', () => switchView('feed'));
    $('#search').addEventListener('input', () => { state.limit = 40; renderFeed(); });
    $('#status-filter').addEventListener('change', () => { state.limit = 40; renderFeed(); });
    $('#consortium-search').addEventListener('input', renderConsortia);
    $('#more-button').addEventListener('click', () => { state.limit += 40; renderFeed(); });
  } catch (error) {
    console.error('Falha ao abrir painel:', error);
    $('#error').hidden = false;
  }
}
init();
