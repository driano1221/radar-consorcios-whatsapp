// A norm URL identifies one act, not every act in the replacement bulletin.
// Fail closed if the matching law is absent, duplicated or its end is missing.
export function bulletinLaw(pages, { number, year, municipality }) {
  const numeric = String(number).replace(/\D/g, '');
  if (!/^\d+$/.test(numeric) || !/^20\d{2}$/.test(String(year)) || !municipality) throw Error('Identidade da lei ausente');
  const candidates = [];
  for (const page of pages) {
    const headers = [...page.texto.matchAll(/^LEI\s+N[º°o.]?\s*([\d.,]+),?\s+DE\s+([^\n]*\b20\d{2})\s*$/gim)];
    for (const header of headers) {
      if (header[1].replace(/\D/g, '') !== numeric || !header[2].endsWith(String(year))) continue;
      const tail = page.texto.slice(header.index);
      const end = /Projeto de Lei de autoria do Executivo\./i.exec(tail);
      const text = end && tail.slice(0, end.index + end[0].length).trim();
      if (!text || !text.includes(municipality) || !/\b(?:promulgo|sanciono)\b/i.test(text) ||
          !/Art\.?\s*1[º°]/i.test(text) || !/Art\.?\s*2[º°]/i.test(text) ||
          headers.some(h => h.index > header.index && h.index < header.index + text.length))
        throw Error('Lei encontrada, mas unidade incompleta ou ambígua');
      candidates.push({ text, title: header[0].trim(), page: page.pagina,
        start: header.index, end: header.index + text.length, number: numeric, year: Number(year), municipality });
    }
  }
  if (candidates.length !== 1) throw Error('É necessária uma única lei integral correspondente');
  return candidates[0];
}
