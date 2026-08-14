import { normalizeForMatch } from './text.mjs';

const RULES = [
  {
    category: 'CRISE',
    emoji: '🟥',
    weight: 8,
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
    category: 'SAÍDA',
    emoji: '🟧',
    weight: 8,
    patterns: [
      /\b(retirada|desligamento|desvinculacao|saida|exclusao)\b.{0,140}\b(consorcio|municipio consorciado)/,
      /\bconsorcio\b.{0,140}\b(retirada|desligamento|desvinculacao|saida|exclusao)\b/,
      /\b(deixa|deixou|sai|saiu|rompe|rompeu)\b.{0,100}\bconsorcio/,
      /\bdenuncia\b.{0,100}\bprotocolo de intencoes/,
    ],
  },
  {
    category: 'CRIAÇÃO',
    emoji: '🟩',
    weight: 8,
    patterns: [
      /\b(cria|criado|criacao|institui|formaliza)\b.{0,140}\bconsorcio/,
      /\b(constitui|constituicao)\b.{0,50}\b(um |do )consorcio/,
      /\bnovo consorcio\b/,
    ],
  },
  {
    category: 'ADESÃO',
    emoji: '🟦',
    weight: 7,
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
    category: 'CONTROLE',
    emoji: '🟥',
    weight: 7,
    patterns: [
      /\b(auditoria|investigacao|operacao|acao civil publica|recomendacao)\b.{0,140}\bconsorcio/,
      /\bconsorcio\b.{0,140}\b(irregularidade|fraude|desvio|improbidade|contas rejeitadas)\b/,
      /\b(tribunal de contas|ministerio publico|tce|tcu)\b.{0,160}\bconsorcio/,
    ],
  },
  {
    category: 'RATEIO',
    emoji: '🟪',
    weight: 7,
    patterns: [/\bcontrato(s)? de rateio\b/, /\brateio\b.{0,100}\bconsorcio/],
  },
  {
    category: 'FINANÇAS',
    emoji: '💰',
    weight: 6,
    patterns: [
      /\b(repasse|aporte|parcelamento|debito|prestacao de contas)\b.{0,120}\bconsorcio/,
      /\bconsorcio\b.{0,120}\b(repasse|aporte|parcelamento|debito|prestacao de contas)\b/,
    ],
  },
  {
    category: 'PROTOCOLO',
    emoji: '🟨',
    weight: 6,
    patterns: [/\bprotocolo de intencoes\b/],
  },
  {
    category: 'GOVERNANÇA',
    emoji: '⬛',
    weight: 8,
    patterns: [
      /\b(alteracao|revisao|mudanca)\b.{0,100}\b(estatuto|estatutar)/,
      /\b(ratificacao|consolidacao)\b.{0,120}\balteracao\b.{0,100}\bprotocolo de intencoes/,
      /\bassembleia\b.{0,120}\bconsorcio/,
      /\beleicao\b.{0,100}\bconsorcio/,
      /\bconsorcio\b.{0,100}\b(novo presidente|nova diretoria|eleito|eleita)\b/,
    ],
  },
  {
    category: 'ATUAÇÃO',
    emoji: '📰',
    weight: 4,
    patterns: [
      /\bconsorcio\b.{0,120}\b(inaugura|lanca|investe|aprova|assina|recebe|amplia|implanta)\b/,
      /\b(inaugura|lanca|investe|aprova|assina|recebe|amplia|implanta)\b.{0,120}\bconsorcio/,
    ],
  },
];

const NEGATIVE_PATTERNS = [
  { pattern: /\badesao a(s)? ata(s)?( de registro de precos)?\b/, penalty: 12, reason: 'adesão a ata de preços' },
  { pattern: /\bcarona\b.{0,100}\bata de registro de precos\b/, penalty: 12, reason: 'carona em ata de preços' },
  {
    pattern: /\b(consorcio de empresas|consorcio empresarial|consorcio vencedor|empresa consorciada)\b/,
    penalty: 12,
    reason: 'consórcio empresarial',
  },
  {
    pattern: /\b(administradora de consorcio|cota de consorcio|consorcio imobiliario|consorcio de veiculos)\b/,
    penalty: 14,
    reason: 'consórcio comercial',
  },
];

function isOfficialUrl(value = '') {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return /\.(gov|leg|mp)\.br$/.test(host) || /(^|\.)t(c|r)e-?[a-z]{2}\.gov\.br$/.test(host);
  } catch {
    return false;
  }
}

export function classifyItem(item) {
  const title = normalizeForMatch(item.title);
  const body = normalizeForMatch(`${item.title} ${item.summary || ''} ${item.rawText || ''}`);
  const eventText = item.kind === 'gazette' ? body.slice(0, 1800) : body;
  const institutionalContext =
    /\b(municipio|municipal|prefeitura|intermunicipal|interfederativo|consorcio publico|associacao publica|lei 11\.?107)\b/.test(
      body,
    );
  let score = 0;
  let selected = { category: 'GERAL', emoji: '📰', weight: 0 };
  const reasons = [];

  if (/\bconsorcio(s)?\b/.test(body)) score += 1;
  if (institutionalContext) score += 1;
  if (/\b(consorcio publico|consorcio intermunicipal|associacao publica|lei 11\.?107)\b/.test(body)) {
    score += 2;
    reasons.push('contexto institucional');
  }
  if (/\bconsorcio(s)?\b/.test(title)) score += 1;
  if (item.kind === 'gazette') score += 2;
  else if (isOfficialUrl(item.url)) score += 1;

  for (const rule of RULES) {
    const matchCount = rule.patterns.filter((pattern) => pattern.test(eventText)).length;
    if (!matchCount) continue;
    score += rule.weight + Math.min(matchCount - 1, 2);
    reasons.push(rule.category);
    if (rule.weight > selected.weight) selected = rule;
  }

  for (const negative of NEGATIVE_PATTERNS) {
    if (negative.pattern.test(body)) {
      score -= negative.penalty;
      reasons.push(`excluído: ${negative.reason}`);
    }
  }

  if (item.kind !== 'gazette' && !institutionalContext) {
    score -= 20;
    reasons.push('excluído: sem contexto de consórcio público/intermunicipal');
  }

  if (
    /\blei orcamentaria\b.{0,500}\b(consorcios publicos|contrato de rateio)\b/.test(eventText) ||
    /\breservara recursos\b.{0,350}\bcontrato de rateio\b/.test(eventText)
  ) {
    score -= 9;
    reasons.push('excluído: previsão orçamentária genérica');
  }

  return {
    category: selected.category,
    emoji: selected.emoji,
    score,
    reasons,
  };
}

export { RULES };
