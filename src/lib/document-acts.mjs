import { createHash } from 'node:crypto';

const SHA256 = /^[a-f0-9]{64}$/;
const ACT_KEY = /^[a-z0-9][a-z0-9-]{2,100}$/;

export function documentActId(parentId, actKey) {
  if (!SHA256.test(parentId) || !ACT_KEY.test(actKey)) throw new Error('Identidade de ato inválida');
  return createHash('sha256').update(`ato:${parentId}:${actKey}`).digest('hex');
}

export function materializeDocumentActs(documents, definitions) {
  const byId = new Map(documents.map((row) => [row.id, row]));
  const ids = new Set();
  return definitions.map((definition) => {
    const { documento_pai_id: parentId, chave_ato: key, pagina_inicio: first,
      pagina_fim: last = first, titulo: title, trecho: excerpt, categoria: category } = definition;
    const parent = byId.get(parentId);
    if (!parent) throw new Error(`Documento pai não encontrado para o ato ${key}`);
    const id = documentActId(parentId, key);
    if (ids.has(id)) throw new Error(`Ato repetido: ${key}`);
    ids.add(id);
    if (!Number.isInteger(first) || first < 1 || !Number.isInteger(last) || last < first || last > first + 5) {
      throw new Error(`Páginas inválidas para o ato ${key}`);
    }
    if (!title?.trim() || !excerpt?.trim() || !category?.trim()) throw new Error(`Ato incompleto: ${key}`);
    // Um link do Google pode apontar para um PDF: a âncora deve ir ao PDF
    // comprovado, nunca à página intermediária do agregador.
    const pdfUrl = definition.url_pdf || parent.article_url || '';
    // Official PDF endpoints need not end in .pdf. Only a verified, explicitly
    // declared PDF URL may use that path; an article_url remains a fallback hint.
    const verifiedPdf = definition.pdf_sha256 && SHA256.test(definition.pdf_sha256) &&
      /^https:\/\//i.test(definition.url_pdf || '');
    const cleanUrl = (verifiedPdf || /^https:\/\/.+\.pdf(?:[?#]|$)/i.test(pdfUrl) ? pdfUrl : parent.url).split('#')[0];
    return {
      ...parent, id, documento_pai_id: parentId, chave_ato: key,
      fonte: definition.fonte || parent.fonte,
      data_publicacao: definition.data_publicacao || parent.data_publicacao,
      data_noticia_original: definition.data_publicacao || parent.data_noticia_original,
      data_fato: definition.data_fato || '',
      pagina_inicio: first, pagina_fim: last, registro_tipo: 'ato',
      titulo: title.trim(), trecho: excerpt.trim(), tipo_evento: category.trim(),
      etapa: definition.etapa || '', tipo_documento: definition.tipo_documento || 'ato oficial individualizado',
      consorcio: definition.consorcio || '',
      sigla: definition.sigla || '', url: `${cleanUrl}#page=${first}`,
      article_url: '', revisao_ia: '', enviado_em: '',
      decisao_base: category === 'GERAL' ? 'descartado' : 'candidato',
      decisao_alerta: 'historico',
      motivo_alerta: 'Ato individualizado em revisão documental; não entra automaticamente na fila do WhatsApp.',
      situacao_analise: 'ato individualizado no PDF — conferir revisão editorial',
    };
  });
}
