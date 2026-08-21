import { normalizeForMatch, normalizeWhitespace } from './text.mjs';

const PUBLIC_CONTEXT = /\b(consorcio publico|consorcio intermunicipal|consorcio interfederativo|associacao publica|lei 11\.?107)\b/;
const MUNICIPAL_CONTEXT = /\b(municipio|municipal|prefeitura|camara municipal|poder executivo)\b/;
const CONSORTIUM = /\bconsorcio(s)?\b/;

const RULES = [
  {
    category: 'CRISE', emoji: '🟥', weight: 8, priority: 100, requiresPublicContext: true,
    patterns: [
      /\b(dissolucao|extincao|liquidacao|intervencao|colapso|falencia)\b.{0,140}\bconsorcio/,
      /\bconsorcio\b.{0,140}\b(dissolucao|extincao|liquidacao|intervencao|colapso|falencia)\b/,
      /\b(inadimplencia|deficit|rombo|insolvencia)\b.{0,100}\bconsorcio/,
      /\bconsorcio\b.{0,100}\b(inadimplencia|deficit|rombo|insolvencia)\b/,
      /\bdivida(s)?\b.{0,30}\b(do|junto ao) consorcio/,
      /\bconsorcio\b.{0,120}\b(paralisado|inoperante|sem recursos|sem repasse|encerra atividades)\b/,
    ],
  },
  {
    category: 'SAÍDA', emoji: '🟧', weight: 8, priority: 90, requiresPublicContext: true,
    patterns: [
      /\b(retirada|desligamento|desvinculacao|saida|exclusao)\b.{0,140}\b(consorcio|municipio consorciado)/,
      /\bconsorcio\b.{0,140}\b(retirada|desligamento|desvinculacao|saida|exclusao)\b/,
      /\b(deixa|deixou|sai|saiu|rompe|rompeu)\b.{0,100}\bconsorcio/,
      /\bdenuncia\b.{0,100}\bprotocolo de intencoes/,
    ],
  },
  {
    category: 'CRIAÇÃO', emoji: '🟩', weight: 8, priority: 85, requiresPublicContext: true,
    patterns: [
      /\b(cria|criado|criacao|institui|formaliza)\b.{0,140}\bconsorcio/,
      /\b(constitui|constituicao)\b.{0,50}\b(um |do )consorcio/,
      /\bnovo consorcio\b/,
    ],
  },
  {
    category: 'ADESÃO', emoji: '🟦', weight: 7, priority: 80, requiresPublicContext: true,
    patterns: [
      /\b(adesao|ingresso|integracao|filiacao|inclusao)\b.{0,130}\b(ao |no )?consorcio/,
      /\b(autoriza|autorizado)\b.{0,140}\b(municipio|prefeitura|poder executivo)\b.{0,140}\b(participar|integrar|aderir)\b.{0,100}\bconsorcio/,
      /\b(passa a integrar|torna-se membro|municipio consorciado)\b.{0,100}\bconsorcio/,
      /\bratifica\b.{0,140}\bprotocolo de intencoes/,
      /\bratificacao\b.{0,80}\bprotocolo de intencoes\b/,
      /\bratificacao\b.{0,180}\bprotocolo de intencoes\b.{0,220}\b(participacao|ingresso|adesao)\b/,
    ],
  },
  {
    category: 'CONTROLE', emoji: '🟥', weight: 7, priority: 75, requiresPublicContext: true,
    patterns: [
      /\b(auditoria|investigacao|operacao|acao civil publica|recomendacao)\b.{0,140}\bconsorcio/,
      /\bconsorcio\b.{0,140}\b(irregularidade|fraude|desvio|improbidade|contas rejeitadas)\b/,
      /\b(tribunal de contas|ministerio publico|tce|tcu)\b.{0,160}\bconsorcio/,
    ],
  },
  {
    category: 'RATEIO', emoji: '🟪', weight: 7, priority: 70, requiresPublicContext: true,
    patterns: [/\bcontrato(s)? de rateio\b/, /\brateio\b.{0,100}\bconsorcio/],
  },
  {
    category: 'FINANÇAS', emoji: '💰', weight: 6, priority: 65, requiresPublicContext: true,
    patterns: [
      /\b(repasse|aporte|parcelamento|debito|prestacao de contas)\b.{0,120}\bconsorcio/,
      /\bconsorcio\b.{0,120}\b(repasse|aporte|parcelamento|debito|prestacao de contas)\b/,
    ],
  },
  {
    category: 'PROTOCOLO', emoji: '🟨', weight: 6, priority: 50, requiresPublicContext: true,
    patterns: [/\bprotocolo de intencoes\b/],
  },
  {
    category: 'GOVERNANÇA', emoji: '⬛', weight: 8, priority: 60, requiresPublicContext: true,
    patterns: [
      /\b(alteracao|revisao|mudanca)\b.{0,100}\b(estatuto|estatutar)/,
      /\b(ratificacao|consolidacao)\b.{0,120}\balteracao\b.{0,100}\bprotocolo de intencoes/,
      /\bassembleia\b.{0,120}\bconsorcio/,
      /\beleicao\b.{0,100}\bconsorcio/,
      /\bconsorcio\b.{0,100}\b(novo presidente|nova diretoria|eleito|eleita)\b/,
    ],
  },
  {
    category: 'ATUAÇÃO', emoji: '📰', weight: 4, priority: 40, requiresPublicContext: true,
    patterns: [
      /\bconsorcio\b.{0,120}\b(inaugura|lanca|investe|aprova|assina|recebe|amplia|implanta)\b/,
      /\b(inaugura|lanca|investe|aprova|assina|recebe|amplia|implanta)\b.{0,120}\bconsorcio/,
    ],
  },
];

const NEGATIVE_PATTERNS = [
  { pattern: /\badesao (a|de|em) (a )?(ata|atas|arp)( de registro de precos)?\b/, penalty: 30, reason: 'adesão a ata de preços' },
  { pattern: /\b(ata de registro de precos|registro de precos|intencao de registro de precos|orgao nao participante)\b/, penalty: 30, reason: 'contratação/ata de preços' },
  { pattern: /\bcarona\b.{0,100}\b(ata|registro de precos|arp)\b/, penalty: 30, reason: 'carona em ata de preços' },
  { pattern: /\b(consorcio de empresas|consorcio empresarial|consorcio vencedor|empresa consorciada)\b/, penalty: 30, reason: 'consórcio empresarial' },
  { pattern: /\b(administradora de consorcio|cota de consorcio|consorcio imobiliario|consorcio de veiculos)\b/, penalty: 30, reason: 'consórcio comercial' },
];

function isOfficialUrl(value = '') {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return /\.(gov|leg|mp)\.br$/.test(host) || /(^|\.)t(c|r)e-?[a-z]{2}\.gov\.br$/.test(host);
  } catch {
    return false;
  }
}

function evidenceSegments(item) {
  const excerpts = Array.isArray(item.excerpts) ? item.excerpts : [];
  const segments = excerpts.length ? excerpts : [item.summary || item.rawText || ''];
  const limit = item.kind === 'gazette' ? 1200 : 1800;
  return segments.map((segment) => normalizeWhitespace(segment).slice(0, limit)).filter(Boolean);
}

function hasPublicContext(text) {
  return PUBLIC_CONTEXT.test(text) || (CONSORTIUM.test(text) && MUNICIPAL_CONTEXT.test(text));
}

function isGenericBudgetProvision(text) {
  const explicitContract = /\b(contrato de rateio|contrato n\.?\s*\d+|celebram.{0,160}consorcio|objeto.{0,160}repasse)\b/.test(text);
  return (
    /\blei orcamentaria\b.{0,500}\b(consorcios publicos|contrato de rateio)\b/.test(text) ||
    /\breservara recursos\b.{0,350}\bcontrato de rateio\b/.test(text) ||
    (/\brateio pela participacao em consorcio publico\b/.test(text) && !explicitContract)
  );
}

function isMeetingAgendaWithoutDecision(text) {
  const agendaSignal = /\b(convocar|convocacao|reuniao|pauta|assuntos abordados|informes gerais)\b/.test(text);
  const decisionSignal = /\b(lei|decreto|autoriza|ratifica|aprovou|sanciona|promulga|delibera)\b/.test(text);
  return agendaSignal && !decisionSignal;
}

function evaluateSegment(item, evidence, index) {
  const title = normalizeForMatch(item.title);
  const text = normalizeForMatch(`${item.title || ''} ${evidence}`);
  const hasConsortium = CONSORTIUM.test(text);
  const strongPublicContext = PUBLIC_CONTEXT.test(text);
  const publicContext = hasPublicContext(text);
  let score = 0;
  let selected = { category: 'GERAL', emoji: '📰', weight: 0, priority: 0 };
  const reasons = [];

  if (hasConsortium) score += 1;
  if (publicContext) score += 1;
  if (strongPublicContext) {
    score += 2;
    reasons.push('contexto público forte');
  }
  if (CONSORTIUM.test(title)) score += 1;
  if (item.kind !== 'gazette' && isOfficialUrl(item.sourceUrl || item.url)) score += 1;

  for (const rule of RULES) {
    const matchCount = rule.patterns.filter((pattern) => pattern.test(text)).length;
    if (!matchCount) continue;
    if (rule.requiresPublicContext && !publicContext) {
      reasons.push(`rejeitado: ${rule.category} sem contexto público`);
      continue;
    }
    score += rule.weight + Math.min(matchCount - 1, 2);
    reasons.push(rule.category);
    if (rule.priority > selected.priority || (rule.priority === selected.priority && rule.weight > selected.weight)) {
      selected = rule;
    }
  }

  for (const negative of NEGATIVE_PATTERNS) {
    if (negative.pattern.test(text)) {
      score -= negative.penalty;
      reasons.push(`rejeitado: ${negative.reason}`);
    }
  }

  if (isGenericBudgetProvision(text)) {
    score -= 12;
    reasons.push('rejeitado: previsão orçamentária genérica');
  }
  if (isMeetingAgendaWithoutDecision(text)) {
    score -= 12;
    reasons.push('rejeitado: agenda sem deliberação');
  }

  const rejected = reasons.some((reason) => reason.startsWith('rejeitado:'));
  if (rejected) selected = { category: 'GERAL', emoji: '📰', weight: 0, priority: 0 };

  return {
    category: selected.category,
    emoji: selected.emoji,
    score,
    reasons,
    evidenceIndex: index,
    evidenceText: evidence,
    publicContext,
    strongPublicContext,
  };
}

export function classifyItem(item) {
  const classifications = evidenceSegments(item).map((evidence, index) => evaluateSegment(item, evidence, index));
  if (!classifications.length) {
    return { category: 'GERAL', emoji: '📰', score: 0, reasons: ['rejeitado: sem texto para classificação'], evidenceIndex: -1, evidenceText: '', publicContext: false, strongPublicContext: false };
  }
  return classifications.sort((left, right) => right.score - left.score)[0];
}

export function isPublishableClassification(classification, minimumScore = 5) {
  return classification.category !== 'GERAL' && classification.score >= minimumScore;
}

export { RULES, NEGATIVE_PATTERNS, evidenceSegments };
