import { escapeWhatsApp, normalizeForMatch, normalizeWhitespace } from './text.mjs';

const categoryLabels = {
  CRISE: 'ALERTA SOBRE CONSÓRCIO',
  SAÍDA: 'SAÍDA DE CONSÓRCIO',
  CRIAÇÃO: 'CRIAÇÃO DE CONSÓRCIO',
  ADESÃO: 'ADESÃO A CONSÓRCIO',
  RATEIO: 'CONTRATO DE RATEIO',
  PROTOCOLO: 'PROTOCOLO DE INTENÇÕES',
  GOVERNANÇA: 'GESTÃO DO CONSÓRCIO',
  CONTROLE: 'FISCALIZAÇÃO E CONTROLE',
  FINANÇAS: 'FINANÇAS DO CONSÓRCIO',
  AÇÃO: 'ATUAÇÃO DO CONSÓRCIO',
  ATUAÇÃO: 'ATUAÇÃO DO CONSÓRCIO',
  GERAL: 'CONSÓRCIOS PÚBLICOS',
};

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || 'data não informada');
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).formatToParts(date);
  const part = (type) => parts.find((entry) => entry.type === type)?.value || '';
  return `${part('day')} ${part('month')} ${part('year')}`.replace(/\s+/g, ' ').trim();
}

function cleanInline(value = '') {
  return escapeWhatsApp(value).replace(/[*_~`]/g, '').replace(/\s+/g, ' ').trim();
}

function extractConsortiumLabel(item) {
  const fullText = normalizeWhitespace(`${item.title || ''} ${item.summary || ''} ${item.rawText || ''}`);
  const text = item.kind === 'gazette' ? fullText.slice(0, 1600) : fullText;
  const generic = new Set([
    'MG', 'SP', 'PR', 'SC', 'RS', 'BR', 'PUBLICO', 'PÚBLICO', 'INTERMUNICIPAL', 'NACIONAL',
    'REGIONAL', 'INSTITUICAO', 'INSTITUIÇÃO', 'SECRETARIA', 'CNM', 'FNS', 'DEP',
  ]);
  const candidates = [
    text.match(/cons[oó]rcio[^.;:]{0,160}?\(([A-Z][A-Z0-9]{2,14})\)/i)?.[1],
    text.match(/cons[oó]rcio[^.;:]{0,160}?[–—]\s*([A-Z][A-Z0-9]{2,14})(?=[\s.,;)]|$)/i)?.[1],
  ].filter((candidate) => candidate && (candidate === candidate.toUpperCase() || /^[A-Z][a-z]{2,14}$/.test(candidate)))
    .map((candidate) => candidate.toUpperCase());
  const acronym = candidates.find(
    (candidate) => candidate && candidate === candidate.toUpperCase() && !generic.has(candidate),
  );
  if (acronym) return acronym;
  return '';
}

function extractLegalInstrument(item) {
  const text = normalizeWhitespace(`${item.summary || ''} ${item.rawText || ''}`).slice(0, 260);
  const match = text.match(/\b(LEI(?:\s+COMPLEMENTAR)?|DECRETO)\s+N(?:[º°]|O)?\.?\s*([\d.]+(?:\/\d{4})?)/i);
  if (!match) return null;
  const type = /decreto/i.test(match[1])
    ? 'Decreto'
    : /complementar/i.test(match[1])
      ? 'Lei Complementar'
      : 'Lei';
  let number = match[2];
  const year = new Date(item.publishedAt).getFullYear();
  if (!number.includes('/') && Number.isInteger(year)) number += `/${year}`;
  return { article: type === 'Decreto' ? 'O' : 'A', label: `${type} nº ${number}` };
}

function firstCompleteSentence(value, fallback) {
  const text = normalizeWhitespace(value);
  const sentences = [...new Intl.Segmenter('pt-BR', { granularity: 'sentence' }).segment(text)];
  const first = sentences.map((s) => s.segment.trim()).find((s) => s.length >= 35 && s.length <= 360 && /[.!?]["”']?$/.test(s) && !/…|\.{3}|\[\s*…/.test(s));
  if (first) return first;
  const cleanFallback = normalizeWhitespace(fallback);
  return /[.!?]$/.test(cleanFallback) ? cleanFallback : `${cleanFallback}.`;
}

function gazetteLead(item) {
  const category = item.classification?.category;
  const locality = cleanInline(item.territoryName || 'O município');
  const consortium = extractConsortiumLabel(item);
  const instrument = extractLegalInstrument(item);
  const legalPrefix = instrument ? `${instrument.article} ${instrument.label}` : 'O ato municipal';
  if (category === 'ADESÃO' && /proposta de ingresso|proposta de adesao/.test(normalizeForMatch(item.summary || ''))) {
    return `O documento registra uma proposta de ingresso de ${locality} em consórcio intermunicipal.`;
  }
  const target = consortium ? `o ${consortium}` : 'o consórcio intermunicipal citado';
  const protocolChange = /alteracao.{0,120}protocolo de intencoes/.test(
    normalizeForMatch(item.classification?.evidenceText || `${item.summary || ''} ${item.rawText || ''}`).slice(0, 800),
  );

  const templates = {
    SAÍDA: `${legalPrefix} autoriza ${locality} a se retirar d${target}.`,
    ADESÃO: `${legalPrefix} autoriza ${locality} a integrar ${target}.`,
    CRIAÇÃO: `${legalPrefix} trata da criação de um novo consórcio intermunicipal em ${locality}.`,
    RATEIO: /contrato(s)? de rateio/.test(
      normalizeForMatch(`${item.summary || ''} ${item.rawText || ''}`).slice(0, 700),
    )
      ? /termo aditivo/.test(
          normalizeForMatch(`${item.summary || ''} ${item.rawText || ''}`).slice(0, 700),
        )
        ? `${locality} publicou termo aditivo ao contrato de rateio com ${target}.`
        : `${locality} publicou contrato de rateio com ${target}.`
      : /rateio pela participacao/.test(
            normalizeForMatch(`${item.summary || ''} ${item.rawText || ''}`).slice(0, 1000),
          )
        ? `${locality} publicou dotação orçamentária relacionada à participação em consórcio público.`
        : `${locality} publicou ato relativo ao rateio com ${target}.`,
    PROTOCOLO: `${locality} publicou ato relacionado ao protocolo de intenções d${target}.`,
    CRISE: `${locality} publicou ato relacionado à dissolução, extinção ou situação crítica d${target}.`,
    GOVERNANÇA: protocolChange
      ? `${locality} ratificou alteração do protocolo de intenções d${target}.`
      : `${locality} publicou uma medida de gestão relacionada a${consortium ? `o ${consortium}` : ' consórcio intermunicipal'}.`,
    CONTROLE: `${locality} aparece em ato de fiscalização ou controle relacionado a${consortium ? `o ${consortium}` : ' consórcio intermunicipal'}.`,
    FINANÇAS: `${locality} publicou ato financeiro relacionado a${consortium ? `o ${consortium}` : ' consórcio intermunicipal'}.`,
  };
  return templates[category] || firstCompleteSentence(item.summary || item.rawText, item.title);
}

function gazetteKeyPoints(item) {
  const text = normalizeForMatch(item.classification?.evidenceText || `${item.summary || ''} ${item.rawText || ''}`);
  const points = [];
  if (/proposta de ingresso|proposta de adesao/.test(text)) {
    points.push('O trecho consultado não comprova que a adesão já foi efetivada.');
  }
  if (/formalizacao do desligamento|efetiva formalizacao da saida/.test(text)) {
    points.push('A saída ainda depende da formalização do desligamento.');
  }
  if (/obrigacoes pecuniarias|compromissos assumidos|permanece responsavel pelas obrigacoes/.test(text)) {
    points.push('As obrigações assumidas permanecem até a saída ser efetivada.');
  }
  if (/continuidade da assistencia a saude|continuidade do atendimento/.test(text)) {
    points.push('A continuidade da assistência à saúde deverá ser assegurada.');
  }
  if (/termo aditivo ao contrato de rateio/.test(text)) {
    points.push('A publicação trata de um termo aditivo ao contrato de rateio.');
  }
  return [...new Set(points)].slice(0, 3);
}

export function buildSummary(item) {
  if (item.kind === 'gazette') return gazetteLead(item);
  return firstCompleteSentence(item.classification?.evidenceText || item.summary || item.rawText, item.title);
}

export function displayTitle(item) {
  if (item.kind !== 'gazette') return cleanInline(item.title);
  const locality = cleanInline(item.territoryName || 'Município');
  const consortium = extractConsortiumLabel(item);
  if (item.classification?.category === 'ADESÃO' && /proposta de ingresso|proposta de adesao/.test(normalizeForMatch(item.summary || ''))) {
    return `${locality} publica proposta de adesão a consórcio`;
  }
  const protocolChange = /alteracao.{0,120}protocolo de intencoes/.test(
    normalizeForMatch(`${item.summary || ''} ${item.rawText || ''}`).slice(0, 800),
  );
  const templates = {
    CRISE: `${locality} publica alerta sobre consórcio`,
    SAÍDA: `${locality} autoriza saída${consortium ? ` do ${consortium}` : ' de consórcio'}`,
    CRIAÇÃO: `${locality} formaliza criação de consórcio`,
    ADESÃO: `${locality} autoriza adesão${consortium ? ` ao ${consortium}` : ' a consórcio'}`,
    RATEIO: /contrato(s)? de rateio/.test(
      normalizeForMatch(`${item.title || ''} ${item.summary || ''}`),
    )
      ? `${locality} publica contrato de rateio${consortium ? ` com o ${consortium}` : ''}`
      : `${locality} publica ato sobre rateio consorcial`,
    PROTOCOLO: `${locality} publica protocolo de intenções`,
    GOVERNANÇA: protocolChange
      ? `${locality} ratifica alteração do protocolo${consortium ? ` do ${consortium}` : ''}`
      : `${locality} publica medida de gestão consorcial`,
    CONTROLE: `${locality} tem ato de fiscalização sobre consórcio`,
    FINANÇAS: `${locality} publica ato financeiro sobre consórcio`,
  };
  return templates[item.classification?.category] || cleanInline(item.title);
}

export function formatWhatsAppMessage(item) {
  const classification = item.classification || { category: 'GERAL', emoji: '📰' };
  const hasRateioContract = /contrato(s)? de rateio/.test(
    normalizeForMatch(`${item.title || ''} ${item.summary || ''}`),
  );
  const category =
    classification.category === 'RATEIO' && !hasRateioContract
      ? 'RATEIO CONSORCIAL'
      : categoryLabels[classification.category] || categoryLabels.GERAL;
  const points = item.kind === 'gazette' ? gazetteKeyPoints(item) : [];
  const sourceLabel = cleanInline(item.source);
  const linkLabel = item.kind === 'gazette' ? 'Acesse o ato oficial (PDF)' : 'Leia a notícia completa';
  const lines = [
    `${classification.emoji} *${category}*`,
    `*${cleanInline(displayTitle(item))}*`,
  ];
  const summary = cleanInline(buildSummary(item));
  if (normalizeForMatch(summary).replace(/[.!?]+$/, '') !== normalizeForMatch(displayTitle(item)).replace(/[.!?]+$/, '')) {
    lines.push('', `> ${summary}`);
  }

  if (points.length) {
    lines.push('', '*Pontos-chave*', ...points.map((point) => `- ${cleanInline(point)}`));
  }

  lines.push(
    '',
    `_📅 ${formatDate(item.publishedAt)}  ·  📰 ${sourceLabel}_`,
    `🔗 *${linkLabel}:*`,
    item.url,
  );
  return lines.filter((line, index, all) => line !== '' || all[index - 1] !== '').join('\n').trim();
}

export function formatRunSummary(items, sendEnabled) {
  const header = sendEnabled ? 'Notícias publicadas' : 'Prévia — nenhuma mensagem enviada';
  const rows = items.length
    ? items.map(
        (item) =>
          `- ${item.classification.emoji} **${item.classification.category}** ` +
          `(${item.classification.score} pontos): [${item.title}](${item.url})`,
      )
    : ['- Nenhuma notícia nova atingiu a pontuação mínima.'];
  return [`## ${header}`, '', ...rows, ''].join('\n');
}

export function formatScraperSummary(items, observationsCount, diagnostics = []) {
  const rows = items.length
    ? items.map(
        (item) =>
          `- ${item.classification.emoji} **${item.classification.category}** ` +
          `(${item.classification.score} pontos): [${item.title}](${item.url})`,
      )
    : ['- Nenhum candidato novo dos scrapers atingiu a pontuação mínima.'];
  return [
    '## Monitoramento dos scrapers',
    '',
    `${observationsCount} item(ns) observado(s). Fontes homologadas seguem os critérios de publicação; candidatos em prévia aparecem abaixo.`,
    '',
    ...diagnostics.map((diagnostic) => {
      if (diagnostic.status === 'ok') {
        return `- ✅ ${diagnostic.name}: ${diagnostic.itemCount} item(ns) dentro da janela.`;
      }
      if (diagnostic.status === 'disabled') {
        return `- ℹ️ ${diagnostic.name}: chamada direta desativada — ${diagnostic.message}.`;
      }
      return `- ⚠️ ${diagnostic.name}: falha isolada — ${diagnostic.message}`;
    }),
    '',
    ...rows,
    '',
  ].join('\n');
}

export { formatDate };

export function formatWeeklyMessage(report, test = false) {
  const count = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;
  const date = (value) => new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit' }).format(new Date(value));
  const rows = [test ? '🧪 *PRÉVIA DO RESUMO SEMANAL*' : '🗓️ *RADAR CONSÓRCIOS | RESUMO SEMANAL*',
    `_${date(report.start)} a ${date(report.end)} · corte às ${new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' }).format(new Date(report.end))}_`, '',
    '*A semana em números*',
    `- ${count(report.observations, 'publicação única encontrada', 'publicações únicas encontradas')}`,
    `- ${count(report.events, 'achado relevante', 'achados relevantes')} após deduplicação`,
    `- ${count(report.sent, 'notícia enviada', 'notícias enviadas')} · ${count(report.pending, 'achado em fila', 'achados em fila')}`,
    `- ${count(Object.keys(report.sources).length, 'fonte', 'fontes')} nos achados · ${count(report.runs, 'coleta', 'coletas')}`,
  ];
  if (report.preview) rows.push(`- ${count(report.preview, 'achado ainda em prévia', 'achados ainda em prévia')}`);
  if (report.partial) rows.push('', 'ℹ️ Histórico parcial: o registro detalhado começou durante ou após o início deste período.');
  if (Object.keys(report.categories).length) rows.push('', '*Temas identificados*',
    ...Object.entries(report.categories).sort((a,b) => b[1]-a[1]).map(([label, n]) => `- ${cleanInline(categoryLabels[label] || label)}: ${n}`));
  rows.push('', '*Principais achados*');
  if (!report.highlights.length) rows.push('Nenhum achado atingiu os critérios nesta janela. Isso não significa ausência de eventos fora das fontes consultadas.');
  for (const [index, item] of report.highlights.entries()) {
    const title = cleanInline(displayTitle(item));
    const block = [`${index + 1}. *${title}*${item.previewOnly ? ' _(em prévia)_' : ''}`,
      `${cleanInline(item.source)} · ${date(item.publishedAt)}`, item.url, ''];
    if ([...rows, ...block].join('\n').length > 4800) break;
    rows.push(...block);
  }
  const rankedSources = Object.entries(report.sources).sort((a,b) => b[1]-a[1]);
  if (rankedSources.length) rows.push('*Origem dos achados*', ...rankedSources.slice(0, 6).map(([s,n])=>`- ${cleanInline(s)}: ${n}`));
  if (report.failures.length) rows.push('', '⚠️ *Cobertura com falhas no período*', report.failures.map(cleanInline).slice(0, 8).join(' · '));
  rows.push('', '_Os achados são selecionados por regras automáticas. Consulte os links para verificar cada publicação._');
  return rows.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
