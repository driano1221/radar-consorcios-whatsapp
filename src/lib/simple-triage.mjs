import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { classifyItem } from './classifier.mjs';
import { AI_PROMPT_VERSION } from './ai-review.mjs';
import { locateQuote } from './quote-evidence.mjs';

export const TRIAGE_VERSION = 2;
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

// Falta de leitura é trabalho do bot. Só conflitos documentais chegam à revisão humana.
export function decideSimpleTriage(item) {
  if (!item.editorialDecision && (item.triage?.retroactive && item.triage.status !== 'processando' || !item.rawText && item.triage?.version >= 1 && item.triage.status !== 'processando')) return item.triage;
  const body = String(item.rawText || '');
  const rule = item.editorialDecision ? item.classification || classifyItem(item) : item.ruleClassification || item.classification || classifyItem(item);
  const base = { version: TRIAGE_VERSION, category: rule.category || 'GERAL', stage: rule.stage || '',
    ...(item.triage?.retroactive ? {retroactive:true} : {}),
    evidence: '', bodyHash: sha(body), sourceUrl: item.articleUrl || item.url || '' };
  const review = reason => ({ ...base, status: 'revisao', reason, checks: reviewChecks(reason, rule.category) });
  const processing = (reason, nextAction) => ({ ...base, status: 'processando', reason, nextAction, checks: [] });
  const reject = (reason, evidence, method) => ({ ...base, status: 'descartado', reason, evidence, method, checks: [] });
  if (['confirmar_evento', 'corrigir_categoria'].includes(item.editorialDecision))
    return { ...base, status: 'confirmado', evidence: rule.evidenceText || '', reason: 'Revisão documental preservada.', method: 'revisao_documental' };
  if (['nao_evento', 'duplicata', 'desdobrado'].includes(item.editorialDecision))
    return { ...base, status: 'descartado', reason: 'Revisão documental ou separação em atos preservada.', method: 'revisao_documental' };
  if (item.alternativeDecision) return { ...base,
    status: item.catalogDecision === 'confirmado' ? 'confirmado' : item.catalogDecision === 'descartado' ? 'descartado' : 'revisao',
    reason: item.alternativeDecision.reason || 'Decisão por fonte alternativa preservada.', method: 'fonte_alternativa' };
  if (/\/(?:category|categoria|tag)\/|\/(?:noticias|news)\/?(?:[?#]|$)/i.test(base.sourceUrl))
    return reject('Página de listagem usada apenas para descoberta; as notícias individuais têm decisão própria.', base.sourceUrl, 'filtro_de_listagem');
  if (item.duplicatePublication) return processing('Comparar automaticamente a publicação com a versão já arquivada.', 'conferir_duplicata');
  if ((rule.reasons || []).some(r=>/rejeitado: ato antigo com data recente de indexação/.test(r)))
    return reject('Ato antigo reapareceu com data recente de indexação; não é notícia nova.', item.title, 'filtro_de_data');
  const screening = `${item.title || ''} ${body || item.summary || ''}`;
  if (rule.category === 'GERAL' && !item.aiReview && !item.entityName &&
      !/cons[oó]rci|rateio|protocolo de inten[cç][oõ]es|\bCIS[A-Z]{2,}\b/i.test(screening) &&
      item.kind === 'news' && !/news\.google\.com/.test(item.url || '') && screening.length >= 160)
    return reject('Triagem de escopo: título e texto disponível não indicam consórcio ou ato das sete categorias.',
      (body || item.summary).slice(0, 500), 'filtro_de_escopo');
  if (/\b(?:abre sele[cç][aã]o|concurso\b.*\bprovas aplicadas)\b/i.test(item.title || '') && rule.category === 'GERAL' && !rule.proofKind)
    return reject('Seleção de pessoal; não há composição municipal ou mudança institucional comprovada.', item.title, 'filtro_de_escopo');
  if (body.length < 160 || item.extractionError) return processing('Obter o texto original antes de decidir; falha de leitura não é dúvida para revisão humana.', 'recuperar_texto');
  const ai = item.aiReview;
  const quote = ai && locateQuote(ai.evidence, [body]);
  // O extrator delimita janelas por caracteres; retire só as palavras cortadas nas bordas.
  const literalRule = locateQuote(rule.evidenceText, [body]) ||
    locateQuote(String(rule.evidenceText || '').split(/\s+/).slice(1, -1).join(' '), [body]);
  if (rule.documentConflict) return { ...review(rule.documentConflict.reason), evidence:body.slice(0,1300), checks: rule.documentConflict.checks };
  // A published rule or operative legal ratification is itself the fact. A
  // generic older AI interpretation must not turn it into accession/control,
  // or require human rereading solely because the regulation is lengthy.
  if (literalRule && ['published_inspection_rule','published_governance_rule','ratified_protocol','documentary_exclusion',
    'legal_entry_authorization','approved_legislative_project','public_service_agreement','court_notice','consortium_budget_act','recorded_receipt',
    'documented_rateio','performed_institutional_activity','reported_ongoing_work','signed_cooperation','signed_municipal_protocol','documented_composition','court_decision','ratified_statute'].includes(rule.proofKind))
    return { ...base, status: rule.category==='GERAL'?'descartado':'confirmado', evidence:literalRule,
      reason: rule.reason || rule.reasons?.at(-1) ||
        'Ato documental identificado por regra específica; confirmada somente a publicação ou ratificação, com sua etapa explícita.',
      method:'regra_documental_especifica' };
  if ((item.previewOnly || item.discoveryOnly) && rule.category !== 'GERAL') return processing('Homologar a leitura original; a fonte em prévia não é dúvida documental do usuário.', 'homologar_leitura');
  if (ai?.status === 'disputed') return review(`As leituras discordam sobre ${rule.category}: ${ai.reason || 'conferir os trechos e a etapa do ato'}.`);
  if (ai && ai.promptVersion !== AI_PROMPT_VERSION) return processing('Atualizar a segunda leitura guardada antes de decidir.', 'segunda_leitura');
  if (ai && !quote) return processing('Conferir novamente a citação da segunda leitura no documento original.', 'segunda_leitura');
  if (ai?.status === 'approved') {
    if (!categoryGroup(rule.category) || (rule.score || 0) < 5)
      return processing('A segunda leitura aprovou, mas ainda falta delimitar a prova do ato na regra atual.', 'delimitar_ato');
    if (ai.category !== rule.category && !ai.boundedBy)
      return review(`Classificações divergentes: regra ${rule.category}; segunda leitura ${ai.category}.`);
    if (body.length > 24000) return processing('Delimitar o ato no documento extenso antes de concluir; não usar leitura truncada.', 'delimitar_ato');
    return { ...base, status: 'confirmado', evidence: rule.proofKind === 'documented_rateio' && literalRule ? literalRule : quote,
      reason: 'Texto original lido; regra e segunda leitura concordam, com evidência literal.', method: 'regra_e_ia_em_cache' };
  }
  const rejection = (rule.reasons || []).find(r => r.startsWith('rejeitado:'));
  const routineInstallation = /contrata[cç][aã]o\s+de\s+empresa\b[\s\S]{0,100}instala[cç][aã]o[\s\S]{0,90}ar[-\s]condicionado/i.exec(body);
  if (rule.category === 'GERAL' && body.length <= 6000 && routineInstallation)
    return { ...base, status: 'descartado', evidence: routineInstallation[0],
      reason: 'Contratação rotineira de fornecedor para instalar ar-condicionado; não comprova fato das categorias do radar.', method: 'regra_documental_exclusao' };
  if (rule.category === 'GERAL' && !ai?.status)
    return reject(rejection || 'Texto original examinado: não foi identificado ato das sete categorias; menção ao consórcio não basta.',
      literalRule || body.slice(0, 500), rejection ? 'regra_com_prova' : 'leitura_sem_evento');
  if (ai?.status === 'rejected') {
    if (rule.category !== 'GERAL' && (rule.score || 0) >= 5)
      return review('A regra encontra um evento, mas a segunda leitura rejeita: precisamos definir o enquadramento.');
    return { ...base, status: 'descartado', evidence: quote, reason: 'Regra e segunda leitura rejeitam o conteúdo examinado.', method: 'regra_e_ia_em_cache' };
  }
  return processing('Concluir a leitura automática e delimitar a prova antes da decisão.', 'segunda_leitura');
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
  const groups = await Promise.all(['triagem-originais.ndjson', 'triagem-reprocessada.ndjson'].map(async name => {
    try { return (await readFile(path.join(directory, name), 'utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse); }
    catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  }));
  const rows = groups.flat();
  if (!rows.length) return new Map();
  const ids = new Set(rows.map(r => r.documentId));
  const hashes = new Map((await readFile(path.join(directory, 'textos-artigos.ndjson'), 'utf8'))
    .split(/\r?\n/).filter(Boolean).map(JSON.parse).filter(t => ids.has(t.documento_id))
    .map(t => [t.documento_id, sha(t.texto || '')]));
  return new Map(rows.map(d => [d.documentId, { ...d, bodyMatches: d.bodyHash === (hashes.get(d.documentId) || sha('')) }]));
}
export function validOriginalTriage(row, decision) {
  return [1, TRIAGE_VERSION].includes(decision?.version) && decision.documentId === row.id &&
    decision.rowHash === rowFingerprint(row) && (decision.status === 'processando' || decision.bodyMatches !== false) && decision.retroactive === true &&
    ['confirmado', 'descartado', 'revisao', 'processando'].includes(decision.status) && Boolean(decision.reason) &&
    (['revisao', 'processando'].includes(decision.status) || Boolean(decision.evidence));
}
