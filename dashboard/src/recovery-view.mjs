// Use textContent throughout: recovered pages are untrusted, never executable HTML.
export function recoveredSourcesView(item, { document, date, compact = false }) {
  const sources = item.alternativeSources || [];
  if (!sources.length && !item.originalReading?.pdf) return null;
  const make = (tag, className, text = '') => {
    const el = document.createElement(tag); el.className = className; el.textContent = text; return el;
  };
  const link = (text, value) => {
    const el = make('a', 'detail-link', `${text} ↗`);
    try {
      const url = new URL(value);
      if (/^https?:$/.test(url.protocol)) { el.href = url.href; el.target = '_blank'; el.rel = 'noopener noreferrer'; }
    } catch { /* Keep the label, never create an unsafe link. */ }
    return el;
  };
  const readerName = (reader) => ({ wordpress_api_publica: 'API pública do portal',
    pdf_paginas_ocr_seletivo: 'PDF original, com OCR nas páginas escaneadas',
    pdf_paginas_pypdf: 'Texto do PDF original', readability: 'Leitura da página (Readability)',
    trafilatura: 'Leitura da página (Trafilatura)' }[reader] || reader || 'Leitor não informado');
  const root = make(compact ? 'details' : 'section', 'recovered-sources');
  root.append(make(compact ? 'summary' : 'h4', '', sources.length
    ? `Fontes alternativas (${sources.length}) · texto e origem` : 'Leitura do documento original'));
  const original = make('div', 'recovery-original');
  original.append(make('strong', '', `Publicação original · ${item.source || 'Fonte não informada'}`),
    make('p', '', item.originalTitle
      ? `Título original preservado: “${item.originalTitle}”. O título de consulta e o ano acima foram conferidos no documento ou na fonte citada durante a revisão retroativa; não representam uma nova coleta nem um novo envio.`
      : item.automaticAlternativeReview
      ? 'O título e a data continuam ligados à publicação original. A decisão usa a fonte alternativa indicada, sem substituir o texto original nem simular revisão humana.'
      : 'O título e a data continuam ligados à publicação original. A justificativa acima é a da decisão registrada; estas leituras não a reescrevem.'),
    link('Abrir publicação original', item.url));
  if (item.originalReading) {
    const reading = item.originalReading;
    original.append(make('p', '', `${readerName(reading.reader)} · recuperado em ${date(reading.recoveredAt, true)}.`));
    const details = make('details', 'recovery-reading');
    details.append(make('summary', '', item.fullText ? 'Ler texto guardado da fonte original' : 'Ver trecho guardado da fonte original'),
      make('blockquote', '', item.fullText || reading.excerpt || 'Trecho não disponível.'));
    if (!item.fullText) details.append(make('p', 'recovery-note', 'Trecho de consulta. O texto integral fica preservado no acervo local.'));
    details.append(link(reading.pdf ? 'Abrir PDF original' : 'Abrir página de onde saiu este texto', reading.url));
    original.append(details);
  } else original.append(make('p', 'recovery-note', 'Sem texto integral original guardado. Uma fonte alternativa não preenche essa lacuna por substituição.'));
  root.append(original);
  for (const source of sources) {
    const card = make('article', 'recovery-source');
    card.append(make('span', 'recovery-kind', 'OUTRA FONTE · NÃO É O ORIGINAL'),
      make('h5', '', source.source), make('p', 'recovery-title', source.title),
      make('p', 'recovery-note', `Publicado nesta fonte: ${date(source.publishedAt)} · ${source.preservedReadingAt ? 'vínculo registrado' : 'texto recuperado'} em ${date(source.recoveredAt, true)}`),
      make('p', 'recovery-use', source.decisionNote),
      make('p', 'recovery-note', `Independência: ${source.independence}`),
      make('h6', '', 'Trecho recuperado desta fonte'), make('blockquote', '', source.excerpt),
      link('Ler na fonte alternativa', source.url));
    const provenance = make('details', 'recovery-reading');
    provenance.append(make('summary', '', 'Por que foi relacionada e como foi lida'),
      make('p', '', source.relation),
      make('p', '', source.dateCompared ? 'As datas foram comparadas automaticamente; isso não confirma equivalência.'
        : 'Não havia datas suficientes para confirmar a correspondência temporal.'),
      make('p', '', `${source.discovery} · ${readerName(source.reader)}.`));
    if (source.preservedReadingAt) provenance.append(make('p', '',
      `Leitura preservada de ${date(source.preservedReadingAt, true)}. O vínculo foi recuperado depois; não é uma nova abertura do site.`));
    if (source.validationUrl) provenance.append(link('Ver execução de validação', source.validationUrl));
    card.append(provenance);
    if (source.fullText) {
      const full = make('details', 'recovery-reading');
      full.append(make('summary', '', 'Ler texto integral desta fonte alternativa'), make('blockquote', '', source.fullText));
      card.append(full);
    } else card.append(make('p', 'recovery-note', 'Trecho de consulta; a íntegra não é republicada no painel público. Use o link da fonte.'));
    root.append(card);
  }
  return root;
}
