// Keep the complete PDF reading; classify its relevant operative unit separately.
export function bulletinUnit(row,stored) {
  if(!/^pdf/.test(stored?.leitor||'')||!/^di[aá]rio oficial|^untitled/i.test(row.titulo||'')||stored.titulo_documento)return null;
  const text=stored.texto||'',first=/\bcons[oó]rci[oa]\b/i.exec(text);
  if(!first)return null;
  if(/RELAT[OÓ]RIO DE BALAN[CÇ]O DO\s+PLANO DE FISCALIZA[CÇ][AÃ]O/i.test(text))
    return {title:'Relatório de balanço do plano de fiscalização',text,page:1};
  const headers=[...text.matchAll(/\b(?:RESOLU[CÇ][AÃ]O\s+[A-ZÀ-Ý-]+\s+N[º°o.]*\s*\d+|DECRETO\s+n[º°o.]*\s*\d+[\d./]*|DISPENSA DE LICITA[CÇ][AÃ]O\s+N[º°o.]*\s*\d+[\d./]*|EXTRATO\s+TERMO\s+ADITIVO|[Aa]ta da \d+[ªºa.]?\s+Assembleia Geral Extraordin[aá]ria do Cons[oó]rcio[^\n]{0,130}|PORTARIA\s+N[º°o.]*\s*\d+[\d./]*)/g)];
  const start=headers.filter(m=>m.index<first.index).at(-1);
  if(!start)return null;
  const next=headers.find(m=>m.index>first.index&&m[0]!==start[0]);
  const end=/^EXTRATO/i.test(start[0])?text.indexOf('[Página ',start.index):next?.index;
  const pages=[...text.slice(0,start.index).matchAll(/\[Página (\d+)\]/g)];
  return {title:start[0],text:text.slice(start.index,end>start.index?end:undefined),page:Number(pages.at(-1)?.[1]||1)};
}
