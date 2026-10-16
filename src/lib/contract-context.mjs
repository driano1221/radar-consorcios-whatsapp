import { normalizeForMatch, normalizeWhitespace } from './text.mjs';

// A contratação de fornecedor não é ingresso municipal, rateio ou crise.
// Reconhecemos o documento individual pelo cabeçalho e pelas partes; não
// descartamos um diário inteiro por conter um contrato em alguma página.
export function routineSupplierContract(item) {
  const raw = normalizeWhitespace(item.rawText || item.summary || item.excerpts?.join(' ') || '');
  const text = normalizeForMatch(raw);
  const title = normalizeForMatch(item.title || '');
  const header = text.slice(0, 1800);
  const credential = /^(?:termo de credenciamento\b|\d+[-/]20\d{2}\s*-\s*termo de inex\b)/.test(title) ||
    /^termo de credenciamento\b/.test(header);
  const supplier = /\b(?:e a empresa|contratada\s*:?\s*.{0,100}(?:ltda|s\.?a\.?))\b/.test(header);
  const publicConsortium = /\bconsorcio(?: publico)? intermunic(?:ipal|pal)\b/.test(header);
  if (credential && supplier && publicConsortium &&
    /\b(?:prestacao de servicos|contratacao|fornecimento)\b/.test(header)) {
    return { stage: 'credenciamento de fornecedor; contrato rotineiro fora do escopo',
      reason: 'contrato rotineiro com fornecedor; cláusulas de sanção não comprovam crise ou saída',
      evidence: raw.slice(0, 420) };
  }
  if (/^extrato de termo de ratificacao\b/.test(`${title} ${header}`) &&
    /\bdispensa de licitacao\b/.test(header) &&
    /\bobjeto\s*:\s*contratacao de empresa\b/.test(header) &&
    /\b(?:nome do credor|contratada)\s*:/.test(text) && publicConsortium &&
    !/\bcontrato de rateio\b/.test(header)) {
    return { stage: 'dispensa para fornecedor ratificada; não é repasse nem prestação de contas realizada',
      reason: 'ratificação de contratação rotineira de fornecedor, não alteração institucional ou ato financeiro do consórcio',
      evidence: raw.slice(0, 480) };
  }
  // A mesma contratação pode reaparecer como notícia, sem o cabeçalho do termo.
  // Exigir contrato identificado + fornecedor privado + previsão no título;
  // relatos de atendimento executado ou sanção real não entram neste descarte.
  const routineNews = /\b(?:preve|preveem|credencia|contrata|assina)\b/.test(title) &&
    /\btermo de credenciamento\b.{0,180}\b(?:ltda|s\.?a\.?)\b.{0,100}\b(?:foi assinado|firmado)\b/.test(header);
  const executed = /\b(?:realizou|realizaram|entregou|entregaram|distribuiu|atendeu|atenderam|foram realizadas|foram entregues|determinou|decretou|aplicou|suspendeu|constatou)\b/.test(text);
  if (routineNews && publicConsortium && !executed && !/\bcontrato de rateio\b/.test(header)) {
    return { stage: 'notícia de credenciamento rotineiro; atendimento apenas previsto',
      reason: 'notícia de contrato rotineiro com fornecedor, sem atendimento executado comprovado',
      evidence: raw.slice(0, 650) };
  }
  return null;
}

// Valida cada ocorrência, não apenas a categoria vencedora. Assim uma cláusula
// não domina uma notícia real em outra janela e uma multa real continua válida.
export function isNonEventContractMatch(category, match, text) {
  if (!['CRISE', 'SAÍDA', 'CONTROLE'].includes(category)) return false;
  const phrase = match[0];
  const start = Math.max(0, match.index - 190);
  const context = text.slice(start, match.index + phrase.length + 110);
  if (category === 'SAÍDA' && /\bretirada\s+(?:da|de)\s+(?:ordem|edital|material|documento)/.test(context)) return true;
  if (category === 'CRISE' && /\b(?:falencia|concordata)\s+(?:da|de uma?)\s+empresa|\bdissolucao\s+(?:da|de uma?)\s+empresa/.test(context)) return true;
  if (category === 'CONTROLE' && /\bverificada a suspensao\b.{0,190}\bcontribuicao permanecera\b/.test(context)) return true;
  const conditional = /\b(?:no caso d[aeo]|em caso de|na hipotese de|nas hipoteses|podera|poderao|ficara sujeita|sob pena de|constitui(?:em)? motivos|quando a contratada|se a contratada)\b/.test(context);
  const contract = /\b(?:contratad[ao]|credenciad[ao]|licitante|fornecedor|contrato|clausula|penalidades|sancoes)\b/.test(context);
  const occurred = /\b(?:determinou|decretou|aplicou|suspendeu|constatou|foi decretada|foi suspenso|foi suspensa|foi dissolvido|declarou)\b/.test(phrase);
  return conditional && contract && !occurred;
}
