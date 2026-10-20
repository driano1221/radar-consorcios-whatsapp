import {normalizeForMatch,normalizeWhitespace} from './text.mjs';

// Narrow document-level exclusions. Never infer an external injunction from
// "suspensão" alone or a presidency change from an employee's appointment.
export function administrativeRoutine(item){
  const title=normalizeForMatch(item.title||''),raw=normalizeWhitespace(item.rawText||item.summary||'');
  const text=normalizeForMatch(raw),opening=text.slice(0,2200);
  if(!/consorcio|consorciado/.test(text))return null;
  const structural=/\b(?:altera|alteracao|ratifica|ratificacao)\b.{0,100}\b(?:protocolo de intencoes|contrato de consorcio|estatuto)\b/.test(`${title} ${opening.slice(0,350)}`);
  const employee=/\b(?:exonera|nomeia)\s+(?:do|para o)\s+cargo de\s+(?:gerente|assistente|auxiliar|motorista|tecnico|analista)\b/.exec(opening);
  const medical=/\b(?:conceder|concede)\s+licenca\s+para\s+tratamento\s+de\s+saude\b/.exec(opening);
  const appointment=/\bdesigna\s+servidores\s+para\s+exercerem\s+as\s+funcoes\s+de\s+gestor\s+e\s+fiscal\s+do\s+contrato\b/.exec(opening);
  if(!structural&&/\b(?:portaria|resolucao|ato administrativo)\b/.test(title)&&(employee||medical||appointment))return {
    reason:'ato rotineiro de pessoal ou de acompanhamento de contrato',
    stage:'rotina administrativa; mudança institucional não comprovada',
    evidence:raw.slice(Math.max(0,(employee||medical||appointment).index-80),(employee||medical||appointment).index+550),
  };
  const suspension=/\baviso de suspensao\b/.test(title)&&/\b(?:pregao|chamamento publico|licitacao|certame)\b/.test(text);
  const administrative=/\b(?:ajustes no instrumento convocatorio|analise tecnica e juridica de impugnacao|retificacoes do edital)\b/.test(text);
  const external=/\b(?:tribunal de contas|ministerio publico|tce[- ]?[a-z]{2}|tcu|judicial|justica|juiz|desembargador)\b/.test(text);
  if(suspension&&administrative&&!external&&!structural)return {
    reason:'suspensão administrativa para ajuste de edital, sem ordem externa',
    stage:'procedimento de contratação suspenso internamente; não crise institucional',evidence:raw.slice(0,900),
  };
  return null;
}
