const $ = (selector) => document.querySelector(selector);
const state = { data: null, view: 'overview', selectedItem: '', selectedConsortium: '', limit: 40 };
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
function sourceMessage(row) {
  if (/timeout|aborted due to timeout/i.test(row.message)) return 'A consulta demorou demais e expirou.';
  if (/\b503\b/.test(row.message)) return 'O site estava temporariamente indisponível (erro 503).';
  return row.message || 'A fonte respondeu parcialmente ou não entregou dados nesta coleta.';
}
function status(item) {
  if (item.editorialReview?.decision === 'confirmar_evento') return ['Conferido · aceito', 'event'];
  if (item.editorialReview?.decision === 'nao_evento') return ['Conferido · descartado', 'raw'];
  if (item.editorialReview?.decision === 'corrigir_categoria') return ['Conferido · corrigido', 'event'];
  if (needsAttention(item)) return ['Precisa conferir', 'wait'];
  if (item.baseStatus === 'evento_candidato') return ['Possível achado', 'event'];
  return ['Fora da lista', 'raw'];
}
function readableReason(item) {
  if (item.editorialReview?.reason) return item.editorialReview.reason;
  if (item.contentQuality !== 'trecho_disponivel' && item.baseStatus !== 'evento_candidato')
    return 'O robô não recebeu texto suficiente para avaliar a matéria com segurança. A decisão pode ter usado apenas o título.';
  if (/ato antigo com data recente/i.test(item.reason)) return 'É um ato antigo que reapareceu em uma busca recente. Não é uma novidade.';
  if (item.reason.startsWith('Rejeitado por revisão editorial')) return item.reason.replace('Rejeitado por revisão editorial — ', 'Uma revisão mostrou que ');
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
function stat(index, value, title, foot) {
  const card = node('div', 'stat');
  card.append(node('div', 'stat-index', index), node('div', 'stat-value', number.format(value)),
    node('div', 'stat-label', title), node('div', 'stat-foot', foot));
  return card;
}
function renderOverview() {
  const { stats, items } = state.data;
  $('#stats').replaceChildren(
    stat('01', stats.documents, 'Publicações encontradas', 'TODAS AS COLETAS GUARDADAS'),
    stat('02', stats.eventCandidates, 'Possíveis achados', 'AINDA PODEM PRECISAR DE CONFERÊNCIA'),
    stat('03', stats.consortiaCandidates, 'Consórcios citados', 'NOMES ENCONTRADOS NOS DOCUMENTOS'),
    stat('04', stats.pendingIdentity, 'Para conferir', 'CONSÓRCIO AINDA NÃO IDENTIFICADO'),
  );
  const health = state.data.collectionHealth || [];
  const problems = health.filter((row) => row.status === 'error' || row.status === 'degraded');
  const disabled = health.filter((row) => row.status === 'disabled');
  const latestCheck = health.map((row) => row.checkedAt).filter(Boolean).sort().at(-1);
  $('#health-checked-at').textContent = latestCheck ? `SITUAÇÃO EM ${date(latestCheck, true)}` : 'SEM HISTÓRICO DE SAÚDE';
  $('#health-summary').textContent = problems.length ? `Ver fontes com problema (${problems.length})` : 'Ver situação das fontes';
  $('#quality-summary').replaceChildren(
    node('p', '', `${number.format(stats.insufficientContent || 0)} publicações têm apenas o título ou nenhum trecho. Nelas, a classificação não substitui a leitura da fonte original.`),
    node('p', '', problems.length ? `${problems.length} fontes ou consultas tiveram problemas na última coleta registrada.` : 'Nenhuma falha de fonte registrada na última coleta.'),
  );
  const problemList = $('#source-problems');
  problemList.replaceChildren(...problems.map((row) => {
    const entry = node('div', 'source-problem');
    entry.append(node('strong', '', row.name === 'Scrapers web' ? 'Coleta em sites' : row.name),
      node('span', '', row.status === 'error' ? 'FALHOU' : 'PARCIAL'), node('p', '', sourceMessage(row)));
    return entry;
  }));
  if (disabled.length) problemList.append(node('p', 'source-note', `${disabled.length} fontes estão desativadas de propósito e não foram contadas como falhas.`));
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
    node('span', '', `${number.format(stats.confirmed || 0)} achados aceitos após conferência`),
    node('span', '', `${number.format(stats.editoriallyDiscarded || 0)} publicações descartadas após conferência`),
    node('span', '', `${number.format(stats.documentLinks)} ligações entre documentos e consórcios`),
    node('span', '', `${number.format(stats.sent)} publicações já enviadas ao WhatsApp`),
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
  top.append(node('span', 'item-tag', item.contentQuality === 'trecho_disponivel' ? statusText : `${statusText} · TEXTO INSUFICIENTE`),
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
  if (!item) { panel.replaceChildren(node('p', 'empty', 'Selecione uma publicação para ver os detalhes.')); return; }
  const [statusText, tone] = status(item);
  const head = node('div', 'detail-kicker');
  head.append(node('span', '', 'SOBRE ESTA PUBLICAÇÃO'), node('span', '', item.id.slice(0, 8).toUpperCase()));
  const decision = node('div', `decision-card ${tone}`);
  const verdict = item.editorialReview?.decision === 'confirmar_evento' ? 'SIM — ACHADO CONFERIDO E ACEITO'
    : item.editorialReview?.decision === 'nao_evento' ? 'NÃO — DESCARTADO APÓS CONFERÊNCIA'
      : item.editorialReview?.decision === 'corrigir_categoria' ? 'SIM — CATEGORIA CORRIGIDA APÓS CONFERÊNCIA'
        : item.baseStatus === 'evento_candidato' ? 'POSSÍVEL ACHADO — AINDA NÃO CONFERIDO'
          : item.contentQuality !== 'trecho_disponivel' ? 'NÃO ENTROU — TEXTO INSUFICIENTE PARA CONCLUIR'
            : 'NÃO — FICOU FORA DA LISTA PRINCIPAL';
  decision.append(node('b', '', verdict),
    node('p', '', readableReason(item)));
  const grid = node('div', 'detail-grid');
  const fields = [
    ['ASSUNTO', item.baseStatus === 'evento_candidato' ? item.category : 'Não classificado como achado'],
    ['PUBLICADO EM', date(item.publishedAt)],
    ['ENCONTRADO PELA ÚLTIMA VEZ', date(item.lastSeenAt, true)],
    ['WHATSAPP', item.sentAt ? `Enviado em ${date(item.sentAt, true)}` : 'Não foi enviado'],
  ];
  for (const [name, value] of fields) {
    const field = node('div'); field.append(node('span', '', name), node('strong', '', value)); grid.append(field);
  }
  panel.replaceChildren(head, node('h3', 'detail-head', item.title),
    node('div', 'detail-meta', item.source || 'Fonte não informada'),
    decision, grid);
  if (item.editorialReview) {
    const facts = Object.entries(item.editorialReview.facts || {});
    if (facts.length) {
      panel.append(label('Informações confirmadas e limites'));
      for (const [key, value] of facts) {
        const field = node('div', 'identity-row');
        field.append(node('small', '', key.replaceAll('_', ' ').toUpperCase()), node('strong', '', value));
        panel.append(field);
      }
    }
    panel.append(label('Evidência usada na conferência'), node('p', 'detail-copy evidence', item.editorialReview.evidence));
    if (item.editorialReview.relatedDocumentId) {
      const related = state.data.items.find((row) => row.id === item.editorialReview.relatedDocumentId);
      if (related) {
        const button = node('button', 'detail-link', `Ver publicação posterior: ${related.title} →`);
        button.type = 'button';
        button.addEventListener('click', () => { state.selectedItem = related.id; renderFeed(); });
        panel.append(button);
      }
    }
  }
  if (item.contentQuality !== 'trecho_disponivel') {
    const warning = node('div', 'content-warning');
    warning.append(node('strong', '', item.contentQuality === 'sem_trecho' ? 'Nenhum trecho foi coletado' : 'Só o título foi coletado'),
      node('p', '', 'O texto integral não está nesta base. Abra a publicação original para avaliar o conteúdo.'));
    panel.append(warning);
  }
  if (item.identityPending) {
    panel.append(label('O que falta conferir?'), node('p', 'detail-copy', 'Ainda não identificamos com segurança qual consórcio este documento menciona.'));
  }
  if (item.links.length) {
    panel.append(label('Consórcio citado'));
    for (const binding of item.links) {
      const row = node('div', 'identity-row');
      row.append(node('strong', '', binding.name || 'Consórcio mencionado'),
        node('small', '', 'O documento menciona este consórcio; isso não confirma quem participa dele.'));
      panel.append(row);
    }
  }
  if (item.evidence && item.contentQuality === 'trecho_disponivel') {
    panel.append(label('Trecho disponível (não é o texto integral)'), node('p', 'detail-copy evidence', item.evidence));
  }
  panel.append(link('ABRIR PUBLICAÇÃO ORIGINAL', item.url));
  const technical = node('details', 'technical-details');
  technical.append(node('summary', '', 'Ver detalhes da análise'));
  technical.append(label('Motivo registrado'), node('p', 'detail-copy', item.reason));
  if (item.reasonBasis === 'recalculado com as regras atuais') technical.append(node('p', 'detail-copy', 'Este motivo foi reconstruído com as regras atuais; a decisão original daquela rodada não foi guardada individualmente.'));
  if (item.identityPending) technical.append(label('Identificação do consórcio'), node('p', 'detail-copy', item.identityPending));
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
function filteredFeed() {
  const query = $('#search').value.toLocaleLowerCase('pt-BR').trim();
  const filter = $('#status-filter').value;
  return state.data.items.filter((item) => {
    if (filter === 'event' && item.baseStatus !== 'evento_candidato') return false;
    if (filter === 'confirmed' && item.editorialReview?.decision !== 'confirmar_evento') return false;
    if (filter === 'editorially-discarded' && item.editorialReview?.decision !== 'nao_evento') return false;
    if (filter === 'raw' && item.baseStatus !== 'arquivo_bruto') return false;
    if (filter === 'sent' && !item.sentAt) return false;
    if (filter === 'pending' && !needsAttention(item)) return false;
    if (filter === 'incomplete' && item.contentQuality === 'trecho_disponivel') return false;
    return !query || [item.title, item.source, item.category,
      item.links.map((row) => row.name).join(' '), Object.values(item.editorialReview?.facts || {}).join(' ')]
      .join(' ').toLocaleLowerCase('pt-BR').includes(query);
  });
}
function needsAttention(item) {
  if (item.editorialReview) return false;
  return Boolean(item.identityPending || ['fila', 'previa', 'revisao'].includes(item.decisionStatus));
}
function renderFeed() {
  const items = filteredFeed();
  $('#result-count').textContent = `${number.format(items.length)} ${items.length === 1 ? 'PUBLICAÇÃO' : 'PUBLICAÇÕES'}`;
  const visible = items.slice(0, state.limit);
  if (!visible.some((item) => item.id === state.selectedItem)) state.selectedItem = visible[0]?.id || '';
  $('#feed-list').replaceChildren(...visible.map((item, index) => feedRow(item, index, item.id === state.selectedItem, () => {
    state.selectedItem = item.id; renderFeed();
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
      node('span', '', row.cnpj || 'CNPJ não associado com segurança'));
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
  panel.append(box, label('CNPJ encontrado'), node('p', 'detail-copy', row.cnpj || 'Não identificado com segurança.'),
    label('Outros nomes encontrados'), node('p', 'detail-copy', row.aliases || 'Nenhum registrado.'));
  const docs = state.data.items.filter((item) => item.links.some((binding) => binding.consortiumId === row.id));
  panel.append(label(`Publicações que o citam (${docs.length})`));
  for (const item of docs.slice(0, 12)) panel.append(link(item.title, item.url));
  if (docs.length > 12) panel.append(node('p', 'detail-copy', `Mais ${docs.length - 12} publicação(ões) estão na lista.`));
}
function switchView(view) {
  state.view = view;
  const titles = { overview: ['INÍCIO', 'Acompanhe as publicações'], feed: ['PUBLICAÇÕES', 'Publicações encontradas'],
    consortia: ['CONSÓRCIOS', 'Consórcios citados'] };
  document.querySelectorAll('.view').forEach((section) => section.classList.toggle('active', section.id === view));
  document.querySelectorAll('.nav-button').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  $('#breadcrumb-current').textContent = titles[view][0];
  $('#page-title').replaceChildren(node('span', '', titles[view][1]), node('span', 'period', '.'));
  const descriptions = { overview: 'Veja o que foi encontrado, o que pode ser importante e o que ainda precisa ser conferido.',
    feed: 'A lista começa pelos possíveis achados. Use o filtro para ver tudo o que foi coletado.',
    consortia: 'Nomes de consórcios encontrados nas publicações.' };
  $('#page-description').textContent = descriptions[view];
  if (view === 'feed') renderFeed();
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
    $('#open-incomplete').addEventListener('click', () => { $('#status-filter').value = 'incomplete'; switchView('feed'); });
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
