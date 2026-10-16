// Primary legal evidence is separate from the preserved news text.
export function primaryEvidenceView(item, {document}) {
  if (!item.primaryDocuments?.length && !item.sourceDivergence) return null;
  const el=(tag,text='',className='')=>{
    const node=document.createElement(tag); node.textContent=text; node.className=className; return node;
  };
  const root=el('section','','recovered-sources');
  root.append(el('h4','Documentos oficiais usados na revisão'),
    el('p','Revisão retroativa: as fontes abaixo complementam a notícia original. Não são uma nova coleta nem um novo envio.','recovery-note'));
  if(item.sourceDivergence) {
    const warning=el('div','','content-warning');
    warning.append(el('strong','Divergência entre notícia e documento'),
      el('p',item.sourceDivergence.noticia),el('p',item.sourceDivergence.documento),
      el('p',item.sourceDivergence.criterio,'recovery-note'));
    root.append(warning);
  }
  for(const source of item.primaryDocuments||[]) {
    const block=el('article','','recovery-source');
    block.append(el('strong',source.title),el('p',`Página ${source.page}`,'recovery-note'),
      el('blockquote',source.excerpt));
    try {
      const url=new URL(source.url);
      if(url.protocol==='https:') {
        url.hash=`page=${source.page}`;
        const a=el('a','Abrir documento oficial ↗','detail-link');
        a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';block.append(a);
      }
    } catch { /* Untrusted metadata never becomes an executable link. */ }
    root.append(block);
  }
  return root;
}
