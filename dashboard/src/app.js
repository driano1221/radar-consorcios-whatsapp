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
function formatCnpj(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 14
    ? digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '';
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
  if (item.editorialReview?.decision === 'confirmar_evento') return ['Conferido · aceito', 'event'];
  if (item.editorialReview?.decision === 'nao_evento') return ['Conferido · descartado', 'raw'];
  if (item.editorialReview?.decision === 'duplicata') return ['Conferido · duplicata', 'raw'];
  if (item.editorialReview?.decision === 'corrigir_categoria') return ['Conferido · corrigido', 'event'];
  if (item.rejectedEvent) return ['Rejeitado pela triagem', 'raw'];
  if (item.legacyUnverified) return ['Legado por verificar', 'wait'];
  if (item.articleDuplicateOf) return ['Mesmo texto de outra publicação', 'raw'];
  if (item.recoverySuggestion) return ['Texto recuperado · revisar', 'wait'];
  if (item.baseStatus === 'arquivo_bruto' && item.contentQuality !== 'trecho_disponivel' && !item.pdfEvidence?.length && !item.fullText)
    return ['Só título · sem conclusão', 'wait'];
  if (needsAttention(item)) return ['Precisa conferir', 'wait'];
  if (item.baseStatus === 'evento_candidato') return ['Possível achado', 'event'];
  return ['Fora da lista', 'raw'];
}
function readableReason(item) {
  if (item.editorialReview?.reason) return item.editorialReview.reason;
  if (item.rejectedEvent) return item.reason || 'A triagem rejeitou este registro; ele permanece no histórico para consulta.';
  if (item.legacyUnverified) return 'Registro antigo ainda sem reconfirmação documental. O texto pode estar disponível, mas a decisão precisa de prova revisada.';
  if (item.pdfReassessment) return item.reason;
  if (item.articleDuplicateOf) return 'O texto integral recuperado é idêntico ao de outra publicação já guardada. Não contar como um segundo achado.';
  if (item.recoverySuggestion) return 'A leitura integral encontrou sinais de um possível achado. A classificação original foi mantida até conferirmos o trecho e a fonte.';
  if (item.contentQuality !== 'trecho_disponivel' && !item.pdfEvidence?.length && item.baseStatus !== 'evento_candidato')
    return 'Ainda não há prova suficiente para aceitar ou descartar. É preciso obter a publicação integral ou outro documento oficial.';
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
  const { stats, items, collection } = state.data;
  $('#stats').replaceChildren(
    stat('01', stats.documents, 'Publicações encontradas', 'TODAS AS COLETAS GUARDADAS'),
    stat('02', (stats.pendingReview || 0) + (stats.insufficientRaw || 0) + (stats.recoveredSuggestions || 0),
      'Para conferir', 'SUGESTÕES E TÍTULOS SEM TEXTO'),
    stat('03', stats.consortiaCandidates, 'Consórcios citados', 'NOMES ENCONTRADOS NOS DOCUMENTOS'),
    stat('04', stats.pendingIdentity, 'Para conferir', 'CONSÓRCIO AINDA NÃO IDENTIFICADO'),
  );
  $('#collection-run-at').textContent = collection?.at ? date(collection.at, true) : 'SEM RODADA REGISTRADA';
  $('#collection-kpis').replaceChildren(...(collection ? [
    [collection.rawCollected, 'Resultados retornados'],
    [collection.newDocuments, 'Novas publicações'],
    [collection.newCandidates, 'Novos possíveis achados'],
  ].map(([value, title]) => {
    const card = node('div', 'collection-kpi');
    card.append(node('strong', '', number.format(value)), node('span', '', title));
    return card;
  }) : [node('p', 'empty', 'A última rodada ainda não foi registrada neste arquivo.')]));
  const sourceMax = Math.max(1, ...(collection?.sources || []).map((row) => row.count));
  $('#collection-sources').replaceChildren(...(collection?.sources || []).map((row) => {
    const entry = node('div', 'collection-source');
    const top = node('div', 'collection-source-top');
    top.append(node('span', '', row.name === 'Scrapers web' ? 'Portais e diários' : row.name),
      node('strong', '', number.format(row.count)));
    const bar = node('div', 'collection-source-bar');
    const fill = node('span'); fill.style.width = `${Math.round(row.count / sourceMax * 100)}%`;
    bar.append(fill); entry.append(top, bar); return entry;
  }));
  const health = state.data.collectionHealth || [];
  const problems = health.filter((row) => row.status === 'error' || row.status === 'degraded');
  const disabled = health.filter((row) => row.status === 'disabled');
  const latestCheck = health.map((row) => row.checkedAt).filter(Boolean).sort().at(-1);
  $('#health-checked-at').textContent = latestCheck ? `SITUAÇÃO EM ${date(latestCheck, true)}` : 'SEM HISTÓRICO DE SAÚDE';
  $('#health-summary').textContent = problems.length ? `Ver fontes com problema (${problems.length})` : 'Ver situação das fontes';
  $('#quality-summary').replaceChildren(
    node('p', '', `${number.format(stats.insufficientContent || 0)} registros têm só título ou nenhum trecho no arquivo original — alguns já foram conferidos pelo PDF. Ainda pedem texto: ${number.format(stats.insufficientActive || 0)} achado, ${number.format(stats.insufficientLegacy || 0)} ${stats.insufficientLegacy === 1 ? 'legado' : 'legados'} e ${number.format(stats.insufficientRaw || 0)} do arquivo bruto. Estes últimos não são descartes confirmados.`),
    node('p', '', problems.length ? `${problems.length} ${problems.length === 1 ? 'fonte ou consulta teve problema' : 'fontes ou consultas tiveram problemas'} na última coleta registrada.` : 'Nenhuma falha de fonte registrada na última coleta.'),
    node('p', '', `${number.format(stats.missingSourceCandidates || 0)} registros de eventos estão sem nome da fonte no catálogo; o link original foi preservado para conferência.`),
    node('p', '', stats.legacyUnverifiedRecords || stats.rejectedEventRecords
      ? `Dos ${number.format(stats.eventRecords || 0)} registros relacionados a eventos, ${number.format(stats.rejectedEventRecords || 0)} foram rejeitados pela triagem e ${number.format(stats.legacyUnverifiedRecords || 0)} são legados ainda por verificar.`
      : `Os ${number.format(stats.eventRecords || 0)} registros da lista principal têm decisão registrada; não há legados por verificar.`),
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
    node('span', '', `${number.format(stats.duplicates || 0)} duplicatas identificadas`),
    node('span', '', `${number.format(stats.documentLinks)} ligações entre documentos e consórcios`),
    node('span', '', `${number.format(stats.recoveredSuggestions || 0)} sugestões após recuperar texto, aguardando revisão`),
    node('span', '', `${number.format(stats.sent)} publicações já enviadas ao WhatsApp`),
  );
  const pendingRecent = items.filter((item) => item.pendingReview);
  const overviewRecent = pendingRecent.length ? pendingRecent
    : items.filter((item) => item.editorialReview?.decision === 'confirmar_evento');
  $('#overview-recent-heading').textContent = pendingRecent.length ? 'Na fila de triagem' : 'Últimos achados conferidos';
  $('#overview-recent').replaceChildren(...overviewRecent.slice(0, 3).map((item) => {
    const button = node('button', 'recent-card'); button.type = 'button';
    button.append(node('span', 'item-tag', status(item)[0]), node('strong', '', displayTitle(item)),
      node('small', '', `${item.source || 'Fonte não informada'}  ·  ${date(item.lastSeenAt)}`));
    button.addEventListener('click', () => {
      $('#status-filter').value = item.pendingReview ? 'event' : 'confirmed';
      state.selectedItem = item.id; switchView('feed');
    });
    return button;
  }));
}
function feedRow(item, index, selected, onClick) {
  const button = node('button', `feed-item${selected ? ' active' : ''}`); button.type = 'button';
  const body = node('div'); const top = node('div', 'item-top');
  const [statusText, tone] = status(item);
  top.append(node('span', 'item-tag', item.editorialReview || item.contentQuality === 'trecho_disponivel' || item.pdfEvidence?.length ? statusText : `${statusText} · TEXTO INSUFICIENTE`),
    node('span', 'item-date', date(item.lastSeenAt)));
  const bottom = node('div', 'item-bottom');
  bottom.append(node('span', `status-dot ${tone}`), node('span', '', `${item.source || 'Origem não informada'} · ${statusText}`));
  body.append(top, node('strong', '', displayTitle(item)), bottom);
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
      : item.editorialReview?.decision === 'duplicata' ? 'NÃO — JÁ REPRESENTADO POR OUTRA PUBLICAÇÃO'
      : item.editorialReview?.decision === 'corrigir_categoria' ? 'SIM — CATEGORIA CORRIGIDA APÓS CONFERÊNCIA'
        : item.rejectedEvent ? 'NÃO — REJEITADO PELA TRIAGEM'
        : item.legacyUnverified ? 'PENDENTE — REGISTRO ANTIGO POR VERIFICAR'
        : item.pdfReassessment ? 'PRECISA CONFERIR — CATEGORIA REAVALIADA PELO PDF'
        : item.articleDuplicateOf ? 'NÃO — MESMO TEXTO DE OUTRA PUBLICAÇÃO'
        : item.recoverySuggestion ? 'PRECISA CONFERIR — TEXTO RECUPERADO SUGERE UM ACHADO'
        : item.baseStatus === 'evento_candidato' ? 'POSSÍVEL ACHADO — AINDA NÃO CONFERIDO'
          : item.contentQuality !== 'trecho_disponivel' && !item.pdfEvidence?.length ? 'SEM CONCLUSÃO — TEXTO NÃO RECUPERADO'
            : 'NÃO — FICOU FORA DA LISTA PRINCIPAL';
  decision.append(node('b', '', verdict),
    node('p', '', readableReason(item)));
  const grid = node('div', 'detail-grid');
  const fields = [
    ['ASSUNTO', item.rejectedEvent ? 'Não classificado como achado'
      : item.baseStatus === 'evento_candidato' ? item.category : 'Não classificado como achado'],
    ['BASE', item.baseDecision === 'confirmado' ? 'Fato confirmado' : item.baseDecision === 'descartado'
      ? 'Fora da base de eventos' : 'Candidato, ainda não confirmado'],
    ['ALERTA', item.alertDecision === 'historico' ? 'Não enviar — fato antigo'
      : item.alertDecision === 'enviado' ? 'Já enviado'
        : item.alertDecision === 'elegivel' ? 'Pode ser avaliado para envio'
          : item.alertDecision === 'data_inconsistente' ? 'Data precisa de conferência'
            : item.alertDecision === 'descartado' ? 'Não enviar' : 'Ainda sem decisão'],
    ...(item.stage && displayTitle(item) !== item.stage ? [['ETAPA COMPROVADA', item.stage]] : []),
    ...(item.eventAt ? [['DATA DO FATO', date(item.eventAt)]] : []),
    ...(item.eventMonth ? [['MÊS DO FATO', item.eventMonth.slice(5) + '/' + item.eventMonth.slice(0, 4)]] : []),
    ...(item.originalPublishedAt ? [['DATA NA FONTE ORIGINAL', date(item.originalPublishedAt)]] : []),
    [item.publishedDateSource === 'url_edicao' ? 'DATA DA EDIÇÃO' : 'PUBLICADO EM', date(item.publishedAt)],
    ['ENCONTRADO PELA ÚLTIMA VEZ', date(item.lastSeenAt, true)],
    ['WHATSAPP', item.sentAt ? `Enviado em ${date(item.sentAt, true)}` : 'Não foi enviado'],
  ];
  for (const [name, value] of fields) {
    const field = node('div'); field.append(node('span', '', name), node('strong', '', value)); grid.append(field);
  }
  panel.replaceChildren(head, node('h3', 'detail-head', displayTitle(item)),
    node('div', 'detail-meta', `${item.source || 'Fonte não informada'}${displayTitle(item) !== item.title ? ` · ${item.title}` : ''}`),
    decision, grid);
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
        const button = node('button', 'detail-link', `Ver publicação posterior: ${related.title} →`);
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
function filteredFeed() {
  const query = $('#search').value.toLocaleLowerCase('pt-BR').trim();
  const filter = $('#status-filter').value;
  return state.data.items.filter((item) => {
    if (filter === 'event' && !item.pendingReview) return false;
    if (filter === 'confirmed' && item.editorialReview?.decision !== 'confirmar_evento') return false;
    if (filter === 'editorially-discarded' && !['nao_evento', 'duplicata'].includes(item.editorialReview?.decision)) return false;
    if (filter === 'auto-rejected' && !item.rejectedEvent) return false;
    if (filter === 'legacy' && !item.legacyUnverified) return false;
    if (filter === 'raw' && item.baseStatus !== 'arquivo_bruto') return false;
    if (filter === 'sent' && !item.sentAt) return false;
    if (filter === 'pending' && !needsAttention(item)) return false;
    if (filter === 'incomplete' && (!needsAttention(item) || item.contentQuality === 'trecho_disponivel' || item.pdfEvidence?.length || item.fullText)) return false;
    return !query || [item.title, item.stage, item.source, item.category,
      item.links.map((row) => row.name).join(' '), Object.values(item.editorialReview?.facts || {}).join(' ')]
      .join(' ').toLocaleLowerCase('pt-BR').includes(query);
  });
}
function needsAttention(item) {
  if (item.editorialReview && item.editorialReview.decision !== 'corrigir_categoria') return false;
  return Boolean(item.identityPending || ['fila', 'previa', 'revisao'].includes(item.decisionStatus) ||
    item.recoverySuggestion ||
    (item.baseStatus === 'arquivo_bruto' && item.contentQuality !== 'trecho_disponivel' && !item.pdfEvidence?.length && !item.fullText));
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
    entry.append(node('strong', '', `${item.publishedAt ? date(item.publishedAt) : `Coletado em ${date(item.firstSeenAt)}`} · ${item.category}`),
      node('small', '', `${item.activeCandidate ? 'Achado na lista' : item.rejectedEvent ? 'Rejeitado' : item.legacyUnverified ? 'Legado pendente' : 'Arquivo bruto'} · ${item.source || 'Fonte não informada'}`),
      link(item.title, item.url));
    panel.append(entry);
  }
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
    feed: 'A lista começa pelos achados conferidos. Use o filtro para ver a fila, os descartes e todas as coletas.',
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
    $('#open-feed').addEventListener('click', () => {
      $('#status-filter').value = state.data.stats.pendingReview ? 'event' : 'confirmed';
      switchView('feed');
    });
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
