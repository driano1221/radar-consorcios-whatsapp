import { escapeWhatsApp, normalizeForMatch, normalizeWhitespace } from './text.mjs';

const categoryLabels = {
  CRISE: 'ALERTA SOBRE CONSÓRCIO',
  SAÍDA: 'SAÍDA DE CONSÓRCIO',
  CRIAÇÃO: 'CRIAÇÃO DE CONSÓRCIO',
  ADESÃO: 'ADESÃO A CONSÓRCIO',
  'ADESÃO AUTORIZADA': 'INGRESSO AUTORIZADO',
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

function withoutSourceSuffix(title, source) {
  const cleanTitle = cleanInline(title);
  const suffix = ` - ${cleanInline(source)}`;
  return suffix.length > 3 && cleanTitle.toLocaleLowerCase('pt-BR').endsWith(suffix.toLocaleLowerCase('pt-BR'))
    ? cleanTitle.slice(0, -suffix.length) : cleanTitle;
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
    'ADESÃO AUTORIZADA': `${legalPrefix} autoriza ${locality} a integrar ${target}; a autorização não comprova o ingresso efetivado.`,
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
  if (item.verifiedSummary) return firstCompleteSentence(item.verifiedSummary, item.presentationTitle || item.title);
  if (/(?:\.\.\.|…)/.test(item.title || '') && /(?:\.\.\.|…)/.test(item.summary || '')) return '';
  const candidate = item.classification?.evidenceText || item.summary || item.rawText || '';
  const normal = (value) => normalizeForMatch(value).replace(/[.!?\s-]+$/g, '').trim();
  const headline = normal(displayTitle(item));
  const core = normal(candidate);
  if (core === headline || core === `${headline} ${normal(item.source)}` ||
    core === `${headline} - ${normal(item.source)}`) return '';
  return firstCompleteSentence(candidate, item.title);
}

export function displayTitle(item) {
  if (item.presentationTitle) return cleanInline(item.presentationTitle);
  if (item.kind !== 'gazette') return withoutSourceSuffix(item.title, item.source);
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
    'ADESÃO AUTORIZADA': `${locality} autoriza ingresso${consortium ? ` no ${consortium}` : ' em consórcio'}`,
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
  const lines = [
    '*RADAR CONSÓRCIOS*',
    `${classification.emoji} *${category}*`,
    '',
    `*${cleanInline(displayTitle(item))}*`,
  ];
  const summary = cleanInline(buildSummary(item));
  if (summary && normalizeForMatch(summary).replace(/[.!?]+$/, '') !== normalizeForMatch(displayTitle(item)).replace(/[.!?]+$/, '')) {
    lines.push('', `> ${summary}`);
  }

  if (points.length) {
    lines.push('', '*Pontos-chave*', ...points.map((point) => `- ${cleanInline(point)}`));
  }

  lines.push(
    '',
    `_${formatDate(item.publishedAt)} · ${sourceLabel}_`,
    `🔗 ${item.displayUrl || item.url}`,
  );
  return lines.filter((line, index, all) => line !== '' || all[index - 1] !== '').join('\n').trim();
}

export function formatRunSummary(items, sendEnabled) {
  const header = sendEnabled ? 'Notícias publicadas' : 'Prévia — nenhuma mensagem enviada';
  const rows = items.length
    ? items.map(
        (item) =>
          `- ${item.classification.emoji} **${item.classification.category}** ` +
          `(${item.classification.score} pontos): [${displayTitle(item)}](${item.displayUrl || item.url})`,
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
  const date = (value) => new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit',
  }).format(new Date(value));
  const hour = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit',
  }).format(new Date(report.end));
  const labels = {
    CRISE: 'ALERTA', SAÍDA: 'SAÍDA', CRIAÇÃO: 'NOVO CONSÓRCIO', ADESÃO: 'ADESÃO',
    'ADESÃO AUTORIZADA': 'INGRESSO AUTORIZADO',
    RATEIO: 'RATEIO', PROTOCOLO: 'PROTOCOLO', GOVERNANÇA: 'GESTÃO',
    CONTROLE: 'FISCALIZAÇÃO', FINANÇAS: 'FINANÇAS', ATUAÇÃO: 'ATUAÇÃO', AÇÃO: 'ATUAÇÃO',
  };
  const rows = [
    `${test ? '🧪 ' : '🗞️ '}*RADAR CONSÓRCIOS*`,
    `*${test ? 'Prévia do resumo semanal' : 'Resumo semanal'}* · ${date(report.start)}–${date(report.end)}`,
    `_Atualizado às ${hour} (Brasília)_`,
    '',
    `*${report.events} ${report.events === 1 ? 'achado relevante' : 'achados relevantes'}*`,
  ];
  if (!report.highlights.length) rows.push('', 'Nenhum achado atingiu os critérios nesta janela.');
  for (const [index, item] of report.highlights.entries()) {
    const ratifiedProtocol = item.kind === 'gazette' && ['GOVERNANÇA', 'PROTOCOLO'].includes(item.classification?.category) &&
      /ratifica.{0,35}protocolo de intenções/i.test(item.summary || '');
    const title = ratifiedProtocol
      ? `${cleanInline(item.territoryName || 'Município')} ratifica protocolo de intenções${extractConsortiumLabel(item) ? ` do ${extractConsortiumLabel(item)}` : ''}`
      : cleanInline(displayTitle(item));
    const source = cleanInline(item.source || 'Fonte não informada');
    const headline = withoutSourceSuffix(title, source);
    const category = labels[item.classification?.category] || 'CONSÓRCIOS';
    rows.push('', `${index + 1}. *${category}*`,
      `*${headline}*`, `_${date(item.publishedAt)} · ${source}_`,
      `🔗 ${item.displayUrl || item.url}`);
  }
  return rows.join('\n').trim();
}

export function formatWeeklyMessages(report, test = false, maxChars = 3400) {
  const text = formatWeeklyMessage(report, test);
  if (text.length <= maxChars) return [text];
  const blocks = text.split('\n\n');
  const header = blocks.slice(0, 2).join('\n\n');
  const findings = blocks.slice(2);
  const chunks = [];
  let current = [];
  for (const finding of findings) {
    const candidate = [...current, finding];
    if (current.length && `${header}\n_Parte 00/00_\n\n${candidate.join('\n\n')}`.length > maxChars) {
      chunks.push(current);
      current = [finding];
    } else current = candidate;
  }
  if (current.length) chunks.push(current);
  const messages = chunks.map((chunk, index) => `${header}\n_Parte ${index + 1}/${chunks.length}_\n\n${chunk.join('\n\n')}`);
  if (messages.some((message) => message.length > maxChars)) {
    throw new Error('Um achado semanal excede o limite de tamanho de uma mensagem.');
  }
  return messages;
}
