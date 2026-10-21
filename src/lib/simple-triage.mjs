import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { classifyItem } from './classifier.mjs';
import { AI_PROMPT_VERSION } from './ai-review.mjs';
import { locateQuote } from './quote-evidence.mjs';

export const TRIAGE_VERSION = 1;
export const CATEGORY_FAMILIES = ['CRIAÇÃO', 'ADESÃO', 'SAÍDA', 'RATEIO', 'PROTOCOLO', 'CRISE', 'ATUAÇÃO'];
export function categoryGroup(category = '') {
  if (['GOVERNANÇA', 'FINANÇAS', 'CONTROLE', 'COOPERAÇÃO AUTORIZADA', 'AÇÃO'].includes(category)) return 'ATUAÇÃO';
  if (/^(?:PROPOSTA DE )?ADESÃO/.test(category)) return 'ADESÃO';
  return CATEGORY_FAMILIES.find(group => category === group || category.startsWith(group + ' ')) || '';
}
export function categoryLabel(category = '') {
  if (!category || category === 'GERAL' || category === 'NÃO CLASSIFICADO') return 'Enquadramento a definir';
  const detail = { GOVERNANÇA: 'Governança', FINANÇAS: 'Finanças', CONTROLE: 'Controle/Fiscalização',
    'COOPERAÇÃO AUTORIZADA': 'Cooperação autorizada' }[category];
  return detail ? `Atuação · ${detail}` : category;
}
const sha = value => createHash('sha256').update(value).digest('hex');
export const rowFingerprint = row => sha(JSON.stringify([row.id, row.url, row.titulo, row.trecho || '']));

// A decisão é sobre conteúdo lido; acesso bloqueado e divergência são revisão, nunca irrelevância.
export function decideSimpleTriage(item) {
  if (item.triage?.retroactive || !item.rawText && item.triage?.version === TRIAGE_VERSION) return item.triage;
  const body = String(item.rawText || '');
  const rule = item.ruleClassification || item.classification || classifyItem(item);
  const base = { version: TRIAGE_VERSION, category: rule.category || 'GERAL', stage: rule.stage || '',
    evidence: '', bodyHash: sha(body), sourceUrl: item.articleUrl || item.url || '' };
  const review = reason => ({ ...base, status: 'revisao', reason, checks: reviewChecks(reason, rule.category) });
  if (['confirmar_evento', 'corrigir_categoria'].includes(item.editorialDecision))
    return { ...base, status: 'confirmado', evidence: rule.evidenceText || '', reason: 'Revisão documental preservada.', method: 'revisao_documental' };
  if (['nao_evento', 'duplicata', 'desdobrado'].includes(item.editorialDecision))
    return { ...base, status: 'descartado', reason: 'Revisão documental ou separação em atos preservada.', method: 'revisao_documental' };
  if (item.alternativeDecision) return { ...base,
    status: item.catalogDecision === 'confirmado' ? 'confirmado' : item.catalogDecision === 'descartado' ? 'descartado' : 'revisao',
    reason: item.alternativeDecision.reason || 'Decisão por fonte alternativa preservada.', method: 'fonte_alternativa' };
  if (item.duplicatePublication) return review('A mesma publicação original aparece em outros registros; comparar as versões antes de contar um novo fato.');
  if (/\/(?:category|categoria|tag)\//i.test(base.sourceUrl))
    return review('A fonte é uma listagem de notícias; localizar a publicação individual e conferir duplicidade.');
  if (body.length < 160) return review('Falta íntegra verificável para decidir.');
  if (item.previewOnly || item.discoveryOnly) return review('Fonte ainda sem leitura homologada para decisão automática.');
  const ai = item.aiReview;
  const quote = ai && locateQuote(ai.evidence, [body]);
  // O extrator delimita janelas por caracteres; retire só as palavras cortadas nas bordas.
  const literalRule = locateQuote(rule.evidenceText, [body]) ||
    locateQuote(String(rule.evidenceText || '').split(/\s+/).slice(1, -1).join(' '), [body]);
  if (ai?.status === 'disputed') return review('As leituras discordam sobre o fato ou sua classificação.');
  if (ai && ai.promptVersion !== AI_PROMPT_VERSION) return review('A segunda leitura guardada usa uma política anterior.');
  if (ai && !quote) return review('A evidência da segunda leitura não foi localizada no corpo original.');
  if (ai?.status === 'approved') {
    if (!categoryGroup(rule.category) || (rule.score || 0) < 5)
      return review('A segunda leitura aprovou, mas a regra atual não comprova o evento.');
    if (ai.category !== rule.category && !ai.boundedBy)
      return review(`Classificações divergentes: regra ${rule.category}; segunda leitura ${ai.category}.`);
    if (body.length > 24000) return review('Documento extenso: conferir o ato e a página, sem decidir por leitura truncada.');
    return { ...base, status: 'confirmado', evidence: rule.proofKind === 'documented_rateio' && literalRule ? literalRule : quote,
      reason: 'Texto original lido; regra e segunda leitura concordam, com evidência literal.', method: 'regra_e_ia_em_cache' };
  }
  const rejection = (rule.reasons || []).find(r => r.startsWith('rejeitado:'));
  const routineInstallation = /contrata[cç][aã]o\s+de\s+empresa\b[\s\S]{0,100}instala[cç][aã]o[\s\S]{0,90}ar[-\s]condicionado/i.exec(body);
  if (rule.category === 'GERAL' && body.length <= 6000 && routineInstallation)
    return { ...base, status: 'descartado', evidence: routineInstallation[0],
      reason: 'Contratação rotineira de fornecedor para instalar ar-condicionado; não comprova fato das categorias do radar.', method: 'regra_documental_exclusao' };
  if (rule.category === 'GERAL' && rejection && literalRule && body.length <= 24000)
    return { ...base, status: 'descartado', evidence: literalRule,
      reason: rejection || 'O texto integral examinado não comprova ocorrência relacionada ao escopo do radar.', method: 'regra_com_prova' };
  if (ai?.status === 'rejected') {
    if (rule.category !== 'GERAL' && (rule.score || 0) >= 5)
      return review('A regra encontra um evento, mas a segunda leitura rejeita: precisamos definir o enquadramento.');
    return { ...base, status: 'descartado', evidence: quote, reason: 'Regra e segunda leitura rejeitam o conteúdo examinado.', method: 'regra_e_ia_em_cache' };
  }
  if (literalRule && ['performed_institutional_activity', 'signed_cooperation', 'signed_municipal_protocol', 'documented_composition', 'court_decision', 'published_inspection_rule', 'ratified_statute', 'documented_rateio'].includes(rule.proofKind))
    return { ...base, status: 'confirmado', evidence: literalRule, reason: 'Ato identificado no corpo por regra documental específica.', method: 'regra_documental' };
  return review('Ainda falta uma regra conclusiva ou segunda leitura válida para este caso.');
}

export function reviewChecks(reason = '', category = '') {
  if (/versões|listagem/.test(reason)) return ['Abrir a notícia individual e comparar com os registros anteriores da mesma fonte.', 'Indicar se há um fato novo ou uma reprodução; enviar o link individual e o trecho que demonstra a diferença.'];
  if (/íntegra|homologada/.test(reason)) return ['Abrir a fonte e localizar o texto integral ou PDF legível.', 'Indicar o trecho e a página que descrevem o ato do consórcio.'];
  if (/extenso/.test(reason)) return ['Localizar o ato específico e informar as páginas de início e fim.', 'Conferir partes, objeto, data e assinaturas; separar cláusulas genéricas do fato ocorrido.'];
  if (category === 'CONTROLE') return ['Identificar órgão fiscalizador, consórcio atingido e decisão efetiva: cautelar, multa, julgamento ou arquivamento.', 'Distinguir decisão de controle de cláusula genérica ou nomeação de fiscal de contrato; citar trecho e página.'];
  if (category === 'GOVERNANÇA') return ['Conferir se houve deliberação, eleição ou alteração institucional efetiva, além de convocação ou minuta.', 'Indicar a decisão aprovada, sua data e o consórcio; copiar o trecho comprobatório.'];
  if (category === 'FINANÇAS') return ['Distinguir autorização orçamentária, compromisso de repasse e pagamento efetivamente declarado.', 'Conferir partes, valor e a que data o documento se refere; copiar o trecho sem presumir execução.'];
  if (category?.startsWith('RATEIO')) return ['Conferir partes públicas, número do instrumento e assinatura; distinguir rateio de contrato com fornecedor.', 'Indicar se é assinatura, aditivo ou etapa para futura formalização; enviar trecho e data, sem presumir pagamento.'];
  if (categoryGroup(category) === 'ADESÃO') return ['Identificar município e consórcio; distinguir proposta, autorização legal e ingresso efetivamente homologado.', 'Copiar o dispositivo ou deliberação e a data; não inferir ingresso apenas por contrato de rateio ou nome em lista.'];
  if (/ATUAÇÃO|norma|enquadramento/.test(reason) || category === 'ATUAÇÃO') return ['Confirmar se há atividade, serviço ou norma efetivamente realizada/publicada pelo consórcio.', 'Dizer se esse tipo de ocorrência deve entrar no radar; citar um trecho literal.'];
  return ['Conferir se o trecho descreve fato efetivo, autorização ou apenas intenção/menção.', 'Informar categoria/etapa correta e copiar o trecho comprobatório, com página se houver.'];
}
export function applySimpleTriage(item) {
  const triage = decideSimpleTriage(item);
  return { ...item, triage, catalogDecision: triage.status,
    classification: { ...item.classification, category: triage.category, stage: triage.stage,
      evidenceText: triage.evidence || item.ruleClassification?.evidenceText || item.classification?.evidenceText || '' } };
}
export async function loadOriginalTriage(directory) {
  let content;
  try { content = await readFile(path.join(directory, 'triagem-originais.ndjson'), 'utf8'); }
  catch (error) { if (error.code === 'ENOENT') return new Map(); throw error; }
  const rows = content.split(/\r?\n/).filter(Boolean).map(JSON.parse);
  const ids = new Set(rows.map(r => r.documentId));
  const hashes = new Map((await readFile(path.join(directory, 'textos-artigos.ndjson'), 'utf8'))
    .split(/\r?\n/).filter(Boolean).map(JSON.parse).filter(t => ids.has(t.documento_id))
    .map(t => [t.documento_id, sha(t.texto || '')]));
  return new Map(rows.map(d => [d.documentId, { ...d, bodyMatches: d.bodyHash === (hashes.get(d.documentId) || sha('')) }]));
}
export function validOriginalTriage(row, decision) {
  return decision?.version === TRIAGE_VERSION && decision.documentId === row.id &&
    decision.rowHash === rowFingerprint(row) && decision.bodyMatches !== false && decision.retroactive === true &&
    ['confirmado', 'descartado', 'revisao'].includes(decision.status) && Boolean(decision.reason) &&
    (decision.status === 'revisao' || Boolean(decision.evidence));
}
