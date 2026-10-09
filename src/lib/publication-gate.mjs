import { isPublishableClassification } from './classifier.mjs';
import { eventMonthEnd, formalActDate } from './publication-date.mjs';

const HOUR = 3600000;

function timestamp(value) {
  if (!value) return NaN;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : NaN;
}

// A data do RSS é a descoberta pelo buscador, não necessariamente a notícia.
// Uma data de fato documentada tem prioridade, seguida da página original.
export function publicationDate(item, now = new Date()) {
  for (const [field, date] of [
    ['fato', item.eventAt], ['mês do fato', eventMonthEnd(item.eventMonth)], ['ato', formalActDate(item, now)],
    ['fonte', item.sourcePublishedAt], ['coleta', item.publishedAt],
  ]) {
    if (Number.isFinite(timestamp(date))) return { date: new Date(date).toISOString(), field };
  }
  return null;
}

export function decidePublication(item, { now = new Date(), lookbackHours = 168, minimumScore = 5 } = {}) {
  if (!isPublishableClassification(item.classification, minimumScore)) return {
    ...item, catalogDecision: item.catalogDecision || 'descartado',
    publicationDecision: 'descartado',
    publicationReason: item.publicationReason || 'Sem evento comprovado para alertar.',
  };
  const catalogDecision = item.catalogDecision || 'candidato';
  if (item.publicationDecision === 'historico') return { ...item, catalogDecision };
  const evidence = publicationDate(item, now);
  if (evidence && timestamp(evidence.date) < now.getTime() - lookbackHours * HOUR) {
    return { ...item, catalogDecision, publicationDecision: 'historico',
      publicationReason: `Data do ${evidence.field} (${evidence.date.slice(0, 10)}) anterior à janela de ${lookbackHours} horas.`,
      publicationDateSource: evidence.field };
  }
  if (evidence && timestamp(evidence.date) > now.getTime() + HOUR) {
    return { ...item, catalogDecision, publicationDecision: 'data_inconsistente',
      publicationReason: `Data do ${evidence.field} posterior à execução; conferir antes de enviar.`,
      publicationDateSource: evidence.field };
  }
  return { ...item, catalogDecision, publicationDecision: 'elegivel',
    publicationReason: evidence ? `Data do ${evidence.field} dentro da janela.` : 'Sem data original verificável; usa a triagem da fonte.',
    publicationDateSource: evidence?.field || '' };
}

export function isNotifiable(item, minimumScore = 5) {
  return isPublishableClassification(item.classification, minimumScore) &&
    !['historico', 'data_inconsistente', 'descartado'].includes(item.publicationDecision);
}
