import { normalizeWhitespace } from './text.mjs';
import { institutionalProof } from './institutional-proof.mjs';
import { documentaryCorrection } from './documentary-corrections.mjs';

const CONSORTIUM = 'cons[oó]rcio';
const HYPOTHETICAL_CREATION = new RegExp(
  `(?:question(?:a|ou|ada?)|eventual|poss[ií]vel|hip[oó]tetic[ao]|cogitad[ao]|necessidade de|proposta de)` +
  String.raw`.{0,110}cria[cç][aã]o\s+(?:de\s+)?(?:um\s+)?(?:novo\s+)?${CONSORTIUM}`, 'i');
const FORMAL_CREATION = [
  new RegExp(String.raw`\b(?:lei|decreto|resolu[cç][aã]o)\b.{0,110}\b(?:cria|institui|constitui)\b.{0,90}\b${CONSORTIUM}`, 'i'),
  new RegExp(String.raw`\b${CONSORTIUM}\b.{0,90}\b(?:foi\s+)?(?:criado|constitu[ií]do|institu[ií]do)\b`, 'i'),
  new RegExp(String.raw`\b(?:foi\s+)?(?:criado|constitu[ií]do|institu[ií]do)\b.{0,90}\b${CONSORTIUM}`, 'i'),
];
const PROTOCOL_AMENDMENT = /ratific(?:a|ou|ada|ado|a[cç][aã]o)\s+(?:as?\s+|os?\s+)?(?:altera[cç][aã]o|altera[cç][oõ]es)(?:\s+realizadas?)?\s+(?:do|no|ao)\s+protocolo de inten[cç][oõ]es/i;
const NUMBERED_PROTOCOL = /ratific(?:a|ado|ada|a[cç][aã]o).{0,80}\b(?:[IVX]{2,}|\d+[º°]?)\s+protocolo de inten[cç][oõ]es/i;
const NEW_ENTRY = /\b(?:nova\s+ades[aã]o|novo\s+ingresso|ingresso\s+do\s+munic[ií]pio|ades[aã]o\s+do\s+munic[ií]pio|passa\s+a\s+integrar|foi\s+admitid[oa]|admitiu\s+o\s+munic[ií]pio)\b/i;
const APPROVED_PROJECT = /\b(?:c[aâ]mara|vereadores|legislativo)\b.{0,150}\b(?:aprovou|aprovaram|aprovado)\b.{0,180}\b(?:projeto|ratifica|participa[cç][aã]o|ades[aã]o|ingresso)\b/i;
const FORMAL_AUTHORIZATION = /\b(?:lei|decreto|resolu[cç][aã]o)\b.{0,100}\b(?:autoriza|ratifica)\b.{0,130}\b(?:ingresso|ades[aã]o|participa[cç][aã]o|integrar)\b/i;
const AUTHORIZED_INGRESS = /\b(?:munic[ií]pio\s+de\s+[A-Za-zÀ-ÿ ]{2,65}\s+)?(?:foi\s+)?autorizad[oa]\s+a\s+(?:ingressar|integrar|aderir)\s+(?:no|ao|a[oà])\s+cons[oó]rcio|\b(?:autoriza|(?:fica\s+)?autorizad[oa])\s+(?:o\s+)?ingresso\s+do\s+munic[ií]pio\s+de\s+.{2,65}\s+(?:no|ao)\s+cons[oó]rcio/i;
const AUTHORIZED_ADHESION_TITLE = /\bautoriza\s+(?:a\s+)?ades[aã]o\s+(?:ao|a[oà])\s+cons[oó]rcio/i;
const EXECUTED_RATEIO = /(?:celebram|celebra|celebrad[oa]s?|assinam|assina|assinado|firmam|firma|firmado)\s+(?:(?:o|um|presente)\s+){0,2}contrato\s+de\s+rateio|contrato\s+de\s+rateio\s+(?:foi\s+)?(?:celebrad[oa]s?|assinado|firmado)/i;
const UNAPPROVED_PROPOSAL = /\b(?:projeto|proposta|pretende|poder[aá]|estuda|discute|votar[aá])\b.{0,160}\b(?:ades[aã]o|ingresso|cria[cç][aã]o|constitui[cç][aã]o)\b/i;
const PROPOSED_AMENDMENT = /\bprojeto de lei\b.{0,100}\b(?:pretende|prop[oõ]e|visa)\b.{0,140}\b(?:ratificar|alterar|atualizar)\b.{0,120}\b(?:protocolo|contrato|cons[oó]rcio)\b/i;
const ASSEMBLY_APPROVED_PROTOCOL = /\b(?:consolida[cç][aã]o|altera[cç][oõ]es|novas?\s+ades[oõ]es)\b.{0,150}\baprovad[ao]s?\b.{0,110}\b(?:assembleia|prefeitos|integrantes\s+do\s+cons[oó]rcio)/i;
const CONTROL_DECISION = /\b(?:apontou irregularidade|constatou fraude|determinou suspens[aã]o|condenou|julgou irregular|recomendou a suspens[aã]o)\b/i;
const INTERNAL_INSPECTION_GUIDELINE = /\b(?:instru[cç][aã]o de trabalho|instru[cç][aã]o normativa)\b.{0,180}\b(?:preven[cç][aã]o|combate)\b.{0,80}\bfraude/i;
const APPROVED_CREATION_STEP = /\baprova[cç][aã]o\s+da\s+etapa\s+final\s+para\s+a\s+cria[cç][aã]o\s+(?:do|de um)\s+cons[oó]rcio/i;
const APPROVED_ENTRY_PROPOSAL = [
  /\bproposta\s+(?:para|de)\s+ingresso\b[\s\S]{0,3500}\bcoloca\s+a\s+proposta\s+em\s+vota[cç][aã]o\.\s*aprovada\b/i,
  /\bresolu[cç][aã]o\b.{0,100}\baprova\b.{0,90}\bproposta\s+de\s+ingresso\b/i,
];
const GENERIC_RATEIO_IMPROBITY_CLAUSE = /\bcl[aá]usula\s+(?:doze|12)\b.{0,150}\bconstitui\s+ato\s+de\s+improbidade\b/i;
const SIM_PROCEDURE_RESOLUTION = /\bresolu[cç][aã]o\s+n[º°.]?\s*\d+\/20\d{2}\s+disp[oõ]e\s+sobre\s+os\s+procedimentos\s+de\s+inspe[cç][aã]o/i;
const RATEIO_AUTHORIZATION = [
  /\bautoriza[cç][aã]o\s+para\s+realiza[cç][aã]o\s+de\s+dispensa\s+de\s+licita[cç][aã]o[\s\S]{0,900}\bformaliza[cç][aã]o\s+de\s+contrato\s+de\s+rateio/i,
  /\b(?:fica\s+)?autorizad[oa]\s+(?:a\s+)?dispensa\s+de\s+licita[cç][aã]o[\s\S]{0,900}\b(?:para\s+)?formaliza[cç][aã]o\s+de\s+contrato\s+de\s+rateio/i,
  /\b(?:fica\s+)?autorizad[oa]\s+(?:a\s+)?formaliza[cç][aã]o\s+(?:do|de um)\s+contrato\s+de\s+rateio/i,
];
const AUTHORIZED_TRANSFER = /\b(?:fica\s+)?(?:o\s+)?(?:poder\s+)?executivo(?:\s+municipal)?\s+autorizad[oa]\s+a\s+repassar[\s\S]{0,250}\bcons[oó]rcio/i;
const ELECTION_RESCHEDULED = /\bretifica[cç][aã]o\s+do\s+regulamento\s+eleitoral/i;
const AUTHORIZED_COOPERATION = /\blei\s+n[º°.]?\s*\d+\/20\d{2}[\s\S]{0,300}\bautoriza\s+o\s+poder\s+executivo\s+a\s+firmar\s+conv[eê]nio[\s\S]{0,260}\bcons[oó]rcio/i;
const RATIFIED_STATUTE = /\b(?:ratifica\s+o|fica\s+ratificado(?:,\s*[^.;]{0,100},)?\s+o)\s+estatuto\s+consolidado\s+do\s+cons[oó]rcio/i;
const SERVICE_CONTRACT = /\bextrato\s+do\s+contrato\s+de\s+presta[cç][aã]o\s+de\s+servi[cç]os\s+n[º°.]?\s*\d+\/20\d{2}[\s\S]{0,700}\bpartes\s*:\s*o\s+munic[ií]pio[\s\S]{0,180}\bcons[oó]rcio/i;
const PAICI_WITHHELD = /\binadimpl[eê]ncia\b[\s\S]{0,300}\b(?:munic[ií]pios|incentivo\s+estadual)\b[\s\S]{0,650}\bPAICI\b/i;
const HQ_CONSTRUCTION = /\bnova\s+sede\b.{0,100}\b(?:em\s+fase\s+de\s+constru[cç][aã]o|em\s+constru[cç][aã]o)/i;
const CONSTRUCTION_MILESTONE = /\b(?:assinou\s+(?:a\s+)?ordem\s+de\s+servi[cç]o|iniciou\s+(?:as\s+)?obras|concluiu\s+(?:as\s+)?obras|inaugurou\s+(?:a\s+)?(?:nova\s+)?sede)\b/i;
const FUTURE_ASSEMBLY = /\b(?:realizar[aá]|acontecer[aá])\b.{0,150}\b(?:assembleia|reuni[aã]o|visita\s+t[eé]cnica)|\b(?:assembleia|reuni[aã]o|visita\s+t[eé]cnica)\b.{0,150}\b(?:realizar[aá]|acontecer[aá])/i;
const ACCOUNTS_REJECTED = /\b(?:reprovou|desaprovou|rejeitou)\s+(?:as?\s+)?(?:presta[cç][aã]o\s+de\s+)?contas\s+(?:de\s+20\d{2}\s+)?d[oa]\s+cons[oó]rcio|\bcontas\s+(?:de\s+20\d{2}\s+)?d[oa]\s+cons[oó]rcio\b.{0,100}\b(?:reprovadas|desaprovadas|rejeitadas)/i;
const CALL_OPENED = /\bcons[oó]rcio\b.{0,180}\b(?:(?:abriu|publicou|lan[cç]ou)\s+(?:o\s+|um\s+)?chamamento\s+p[uú]blico|recebe\s+a\s+documenta[cç][aã]o\s+das\s+interessadas)/i;
const SERVICE_INTERRUPTED = /\bcons[oó]rcio\b.{0,190}\b(?:paralisa[cç][aã]o\s+(?:total\s+)?dos\s+servi[cç]os|suspendeu\s+(?:os\s+)?atendimentos|cancelou\s+(?:todas?\s+)?as\s+consultas)/i;
const EQUIPMENT_RECEIVED = /\bcons[oó]rcio\b.{0,110}\brecebeu\s+(?:um\s+|o\s+)?(?:consult[oó]rio|equipamento|ve[ií]culo|ambul[aâ]ncia)\b/i;
const APPROVED_EXIT_STEP = /\b(?:aprovado|aprovou|aprovada|autoriza[cç][aã]o)\b.{0,100}\b(?:fim\s+da\s+ades[aã]o|deixe\s+um\s+cons[oó]rcio|subscrever\s+a\s+extin[cç][aã]o\s+d[oa]\s+cons[oó]rcio)/i;
const PROGRAM_LAUNCH = /\bcons[oó]rcio\b.{0,150}\blan[cç](?:a|ou)\b.{0,90}\b(?:o\s+)?programa\b/i;

function literalEvidence(text, patterns, before = 100, after = 260) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (!match) continue;
    const start = Math.max(0, match.index - before);
    const end = Math.min(text.length, match.index + match[0].length + after);
    return { text: text.slice(start, end).trim(), offset: start };
  }
  return null;
}

function withEvidence(result, evidence) {
  return evidence ? { ...result, evidenceText: evidence.text, evidenceOffset: evidence.offset } : result;
}

// Esta camada faz inferências conservadoras sobre a etapa do ato. Não declara
// ingresso efetivado apenas porque o município aparece em anexo ou assinou rateio.
export function refineEventProof(item, classification) {
  const text = normalizeWhitespace(item.rawText || item.summary || item.excerpts?.join(' ') || '');
  const title = normalizeWhitespace(item.title || '');
  const correction = item.rawText && documentaryCorrection(title, text);
  if (correction) return { ...classification, ...correction,
    emoji: correction.category === 'PROTOCOLO' ? '🟨' : correction.category === 'GOVERNANÇA' ? '🟨' : '📰',
    score: correction.category === 'GERAL' ? 0 : Math.max(5, classification.score || 0),
    reasons: [correction.reason] };
  const operationalInstruction = /\b(?:instru[cç][aã]o normativa|instru[cç][aã]o de trabalho)\s+n[º°o.]?\s*\d+/i;
  const instructionHeader = operationalInstruction.test(title) ||
    /^\[Página 1\]/.test(text) && operationalInstruction.test(text.slice(0, 400));
  if (instructionHeader && /\bservi[cç]o\s+de\s+inspe[cç][aã]o\s+municipal\b/i.test(text) &&
      /\b(?:estabelece|estabelecer|procedimentos|programa)\b/i.test(text.slice(0, 1200)) &&
      !/\bart\.?\s*1[º°o.]?\b.{0,180}\b(?:altera|ratifica|aprova)\b.{0,100}\b(?:estatuto|protocolo de inten[cç][oõ]es)\b/i.test(text)) {
    return withEvidence({ ...classification, category: 'ATUAÇÃO', emoji: '📰', proofKind: 'published_inspection_rule',
      score: Math.max(5, classification.score || 0),
      stage: 'norma operacional de inspeção publicada; não comprova fiscalização realizada nem alteração constitutiva',
      reasons: ['norma técnica de inspeção; protocolo citado no preâmbulo é fundamento, não objeto de alteração'] },
    literalEvidence(text, [operationalInstruction], 0, 450));
  }
  const rateioSignature = /\b(?:local\s*\/\s*)?data\s*(?:da|de)\s*assinatura(?:\s+do\s+aditivo)?\s*:\s*[^.;]{0,45}?(?:\d{2}\/\d{2}\/20\d{2}|\d{1,2}\s+de\s+[a-zç]+\s+de\s+20\d{2})/i;
  const rateioSigned = /\bcontratos?\s+de\s+rateio\s*,?\s*firmados?\s+entre\b/i;
  if (text.length < 12000 && !/\b(?:minuta|modelo)\b/i.test(title) &&
    /\bcontratos?\s+de\s+rateio\b/i.test(title) && /\bcons[oó]rcio\b/i.test(text) &&
    /\bmunic[ií]pio(?:s)?\b/i.test(text) && (rateioSignature.test(text) || rateioSigned.test(text))) {
    return withEvidence({ ...classification, category:'RATEIO', proofKind: 'documented_rateio', score:Math.max(5,classification.score || 0),
      stage: /\b(?:termo\s+aditivo|aditivo\s+ao)\b/i.test(title)
        ? 'aditivo ao rateio formalizado em extrato; não comprova pagamento ou novo ingresso'
        : 'rateio firmado em extrato publicado; não comprova pagamento ou novo ingresso',
      reasons: [...classification.reasons, 'extrato de rateio com partes públicas e assinatura ou declaração expressa de celebração'] },
    literalEvidence(text, [rateioSigned, rateioSignature], 100, 240));
  }
  // Historical recovery may have only a generic search title. Require evidence
  // in the document body and preserve the legal stage, not the index date.
  const approvedAutograph = /\baut[oó]grafo\s+n[º°o.]?\s*\d+\/\d{4}\b.{0,650}\baprovado\s+em\s+sess[aã]o\b/i;
  if (approvedAutograph.test(text) && /\bconstitui[cç][aã]o de cons[oó]rcio p[uú]blico\b/i.test(text) &&
    /\banexo\s*[-–—]\s*minuta\b/i.test(text)) {
    return withEvidence({ ...classification, category: 'PROTOCOLO', emoji: '🟨', score: Math.max(5, classification.score || 0),
      stage: 'projeto aprovado e autógrafo encaminhado; sanção, assinatura e constituição não comprovadas',
      reasons: ['autógrafo aprovado com minuta anexa; não é prova de constituição consumada'] },
    literalEvidence(text, [approvedAutograph], 0, 80));
  }
  const retainedMember = /\b(?:autoriza|autorizad[oa])\s+[aà]\s+perman[eê]ncia\b.{0,190}\b(?:ente consorciado|cons[oó]rcio)/i;
  const contractAmendment = /\b(?:ratifica|ratificado)\b.{0,60}\baltera[cç][aã]o\b.{0,70}\bcontrato\b.{0,50}\bcons[oó]rcio/i;
  if (retainedMember.test(text) && contractAmendment.test(text) &&
    /\b(?:lei municipal|promulga a seguinte\s*lei)\b/i.test(text)) {
    return withEvidence({ ...classification, category: 'GOVERNANÇA', emoji: '⬛', score: Math.max(5, classification.score || 0),
      stage: 'ratificação de alteração e permanência; ingresso original e novo rateio não comprovados',
      participationEvidence: true, reasons: ['permanência expressa em lei, não adesão nova nem contrato de rateio celebrado'] },
    literalEvidence(text, [retainedMember], 0, 150));
  }
  const authorizedProtocol = /\bautoriza(?:do)?\b.{0,110}\bratificar\s+(?:o\s+)?protocolo de inten[cç][oõ]es\s+para\s+(?:a\s+)?constitui(?:r|[cç][aã]o)\s+(?:de\s+|o\s+)?cons[oó]rcio p[uú]blico/i;
  if (authorizedProtocol.test(text) && /\blei municipal\b/i.test(text) &&
    !/\bassembleia\s+(?:geral\s+)?de\s+constitui[cç][aã]o\b.{0,80}\b(?:realizada|ocorreu)\b/i.test(text)) {
    return withEvidence({ ...classification, category: 'PROTOCOLO', emoji: '🟨', score: Math.max(5, classification.score || 0),
      stage: 'lei de autorização/ratificação de protocolo; constituição operacional não comprovada',
      reasons: ['etapa legal de protocolo; não inferir consórcio já constituído ou em operação'] },
    literalEvidence(text, [authorizedProtocol], 0, 150));
  }
  const approvedCofunding = /\bfoi aprovad[oa]\b.{0,100}\bautorizar o cofi\s*-?\s*nanciamento pelos munic[ií]pios consorciados\b/i;
  if (/\bATA\s+N[º°o.]\s*\.?\s*\d+\/\d{4}\s+DA REUNI[AÃ]O\b/i.test(text) &&
    /\bcons[oó]rcio p[uú]blico\b/i.test(text) && approvedCofunding.test(text)) {
    return withEvidence({ ...classification, category: 'FINANÇAS', emoji: '💰', score: Math.max(5, classification.score || 0),
      stage: 'assembleia autorizou cofinanciamento; pagamento e assinatura de aditivo não comprovados',
      reasons: ['ata registra deliberação financeira dos municípios; não equivale a pagamento executado'] },
    literalEvidence(text, [approvedCofunding], 30, 250));
  }
  // Só aplicar a atos individualizados: uma edição pode ter dezenas de
  // processos e não pode herdar a identidade ou o resultado de um deles.
  const processHeaders = [...text.matchAll(/\bProcesso\s+n[º°o]?\s*:\s*\d+/gi)];
  const head = text.split(/\bEMENTA\s*:/i)[0];
  const courtAct = processHeaders.length === 1 && /\bMPTC\s*:/i.test(head) &&
    /\bRelator\s*:/i.test(head) && /\bSess[aã]o\s*:\s*\d/i.test(head) &&
    /\b(?:Denunciad[oa]s?|Interessados?)\s*:\s*Cons[oó]rcio\b/i.test(head);
  if (courtAct) {
    const endings = [
      /SUSPENS[AÃ]O DOS EFEITOS DA ATA DE REGISTRO DE PRE[CÇ]OS\.\s*DECIS[AÃ]O MONOCR[AÁ]TICA REFERENDADA/i,
      /CELEBRA[CÇ][AÃ]O DE CONTRATO DE PROGRAMA[\s\S]{0,200}REGULARIDADE\.\s*IMPROCED[EÊ]NCIA/i,
      /(?:LICITA[CÇ][AÃ]O FRACASSADA|REVOGA[CÇ][AÃ]O DO CERTAME|ANULA[CÇ][AÃ]O DO CERTAME)\.[\s\S]{0,230}ARQUIVAMENTO/i,
    ];
    const proof = literalEvidence(text, endings, 0, 120);
    if (proof) return withEvidence({ ...classification, category: 'CONTROLE', emoji: '🔎', proofKind: 'court_decision',
      score: Math.max(8, classification.score || 0), publicContext: true, strongPublicContext: true,
      stage: /REFERENDADA/i.test(proof.text) ? 'suspensão cautelar referendada; não é julgamento definitivo'
        : /CONTRATO DE PROGRAMA/i.test(proof.text) ? 'contrato de programa considerado regular; separar outros apontamentos'
          : 'processo arquivado sem julgamento de mérito; não comprova condenação ou crise',
      reasons: ['decisão de controle em processo individualizado com consórcio identificado'] }, proof);
  }
  const inspectionParticipation = /\bparticipa[cç][aã]o\b.{0,100}\bocorre exclusivamente em atendimento [àa] intima[cç][aã]o do Minist[eé]rio P[uú]blico para acompanhar as a[cç][oõ]es fiscalizat[oó]rias/i;
  if (/\bcons[oó]rcio\s+intermunicipal\b/i.test(text) && inspectionParticipation.test(text) &&
    !/\b(?:condenou|multou|sancionou)\s+o\s+cons[oó]rcio\b/i.test(text)) {
    return withEvidence({ ...classification, category: 'ATUAÇÃO', emoji: '📰', proofKind: 'inspection_participation',
      score: Math.max(8, classification.score || 0), publicContext: true, strongPublicContext: true,
      stage: 'acompanhamento técnico da fiscalização; não é punição ao consórcio nem coordenação da operação',
      reasons: ['participação operacional confirmada por nota institucional'] }, literalEvidence(text, [inspectionParticipation]));
  }
  const votedProtocol = /\bmat[eé]ria\s*:\s*projeto de lei\b.{0,100}\bementa\s*:\s*ratifica o protocolo de inten[cç][oõ]es\b/i;
  if (/\/sessao\/\d+\/votacao-/.test(item.articleUrl || item.url || '') && votedProtocol.test(text) &&
    /\bcons[oó]rcio\s+(?:p[uú]blico|intermunicipal)\b/i.test(text) &&
    /\bresultado da vota[cç][aã]o\s*:\s*aprovado\b/i.test(text)) {
    return withEvidence({ ...classification, category: 'PROTOCOLO', emoji: '🟨',
      score: Math.max(5, classification.score || 0),
      stage: 'projeto de ratificação aprovado em votação; sanção e constituição não provadas pela ficha',
      reasons: ['votação de projeto com resultado aprovado; não confundir ementa com lei sancionada'] },
    literalEvidence(text, [votedProtocol], 0, 430));
  }
  const performedAssembly = /\bcons[oó]rcio\s+(?:p[uú]blico\s+)?intermunicipal\b.{0,200}\brealizou\b.{0,100}\bassembleia\b/i;
  if (performedAssembly.test(text) && /\bvisita t[eé]cnica\b/i.test(text) &&
    !/\b(?:elegeu|deliberou|aprovou|rejeitou|determinou|decretou)\b/i.test(text)) {
    return withEvidence({ ...classification, category: 'ATUAÇÃO', emoji: '📰',
      score: Math.max(5, classification.score || 0),
      stage: 'assembleia e visita realizadas; inauguração e deliberações específicas não comprovadas',
      reasons: ['consórcio realizou a atividade; não é mero anúncio ou participação passiva'] },
    literalEvidence(text, [performedAssembly], 0, 260));
  }
  // A draft includes the future law's enactment formula. The actual page status
  // takes precedence; an earlier assembly decision is a separate, limited fact.
  if (/^projeto de lei(?: ordin[aá]ria)?\b/i.test(title) && /\bmat[eé]ria em tramita[cç][aã]o\b/i.test(text)) {
    const assembly = /\baltera[cç][aã]o do contrato de cons[oó]rcio p[uú]blico\b.{0,230}\baprovada pelas assembleias gerais\b.{0,100}\b\d{2}\/\d{2}\/20\d{2}\b/i;
    if (assembly.test(text)) return withEvidence({ ...classification, category: 'GOVERNANÇA', emoji: '⬛',
      score: Math.max(5, classification.score || 0),
      stage: 'alteração aprovada em assembleias segundo o projeto; ratificação municipal ainda em tramitação',
      reasons: [...classification.reasons.filter((reason) => !reason.startsWith('rejeitado:')),
        'projeto relata aprovação prévia em assembleias; fórmula da minuta não comprova sanção municipal'] },
    literalEvidence(text, [assembly], 10, 100));
    return withEvidence({ ...classification, category: 'GERAL', emoji: '📰', score: 0,
      stage: 'projeto em tramitação; aprovação e sanção municipais não comprovadas',
      reasons: [...classification.reasons, 'rejeitado: fórmula de promulgação na minuta não prova lei sancionada'] },
    literalEvidence(text, [/\bmat[eé]ria em tramita[cç][aã]o\b/i], 0, 150));
  }
  // Do not let a generic meeting rule replace a specific legal/control fact.
  const institutional = institutionalProof(item);
  if (institutional && (['GERAL', 'ATUAÇÃO'].includes(classification.category) ||
      institutional.proofKind === 'documented_composition' && classification.category === 'CRIAÇÃO' ||
      institutional.proofKind === 'signed_municipal_protocol' && ['ADESÃO', 'PROTOCOLO'].includes(classification.category) ||
      institutional.proofKind === 'future_convocation' && classification.category === 'GOVERNANÇA')) {
    return { ...classification, ...institutional, emoji: institutional.category === 'GOVERNANÇA' ? '⬛' : '📰',
      score: institutional.category === 'GERAL' ? 0 : Math.max(5, classification.score || 0),
      publicContext: true, strongPublicContext: true, reasons: [institutional.reason] };
  }
  if (!text || classification.category === 'GERAL') return classification;

  if (/^instru[cç][aã]o normativa\b/i.test(title) &&
    /^.{0,100}estabelece os procedimentos.{0,180}estabelecimentos e produtos.{0,60}servi[cç]o de inspe[cç][aã]o municipal/i.test(text) &&
    /\bcons[oó]rcio intermunicipal\b/i.test(text.slice(0, 700))) {
    return withEvidence({ ...classification, category: 'ATUAÇÃO', emoji: '📰',
      stage: 'norma operacional de inspeção publicada; suspensão de produtos é procedimento, não punição ao consórcio',
      reasons: [...classification.reasons, 'norma estabelece procedimentos sanitários, não fiscalização contra o consórcio'] },
    literalEvidence(text, [/\bestabelece os procedimentos\b/i], 0, 420));
  }

  if (/\bcons[oó]rcios p[uú]blicos\b/i.test(text) && /\bReceita Federal\b/i.test(text) &&
    /\b(?:Cosit?|Solu[cç][aã]o de Consulta)\b.{0,100}\b\d+\/20\d{2}\b/i.test(text) &&
    /\borienta(?:[cç][oõ]es|[cç][aã]o|\s+gestores)\b/i.test(`${title} ${text}`)) {
    return withEvidence({ ...classification, category: 'FINANÇAS', emoji: '💰',
      scope: 'orientacao_geral', stage: 'orientação tributária geral; não é ato de consórcio individual',
      reasons: [...classification.reasons, 'orientação geral com ato tributário identificado'] },
    literalEvidence(text, [/\bReceita Federal\b.{0,180}\b\d+\/20\d{2}\b/i,
      /\bSolu[cç][aã]o de Consulta\b.{0,100}\b\d+\/20\d{2}\b/i], 2, 240));
  }

  if (/^portaria\b/i.test(title) && /\b(?:nomeia|nomear|designa|designar)\b/i.test(text) &&
    /\b(?:fiscal|acompanhamento)\b.{0,90}\bcontrato de rateio/i.test(text) &&
    /\b(?:celebrado|firmado)\b.{0,60}\bcons[oó]rcio/i.test(text)) {
    return withEvidence({ ...classification, category: 'GERAL', emoji: '📰', score: 0,
      stage: 'fiscal designado para rateio já celebrado; documento de acompanhamento',
      reasons: [...classification.reasons, 'rejeitado: portaria comprova acompanhamento do rateio, não nova celebração'] },
    literalEvidence(text, [/\b(?:fiscal|acompanhamento)\b.{0,90}\bcontrato de rateio/i], 80, 200));
  }

  // A relação verbo–objeto vale mais que palavras próximas: "saída" do prédio
  // ou "suspensão" de consultas não é saída de município; proposta de
  // extinção aprovada não é extinção consumada.
  if (ACCOUNTS_REJECTED.test(text)) {
    return withEvidence({ ...classification, category: 'CONTROLE', emoji: '🟥',
      stage: 'contas do consórcio desaprovadas; recursos ainda possíveis',
      reasons: [...classification.reasons, 'decisão de controle sobre contas do próprio consórcio'] },
    literalEvidence(text, [ACCOUNTS_REJECTED], 90, 160));
  }
  if (APPROVED_EXIT_STEP.test(text) && /\b(?:c[aâ]mara|vereadores|projeto de lei)\b/i.test(text)) {
    return withEvidence({ ...classification, category: 'GOVERNANÇA', emoji: '⬛',
      stage: 'projeto autorizativo aprovado; saída ou extinção ainda não comprovada',
      reasons: [...classification.reasons, 'votação autorizativa não prova desligamento ou dissolução'] },
    literalEvidence(text, [APPROVED_EXIT_STEP], 90, 180));
  }
  if (SERVICE_INTERRUPTED.test(text) && /\b(?:furto|vandalismo|falta de energia)\b/i.test(text)) {
    return withEvidence({ ...classification, category: 'ATUAÇÃO', emoji: '📰',
      stage: 'atendimentos suspensos por incidente operacional; consórcio não saiu nem foi extinto',
      reasons: [...classification.reasons, 'interrupção de serviço não é saída de consorciado'] },
    literalEvidence(text, [SERVICE_INTERRUPTED], 80, 150));
  }
  if (CALL_OPENED.test(text)) {
    return withEvidence({ ...classification, category: 'ATUAÇÃO', emoji: '📰',
      stage: 'chamamento público aberto; contratação futura não comprovada',
      reasons: [...classification.reasons, 'ato de contratação iniciado, não adjudicação'] },
    literalEvidence(text, [CALL_OPENED], 80, 180));
  }
  if (EQUIPMENT_RECEIVED.test(text)) {
    return withEvidence({ ...classification, category: 'ATUAÇÃO', emoji: '📰',
      stage: 'equipamento recebido; início de atendimentos não comprovado',
      reasons: [...classification.reasons, 'recebimento de equipamento não é adesão municipal'] },
    literalEvidence(text, [EQUIPMENT_RECEIVED], 80, 170));
  }
  if (['ADESÃO', 'GOVERNANÇA', 'ATUAÇÃO'].includes(classification.category) &&
    PROGRAM_LAUNCH.test(title) && PROGRAM_LAUNCH.test(text)) {
    return withEvidence({ ...classification, category: 'ATUAÇÃO', emoji: '📰',
      stage: 'programa lançado pelo consórcio; adesão municipal não comprovada',
      reasons: [...classification.reasons, 'integração regional no programa não é ingresso de município'] },
    literalEvidence(text, [PROGRAM_LAUNCH], 40, 180));
  }

  // Páginas do SAPL podem repetir a ementa de uma futura lei. A aprovação de
  // um requerimento, ou a simples inclusão de um projeto na pauta, não aprova
  // o ingresso descrito nessa ementa. A norma gerada deve ser lida à parte.
  const pageUrl = item.articleUrl || item.url || '';
  const requestPage = /\/sessao\/\d+\/votacao-|\/materia\/\d+\/acompanhar-materia\/?/i.test(pageUrl);
  const requestMatter = /\b(?:mat[eé]ria\s*:|tipo\s*:\s*REQ\s*-\s*)\s*requerimento\b/i.test(text);
  if (requestPage && requestMatter && /\b(?:solicita|requer)\b/i.test(text)) {
    return withEvidence({ ...classification, category: 'GERAL', emoji: '📰', score: 0,
      stage: 'requerimento; ato de ingresso não comprovado',
      reasons: [...classification.reasons, 'rejeitado: requerimento não é lei ou adesão'] },
    literalEvidence(text, [/\b(?:mat[eé]ria\s*:|tipo\s*:\s*REQ\s*-\s*)\s*requerimento\b/i], 30, 210));
  }
  if (/\/sessao\/ordemdia\/\d+/i.test(pageUrl) && /\bprojeto de lei\b/i.test(text) &&
    !/\b(?:resultado da vota[cç][aã]o\s*:\s*aprovado|norma gerada\s*:)/i.test(text)) {
    return withEvidence({ ...classification, category: 'GERAL', emoji: '📰', score: 0,
      stage: 'projeto listado em pauta; resultado e lei não comprovados nesta página',
      reasons: [...classification.reasons, 'rejeitado: pauta não comprova aprovação do projeto'] },
    literalEvidence(text, [/\bprojeto de lei\b/i], 30, 230));
  }

  if (classification.category === 'CRISE' && /\b(?:minist[eé]rio p[uú]blico|MPMT)\b/i.test(text) &&
    /\b(?:recomenda[cç][aã]o|recomendou|deu\s+\d+\s+dias)\b/i.test(text) &&
    /\bdissolu[cç][aã]o\b/i.test(text) &&
    !/\b(?:cons[oó]rcio\s+(?:foi\s+)?dissolvido|dissolu[cç][aã]o\s+(?:foi\s+)?(?:decretada|aprovada|formalizada))\b/i.test(text)) {
    return withEvidence({ ...classification, category: 'CONTROLE', emoji: '🟥',
      stage: 'recomendação do Ministério Público; dissolução apenas alternativa, não realizada',
      reasons: [...classification.reasons, 'dissolução cogitada não é extinção efetiva'] },
    literalEvidence(text, [/\brecomenda[cç][aã]o\b/i, /\bdeu\s+\d+\s+dias\b/i], 90, 230));
  }

  if (AUTHORIZED_COOPERATION.test(`${title} ${text}`)) {
    return withEvidence({ ...classification, category: 'COOPERAÇÃO AUTORIZADA', emoji: '📰',
      stage: 'lei autoriza convênio de serviços; assinatura e adesão não comprovadas',
      reasons: [...classification.reasons, 'convênio autorizado não é ingresso no consórcio'] },
    literalEvidence(text, [/autoriza\s+o\s+poder\s+executivo\s+a\s+firmar\s+conv[eê]nio/i,
      /autorizado\s+a\s+firmar\s+conv[eê]nio\s+com\s+o\s+cons[oó]rcio/i], 70, 180));
  }
  if (RATIFIED_STATUTE.test(text)) {
    return withEvidence({ ...classification, category: 'GOVERNANÇA', emoji: '⬛', proofKind: 'ratified_statute',
      stage: 'estatuto consolidado ratificado por lei municipal; consórcio já existente',
      reasons: [...classification.reasons, 'ratificação estatutária não cria consórcio nem comprova nova adesão'] },
    literalEvidence(text, [RATIFIED_STATUTE], 50, 160));
  }
  if (SERVICE_CONTRACT.test(text)) {
    const contract = SERVICE_CONTRACT.exec(text);
    const localAct = text.slice(contract.index, contract.index + 1400);
    return withEvidence({ ...classification, category: 'ATUAÇÃO', emoji: '📰',
      stage: /\bdata\s+de\s+assinatura\s*:\s*\d{1,2}\s+de\s+\w+\s+de\s+20\d{2}/i.test(localAct)
        ? 'contrato de prestação de serviços assinado; não é protocolo novo'
        : 'extrato de contrato de serviços; assinatura a conferir',
      reasons: [...classification.reasons, 'protocolo citado como fundamento do contrato, não alterado'] },
    literalEvidence(text, [SERVICE_CONTRACT], 30, 180));
  }
  if (classification.category === 'CRISE' && PAICI_WITHHELD.test(`${title} ${text}`)) {
    return withEvidence({ ...classification, category: 'FINANÇAS', emoji: '💰',
      stage: 'incentivo PAICI de agosto zerado para oito municípios; consórcios não declarados insolventes',
      reasons: [...classification.reasons, 'inadimplência municipal e retenção de incentivo não são falência do consórcio'] },
    literalEvidence(text, [/oito\s+munic[ií]pios[\s\S]{0,240}\bincentivo\s+financeiro\s+estadual/i,
      /inadimpl[eê]ncia[\s\S]{0,220}PAICI/i], 50, 170));
  }

  if (SIM_PROCEDURE_RESOLUTION.test(text) &&
    /\bservi[cç]o\s+de\s+inspe[cç][aã]o\s+municipal\b/i.test(text)) {
    return withEvidence({ ...classification, category: 'ATUAÇÃO', emoji: '📰',
      stage: 'norma operacional de inspeção publicada; não altera o protocolo citado',
      reasons: [...classification.reasons, 'resolução operacional não é alteração constitutiva'] },
    literalEvidence(text, [SIM_PROCEDURE_RESOLUTION], 25, 170));
  }
  if (classification.category === 'GOVERNANÇA' && ELECTION_RESCHEDULED.test(`${title} ${text}`)) {
    return withEvidence({ ...classification,
      stage: 'calendário eleitoral retificado; eleição não comprovada',
      reasons: [...classification.reasons, 'retificação de datas não equivale a eleição realizada'] },
    literalEvidence(text, [ELECTION_RESCHEDULED], 25, 170));
  }

  if (FUTURE_ASSEMBLY.test(`${title} ${text}`) && HQ_CONSTRUCTION.test(text) &&
    !CONSTRUCTION_MILESTONE.test(text)) {
    return withEvidence({ ...classification, category: 'GERAL', emoji: '📰', score: 0,
      stage: 'agenda futura; obra em andamento citada como contexto',
      reasons: [...classification.reasons, 'rejeitado: anúncio de reunião futura não comprova novo marco da obra'] },
    literalEvidence(text, [FUTURE_ASSEMBLY, HQ_CONSTRUCTION], 50, 140));
  }
  if (['GOVERNANÇA', 'ATUAÇÃO'].includes(classification.category) &&
    FUTURE_ASSEMBLY.test(`${title} ${text}`) &&
    !/\b(?:realizou|ocorreu|reuniu-se|deliberou|aprovou)\b/i.test(text)) {
    return withEvidence({ ...classification, category: 'GERAL', emoji: '📰', score: 0,
      stage: 'reunião anunciada; realização não comprovada',
      reasons: [...classification.reasons, 'rejeitado: agenda futura sem acontecimento comprovado'] },
    literalEvidence(text, [FUTURE_ASSEMBLY], 40, 130));
  }

  if (classification.category === 'CRIAÇÃO') {
    const hypothetical = HYPOTHETICAL_CREATION.test(`${title} ${text}`);
    const formal = FORMAL_CREATION.some((pattern) => pattern.test(text));
    if (ASSEMBLY_APPROVED_PROTOCOL.test(text) && /\bprotocolo\b/i.test(text) &&
      /\bn[aã]o cria o cons[oó]rcio|\bcons[oó]rcio existente|\bintegra.{0,70}desde/i.test(text)) {
      return withEvidence({ ...classification, category: 'GOVERNANÇA', emoji: '⬛',
        stage: 'alteração aprovada em assembleia; ratificação municipal ainda em tramitação',
        reasons: [...classification.reasons, 'assembleia de consórcio existente aprovou alteração, não criação nova'] },
      literalEvidence(text, [ASSEMBLY_APPROVED_PROTOCOL], 80, 100));
    }
    if (PROPOSED_AMENDMENT.test(text) && !APPROVED_PROJECT.test(text)) {
      return withEvidence({ ...classification, category: 'GERAL', emoji: '📰', score: Math.min(classification.score, 0),
        stage: 'alteração proposta, não criação',
        reasons: [...classification.reasons, 'rejeitado: proposta de alteração de consórcio existente'] },
      literalEvidence(text, [PROPOSED_AMENDMENT]));
    }
    if (hypothetical && !formal) {
      return withEvidence({ ...classification, category: 'GERAL', emoji: '📰', score: Math.min(classification.score, 0),
        stage: 'criação apenas cogitada',
        reasons: [...classification.reasons, 'rejeitado: criação questionada ou hipotética, sem ato constitutivo'] },
      literalEvidence(text, [HYPOTHETICAL_CREATION, /cria[cç][aã]o de (?:um )?(?:novo )?cons[oó]rcio/i], 40, 130));
    }
    if (UNAPPROVED_PROPOSAL.test(`${title} ${text}`) && !formal &&
      !APPROVED_PROJECT.test(text)) {
      return withEvidence({ ...classification, category: 'GERAL', emoji: '📰', score: Math.min(classification.score, 0),
        stage: 'proposta de criação sem decisão',
        reasons: [...classification.reasons, 'rejeitado: proposta sem criação formal comprovada'] },
      literalEvidence(text, [UNAPPROVED_PROPOSAL], 40, 130));
    }
    if (APPROVED_CREATION_STEP.test(text) && !formal) {
      return withEvidence({ ...classification, category: 'CRIAÇÃO EM TRAMITAÇÃO', emoji: '🟩',
        stage: 'etapa de criação aprovada; constituição formal não comprovada',
        reasons: [...classification.reasons, 'aprovação de etapa não constitui o consórcio'] },
      literalEvidence(text, [APPROVED_CREATION_STEP], 50, 150));
    }
    return withEvidence({ ...classification, stage: 'constituição documentada' },
      literalEvidence(text, FORMAL_CREATION));
  }

  if (classification.category === 'ADESÃO') {
    if (APPROVED_ENTRY_PROPOSAL.some((pattern) => pattern.test(text)) &&
      /\bconselho\s+(?:municipal\s+)?de\s+sa[uú]de\b/i.test(text)) {
      return withEvidence({ ...classification, category: 'PROPOSTA DE ADESÃO', emoji: '🟦',
        stage: 'proposta aprovada pelo Conselho de Saúde; ingresso não comprovado',
        reasons: [...classification.reasons, 'deliberação do conselho não efetiva o ingresso'] },
      literalEvidence(text, APPROVED_ENTRY_PROPOSAL, 40, 100));
    }
    if (PROTOCOL_AMENDMENT.test(`${title} ${text}`) && !NEW_ENTRY.test(text)) {
      return withEvidence({ ...classification, category: 'GOVERNANÇA', emoji: '⬛',
        stage: 'alteração do protocolo; ingresso novo não comprovado',
        participationEvidence: /\bmunic[ií]pios?\s+consorciados?\b/i.test(text),
        reasons: [...classification.reasons, 'alteração de protocolo não comprova adesão nova'] },
      literalEvidence(text, [PROTOCOL_AMENDMENT]));
    }
    const authorizedToJoin = /\bfica autorizad[oa] ao munic[ií]pio\b.{0,100}\b(?:integrar|aderir|ingressar)\s+(?:o|no|ao)\s+cons[oó]rcio/i;
    if (APPROVED_PROJECT.test(text) || FORMAL_AUTHORIZATION.test(text) || AUTHORIZED_INGRESS.test(`${title} ${text}`) || AUTHORIZED_ADHESION_TITLE.test(`${title} ${text}`) || authorizedToJoin.test(text)) {
      return withEvidence({ ...classification, category: 'ADESÃO AUTORIZADA', emoji: '🟦',
        stage: /\bcontratos?\s+de\s+rateio\b/i.test(text) && !EXECUTED_RATEIO.test(text)
          ? 'autorização de ingresso; rateio apenas previsto, não celebrado'
          : 'aprovação ou autorização; ingresso efetivo não comprovado',
        reasons: [...classification.reasons, 'aprovação/autorização não prova ingresso efetivado'] },
      literalEvidence(text, [APPROVED_PROJECT, FORMAL_AUTHORIZATION, AUTHORIZED_INGRESS, authorizedToJoin]));
    }
    return classification;
  }

  if (classification.category === 'GOVERNANÇA' && PROTOCOL_AMENDMENT.test(`${title} ${text}`)) {
    return withEvidence({ ...classification,
      stage: 'alteração do protocolo; ingresso novo não comprovado',
      participationEvidence: /\bmunic[ií]pios?\s+consorciados?\b/i.test(text) },
    literalEvidence(text, [PROTOCOL_AMENDMENT]));
  }

  if (classification.category === 'PROTOCOLO' && NUMBERED_PROTOCOL.test(`${title} ${text}`) &&
    /\bmunic[ií]pio participa\b/i.test(text) &&
    /n[aã]o implica ades[aã]o autom[aá]tica/i.test(text)) {
    return withEvidence({ ...classification, category: 'GOVERNANÇA', emoji: '⬛',
      stage: 'protocolo de consórcio já integrado; novos programas exigem adesão separada',
      participationEvidence: true,
      reasons: [...classification.reasons, 'protocolo numerado altera arranjo existente; participação originária descrita'] },
    literalEvidence(text, [NUMBERED_PROTOCOL, /munic[ií]pio participa.{0,130}cons[oó]rcio/i], 60, 170));
  }

  if (classification.category === 'PROTOCOLO' && SIM_PROCEDURE_RESOLUTION.test(text) &&
    /\bservi[cç]o\s+de\s+inspe[cç][aã]o\s+municipal\b/i.test(text)) {
    return withEvidence({ ...classification, category: 'ATUAÇÃO', emoji: '📰',
      stage: 'norma operacional de inspeção publicada; fiscalizações concretas não inferidas',
      reasons: [...classification.reasons, 'protocolo citado como fundamento, não alterado pelo ato'] },
    literalEvidence(text, [SIM_PROCEDURE_RESOLUTION], 25, 170));
  }

  if (classification.category === 'RATEIO') {
    if (/^lei\b/i.test(title) && AUTHORIZED_TRANSFER.test(text.slice(0, 1600)) &&
      /\bautoriza\b.{0,160}\brepassar recursos\b/i.test(text.slice(0, 700))) {
      return withEvidence({ ...classification, category: 'FINANÇAS', emoji: '💰',
        stage: 'lei autoriza repasse de recursos; pagamento e contrato de rateio não comprovados',
        reasons: [...classification.reasons, 'rateio aparece como possível fonte; objeto principal é autorização de repasse'] },
      literalEvidence(text, [AUTHORIZED_TRANSFER], 20, 160));
    }
    const addendum = /\b(?:termo\s+)?aditivo ao contrato de rateio\s+n[.º°o\s]*\d+\/20\d{2}\b.{0,100}\b(?:que\s+)?(?:entre si\s+)?celebram\b/i;
    if (addendum.test(text) && /\bcons[oó]rcio\b/i.test(text)) {
      return withEvidence({ ...classification,
        stage: 'aditivo de rateio publicado entre as partes; pagamento não comprovado',
        reasons: [...classification.reasons, 'documento identifica aditivo, contrato e partes; não é novo ingresso'] },
      literalEvidence(text, [addendum], 30, 230));
    }
    if (/^extrato\s+(?:do\s+)?contrato\s+de\s+rateio\b/i.test(title) &&
      /\b(?:concedente|contratante|partes)\s*:/i.test(text) &&
      /\b(?:proponente|contratad[oa]|consorciad[oa])\s*:/i.test(text) &&
      /\bassinatura\s*:\s*[^:]{0,90}\b\d{1,2}\s+de\s+\w+\s+de\s+20\d{2}\b/i.test(text)) {
      return withEvidence({ ...classification, stage: 'extrato de rateio com data de assinatura; pagamento não comprovado',
        reasons: [...classification.reasons, 'extrato individual identifica partes e data de assinatura'] },
      literalEvidence(text, [/\bassinatura\s*:/i], 0, 160));
    }
    if (AUTHORIZED_TRANSFER.test(text) && !EXECUTED_RATEIO.test(text)) {
      return withEvidence({ ...classification, category: 'FINANÇAS', emoji: '💰',
        stage: 'lei autoriza repasse de recursos; pagamento e contrato de rateio não comprovados',
        reasons: [...classification.reasons, 'autorização de repasse não comprova contrato de rateio celebrado'] },
      literalEvidence(text, [AUTHORIZED_TRANSFER], 45, 180));
    }
    if (RATEIO_AUTHORIZATION.some((pattern) => pattern.test(text)) && !EXECUTED_RATEIO.test(text)) {
      return withEvidence({ ...classification, category: 'RATEIO EM TRAMITAÇÃO', emoji: '🟪',
        stage: 'dispensa autorizada para formalizar rateio; contrato não assinado no ato',
        reasons: [...classification.reasons, 'ato preparatório específico não comprova contrato celebrado'] },
      literalEvidence(text, RATEIO_AUTHORIZATION, 20, 180));
    }
    if (AUTHORIZED_INGRESS.test(text) && !EXECUTED_RATEIO.test(text)) {
      return withEvidence({ ...classification, category: 'ADESÃO AUTORIZADA', emoji: '🟦',
        stage: 'autorização de ingresso; rateio apenas previsto, não celebrado',
        reasons: [...classification.reasons, 'autorização para rateio futuro não equivale a contrato celebrado'] },
      literalEvidence(text, [AUTHORIZED_INGRESS], 40, 150));
    }
    return withEvidence({ ...classification, stage: 'contrato de rateio citado; celebração a conferir' },
      literalEvidence(text, [/(?:celebram|celebrado|assinado).{0,130}contrato de rateio/i,
        /contrato de rateio.{0,130}(?:celebram|celebrado|assinado)/i,
        /contrato de rateio/i]));
  }
  if (classification.category === 'CONTROLE' && HYPOTHETICAL_CREATION.test(`${title} ${text}`) &&
    /\b(?:depoimento|dep[oõ]e|depoimento prestado)\b/i.test(`${title} ${text}`) &&
    !CONTROL_DECISION.test(text)) {
    return withEvidence({ ...classification, category: 'GERAL', emoji: '📰', score: Math.min(classification.score, 0),
      stage: 'depoimento sobre hipótese; sem decisão de controle',
      reasons: [...classification.reasons, 'rejeitado: depoimento não comprovou novo evento institucional'] },
    literalEvidence(text, [HYPOTHETICAL_CREATION, /cria[cç][aã]o de (?:um )?(?:novo )?cons[oó]rcio/i], 40, 130));
  }
  if (classification.category === 'CONTROLE' && INTERNAL_INSPECTION_GUIDELINE.test(`${title} ${text}`) &&
    /servi[cç]o de inspe[cç][aã]o municipal/i.test(text) &&
    !/\b(?:tribunal de contas|tce|tcu|minist[eé]rio p[uú]blico|pol[ií]cia)\b/i.test(text)) {
    return withEvidence({ ...classification, category: 'ATUAÇÃO', emoji: '📰',
      stage: 'procedimento de inspeção publicado; não é apuração contra o consórcio',
      reasons: [...classification.reasons, 'fraude é objeto do programa de prevenção, não acusação ao consórcio'] },
    literalEvidence(text, [INTERNAL_INSPECTION_GUIDELINE, /estabelecer os procedimentos.{0,300}cons[oó]rcio/i], 30, 180));
  }
  if (classification.category === 'CONTROLE' && GENERIC_RATEIO_IMPROBITY_CLAUSE.test(text) &&
    /\bcontrato\s+de\s+rateio\b/i.test(text) && !CONTROL_DECISION.test(text)) {
    return withEvidence({ ...classification, category: 'RATEIO', emoji: '🟪',
      stage: 'contrato de rateio publicado; assinatura a conferir',
      reasons: [...classification.reasons, 'cláusula genérica de improbidade não é ato de controle'] },
    literalEvidence(text, [/contrato\s+de\s+rateio\s+n[ºo°.]?\s*\d+/i, /\bcontrato\s+de\s+rateio\b/i], 40, 150));
  }
  return classification;
}
