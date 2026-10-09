import { normalizeForMatch, normalizeWhitespace } from './text.mjs';
import { refineEventProof } from './event-proof.mjs';

const PUBLIC_CONTEXT = /\b(consorcios? publicos?|consorcio intermunicipal|consorcios intermunicipais|consorcios? interfederativos?|associacao publica|lei 11\.?107)\b/;
const MUNICIPAL_CONTEXT = /\b(municipios?|municipal|municipais|prefeituras?|camaras? municipa(?:l|is)|poder executivo)\b/;
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
      /\b(cria|criado|institui|formaliza|constitui)\s+(?:(?:o|um|novo)\s+)?consorcio/,
      /\b(criacao|constituicao)\s+(?:de|do|de um|do novo)\s+consorcio/,
      /\bnovo consorcio\b/,
    ],
  },
  {
    category: 'ADESÃO', emoji: '🟦', weight: 7, priority: 80, requiresPublicContext: true,
    patterns: [
      /\b(adesao|ingresso|integracao|filiacao|inclusao)\b.{0,130}\b(ao |no )?consorcio/,
      /\bmunicipio\b.{0,90}\b(?:foi\s+)?autorizad[oa]\s+a\s+(?:ingressar|integrar|aderir)\b.{0,100}\bconsorcio/,
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
      /\b(irregularidades?|fraude|suspende|suspendem|condena|fiscaliza)\b.{0,140}\bconsorcio/,
      /\b(suspensao|suspensa|suspenso|suspendeu)\b.{0,160}\bconsorcio/,
      /\bconsorcio\b.{0,160}\b(suspensao|suspensa|suspenso|suspendeu)\b/,
      /\bconsorcio\b.{0,140}\b(irregularidades?|fraude|desvio|improbidade|contas rejeitadas)\b/,
      /\b(tribunal de contas|ministerio publico|tce|tcu)\b.{0,80}\b(fiscaliza|suspende|determina|condena|julga|investiga|aponta|recomenda)\b.{0,120}\bconsorcio/,
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
      /\bratifica\s+o\s+estatuto\s+consolidado\s+do\s+consorcio/,
      /\b(alteracoes|consolidacao)\b.{0,160}\b(contrato de consorcio|estatuto)/,
      /\b(ratificacao|consolidacao)\b.{0,120}\balteracao\b.{0,100}\bprotocolo de intencoes/,
      /\bassembleia\b.{0,120}\bconsorcio/,
      /\beleicao\b.{0,100}\bconsorcio/,
      /\bconsorcio\b.{0,100}\b(novo presidente|nova diretoria|eleito|eleita)\b/,
      /\b(elege|elegeu|eleicao|nova presidencia|nova diretoria)\b.{0,140}\bconsorcio/,
      /\bconsorcio\b.{0,140}\b(elege|elegeu|nova presidencia)\b/,
    ],
  },
  {
    category: 'ATUAÇÃO', emoji: '📰', weight: 4, priority: 40, requiresPublicContext: true,
    patterns: [
      /\bresolucao\s+n[º°.]?\s*\d+\/20\d{2}\s+dispoe\s+sobre\s+os\s+procedimentos\s+de\s+inspecao/,
      /\bconsorcio\b.{0,120}\b(inaugura|lanca|investe|aprova|assina|recebe|amplia|implanta|firmou|firma|assinou|inaugurou|ampliou)\b/,
      /\bextrato\s+do\s+contrato\s+de\s+prestacao\s+de\s+servicos\b.{0,350}\bpartes\s*:\s*o\s+municipio\b.{0,160}\bconsorcio/,
      /\b(inaugura|lanca|investe|aprova|assina|recebe|amplia|implanta)\b.{0,120}\bconsorcio/,
      /\bconsorcio\b.{0,100}\b(cria agenda|articula investimentos|estabelece agenda)\b/,
    ],
  },
];

const NEGATIVE_PATTERNS = [
  { pattern: /\b(processo seletivo|concurso publico|inscricoes abertas|vagas de emprego)\b/, penalty: 30, reason: 'recrutamento sem evento institucional' },
  { pattern: /\badesao (a|de|em) (a )?(ata|atas|arp)( de registro de precos)?\b/, penalty: 30, reason: 'adesão a ata de preços' },
  { pattern: /\badesao\b.{0,240}\bcredenciamento\b/, penalty: 30, reason: 'adesão a credenciamento de serviços, não ao consórcio' },
  { pattern: /\b(ata de registro de precos|registro de precos|intencao de registro de precos|orgao nao participante)\b/, penalty: 30, reason: 'contratação/ata de preços' },
  { pattern: /\bcarona\b.{0,100}\b(ata|registro de precos|arp)\b/, penalty: 30, reason: 'carona em ata de preços' },
  { pattern: /\b(consorcio de empresas|consorcio empresarial|consorcio vencedor|empresa consorciada)\b/, penalty: 30, reason: 'consórcio empresarial' },
  { pattern: /\bconsorcio cesgranrio\b/, penalty: 30, reason: 'consórcio de entidades contratadas, não intermunicipal' },
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
  const limit = item.kind === 'gazette' ? 1200 : 1800;
  const source = excerpts.length ? excerpts : [item.rawText || item.summary || ''];
  return source.flatMap((segment) => {
    const text = normalizeWhitespace(segment);
    if (!text) return [];
    if (text.length <= limit) return [text];
    const windows = [];
    const overlap = 250;
    for (let start = 0; start < text.length; start += limit - overlap) {
      windows.push(text.slice(start, start + limit));
      if (start + limit >= text.length) break;
    }
    return windows;
  });
}

function hasPublicContext(text) {
  return PUBLIC_CONTEXT.test(text) || (CONSORTIUM.test(text) && MUNICIPAL_CONTEXT.test(text));
}

function isGenericBudgetProvision(text) {
  const explicitContract = /\b(contrato n\.?\s*\d+|celebram.{0,160}consorcio|objeto.{0,160}repasse|clausula\s+(?:[a-z]+|\d+).{0,180}contrato de rateio)\b/.test(text);
  return (
    /\bnao se aplicam a?s? disposicoes\b.{0,160}\brecursos entregues a consorcios publicos mediante contrato de rateio\b/.test(text) ||
    /\brateio do consorcio intermunicipal\b.{0,100}\b(servicos medicos|despesas|pagamentos|fornecedores)\b/.test(text) ||
    /creditos? de consorcios publicos decorrentes de contrato de rateio\b/.test(text) ||
    /\bparticipacao em consorcio publico\s*-\s*execucao de contrato de rateio\b/.test(text) ||
    /\b(demonstrativo da despesa com pessoal|despesa bruta com pessoal|rgf.anexo)\b/.test(text) ||
    /\b(valores transferidos por contrato de rateio)\b.{0,180}\b(despesas empenhadas|despesas liquidadas|despesas pagas|despesas executadas)\b/.test(text) ||
    /\bdespesas com acoes e servicos publicos de saude\b.{0,120}\bexecutadas em consorcio publico\b/.test(text) ||
    /\b(credito adicional suplementar|aberto credito adicional)\b.{0,650}\b(rateio|consorcio)\b/.test(text) ||
    /\bdeverao ser discriminadas em acoes orcamentarias especificas\b.{0,350}\bcontrato de rateio\b/.test(text) ||
    /\btransferencias? a consorcios intermunicipais de saude mediante contrato de rateio\b/.test(text) ||
    /\btransferencia de recursos para consorcios publicos em decorrencia de contrato de rateio\b/.test(text) ||
    /\bnao se aplicam as disposicoes\b.{0,160}\brecursos entregues a consorcios publicos mediante contrato de rateio\b/.test(text) ||
    (/\brateio do consorcio\b/.test(text) && /\b(subvencao social|termo de colaboracao|financiamento)\b/.test(text) && !explicitContract) ||
    /\blei orcamentaria\b.{0,500}\b(consorcios publicos|contrato de rateio)\b/.test(text) ||
    /\breservara recursos\b.{0,350}\bcontrato de rateio\b/.test(text) ||
    (/\brateio pela participacao em consorcio publico\b/.test(text) && !explicitContract)
  );
}

function isUnapprovedEntryProposal(text) {
  return /\bproposta (?:para|de) (?:ingresso|adesao|integracao)\b/.test(text) &&
    !/\b(lei|resolucao|decreto)\b.{0,120}\b(aprova|aprovou|autoriza|autorizou)\b.{0,140}\bproposta\b/.test(text) &&
    !/\bproposta\b.{0,160}\b(foi aprovada|aprovada|foi autorizada|autorizada)\b/.test(text);
}

function isPendingEntryVote(text) {
  return /\b(vota|votara|sera analisad[oa]|para discutir e votar)\b.{0,130}\b(adesao|ingresso|participacao|ratifica)\b/.test(text) &&
    /\b(caso aprovado|se aprovado|sera analisad[oa]|votacao prevista)\b/.test(text) &&
    !/\b(aprovou|foi aprovad[oa]|sancionou|promulgou)\b/.test(text);
}

function isHypotheticalCreation(text) {
  return /\b(questiona|questionou|eventual|possivel|hipotetica|necessidade de)\b.{0,85}\bcriacao de (?:um |novo )?consorcio\b/.test(text) &&
    !/\b(lei|protocolo de intencoes|ato constitutivo)\b.{0,110}\b(cria|institui|constitui|formaliza)\b/.test(text) &&
    !/\b(foi criado|foi constituido|consorcio constituido)\b/.test(text);
}

function isMeetingAgendaWithoutDecision(text) {
  const agendaSignal = /\b(convoca|convocam|convocar|convocacao|reuniao|pauta|assuntos abordados|informes gerais)\b/.test(text);
  const decisionSignal = /\b(lei|decreto|autoriza|ratifica|aprovou|sanciona|promulga|delibera|eleitos?|eleitas?|elegeu|elege|eleicao|determinou|decidiu|referendou|suspensao|suspendeu|suspensa|suspenso)\b/.test(text);
  return agendaSignal && !decisionSignal;
}

function isContractTerminationNotConsortium(text) {
  return /\b(extincao|rescisao|encerramento)\s+(amigavel\s+)?(?:(do|de)\s+)?contrato\b/.test(text) &&
    !/\b(extincao|dissolucao|liquidacao)\s+(do|de)\s+consorcio\b/.test(text);
}

// O Google Notícias pode republicar o endereço de um PDF antigo com data de
// indexação recente. Só usamos o ano explícito de um ato numerado no começo
// do título; uma notícia atual que comenta uma lei antiga não entra aqui.
// Alguns índices antepõem a data do próprio ato: "14/03/2022 - LEI Nº559-2022".
export function isStaleLegislativeDocument(item) {
  if (item.kind !== 'news' || !item.publishedAt) return false;
  const publicationYear = new Date(item.publishedAt).getUTCFullYear();
  if (!Number.isFinite(publicationYear)) return false;
  const title = normalizeForMatch(item.title || '');
  const match = /^(?:(\d{1,2}[/-]\d{1,2}[/-]20\d{2})\s*[-–—:]\s*)?(?:projeto de lei|lei|decreto|resolucao|portaria)\s*(?:n(?:[º°o]|r)?\.?\s*)?\d{1,6}\b.{0,45}\b(20\d{2})\b/.exec(title);
  if (!match) return false;
  const actYear = Number(match[2]);
  const dateYear = match[1] ? Number(match[1].slice(-4)) : actYear;
  return publicationYear - actYear >= 2 && publicationYear - dateYear >= 2;
}

function evaluateSegment(item, evidence, index) {
  const title = normalizeForMatch(item.title);
  const entityContext = item.entityName && item.entityAlias &&
    normalizeForMatch(`${item.title || ''} ${evidence}`).includes(normalizeForMatch(item.entityAlias))
    ? item.entityName : '';
  const text = normalizeForMatch(`${item.title || ''} ${evidence} ${entityContext}`);
  const eventText = entityContext ? text.replaceAll(normalizeForMatch(item.entityAlias), 'consorcio') : text;
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
    const matchCount = rule.patterns.filter((pattern) => pattern.test(eventText)).length;
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

  if (selected.category === 'ADESÃO' && /\bratifica(?:do|cao)?\b.{0,90}\balteracao do protocolo de intencoes\b/.test(text) &&
    !/\b(nova adesao|novo ingresso|autoriza a adesao|autoriza o ingresso|passa a integrar)\b/.test(text)) {
    selected = RULES.find((rule) => rule.category === 'GOVERNANÇA');
    reasons.push('alteração de protocolo sem ingresso novo comprovado');
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
  if (/\bmodalidade(?:s)? de aplicacao\s*\d+\b/.test(text) &&
    /\bexecucao orcamentaria delegada a consorcios publicos\b/.test(text)) {
    score -= 30;
    reasons.push('rejeitado: lista de modalidades orçamentárias');
  }
  if (isMeetingAgendaWithoutDecision(text)) {
    score -= 12;
    reasons.push('rejeitado: agenda sem deliberação');
  }
  if (isUnapprovedEntryProposal(text)) {
    score -= 12;
    reasons.push('rejeitado: proposta de ingresso sem decisão comprovada no trecho');
  }
  if (isPendingEntryVote(text)) {
    score -= 20;
    reasons.push('rejeitado: votação de ingresso ainda prevista, sem resultado');
  }
  if (isHypotheticalCreation(text)) {
    score -= 30;
    reasons.push('rejeitado: criação apenas questionada ou hipotética');
  }
  if (isContractTerminationNotConsortium(text)) {
    score -= 30;
    reasons.push('rejeitado: término de contrato, não do consórcio');
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
  const articleUrl = item.articleUrl || item.url || '';
  const documentText = normalizeForMatch(`${item.title || ''} ${item.rawText || item.summary || item.excerpts?.join(' ') || ''}`);
  if (/\b(?:materia\s*:\s*|tipo\s*:\s*req\s*-\s*)requerimento\b.{0,250}\b(?:solicita|requer)\b/.test(documentText)) {
    return { category: 'GERAL', emoji: '📰', score: 0,
      stage: 'requerimento; ato de ingresso não comprovado',
      reasons: ['rejeitado: requerimento solicita providência, não a executa'], evidenceIndex: -1,
      evidenceText: '', publicContext: false, strongPublicContext: false };
  }
  if (item.kind === 'news' && /\/@@search(?:\?|$)|[?&](?:SearchableText|b_start:int)=/i.test(articleUrl)) {
    return { category: 'GERAL', emoji: '📰', score: 0,
      reasons: ['rejeitado: página de busca, não documento individual'], evidenceIndex: -1,
      evidenceText: '', publicContext: false, strongPublicContext: false };
  }
  if (isStaleLegislativeDocument(item)) {
    return { category: 'GERAL', emoji: '📰', score: 0,
      reasons: ['rejeitado: ato antigo com data recente de indexação'], evidenceIndex: -1,
      evidenceText: '', publicContext: false, strongPublicContext: false };
  }
  const classifications = evidenceSegments(item).map((evidence, index) => evaluateSegment(item, evidence, index));
  if (!classifications.length) {
    return { category: 'GERAL', emoji: '📰', score: 0, reasons: ['rejeitado: sem texto para classificação'], evidenceIndex: -1, evidenceText: '', publicContext: false, strongPublicContext: false };
  }
  return refineEventProof(item, classifications.sort((left, right) => right.score - left.score)[0]);
}

export function isPublishableClassification(classification, minimumScore = 5) {
  return classification.category !== 'GERAL' && classification.score >= minimumScore;
}

export { RULES, NEGATIVE_PATTERNS, evidenceSegments };
