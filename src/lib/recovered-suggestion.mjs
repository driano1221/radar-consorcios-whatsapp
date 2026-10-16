import { classifyItem, isStaleLegislativeDocument } from './classifier.mjs';
import { redactPublicText } from './article-text-store.mjs';

// Releitura e recuperação precisam usar o mesmo filtro. Uma revisão manual
// lacrada não reabre; uma decisão da IA não impede evidência realmente nova.
export function recoveredSuggestion(row, stored, { reviewed = false, sameTextAs = '' } = {}) {
  const item = { kind: 'news', title: row.titulo, url: row.url, articleUrl: stored.url_artigo,
    source: row.fonte, rawText: stored.texto, summary: stored.texto?.slice(0, 1800),
    publishedAt: row.data_publicacao };
  const classification = classifyItem(item);
  const outside = /\b(?:concurso|processo seletivo|gabarito|provas|sal[aá]rios|vagas)\b/i.test(row.titulo) ||
    /^Detalhes do Ac[oó]rd[aã]o\b.*\b20(?:0\d|1\d|2[0-4])\b/i.test(row.titulo) ||
    isStaleLegislativeDocument(item);
  const candidate = row.tipo_evento === 'GERAL' && !reviewed && !sameTextAs && !outside &&
    classification.category !== 'GERAL' && classification.score >= 5;
  return { classification, candidate, fields: {
    article_suggested_category: candidate ? classification.category : '',
    article_suggested_score: candidate ? classification.score : '',
    article_suggestion_evidence: candidate ? redactPublicText(classification.evidenceText || '').slice(0, 500) : '',
  } };
}
