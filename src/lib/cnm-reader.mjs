import { load } from 'cheerio';
import { normalizeWhitespace } from './text.mjs';

// The public CNM page ships its article in Inertia's data-page attribute.
// Read only props.noticia; related stories, routes and account fields are not content.
export function parseCnmArticle(html, articleUrl) {
  let url;
  try { url = new URL(articleUrl); } catch { return null; }
  if (!['cnm.org.br','www.cnm.org.br','api.cnm.org.br'].includes(url.hostname) || url.protocol !== 'https:') return null;
  const slug=url.pathname.match(/^\/comunicacao\/noticias\/([^/]+)\/?$/)?.[1];
  if(!slug)return null;
  const $=load(html);
  if(/^(?:just a moment|attention required|verifica[cç][aã]o de seguran[cç]a)/i.test($('title').text().trim()) ||
    $('#challenge-form,#challenge-running,#cf-challenge-running').length ||
    /verify you are human|verifique que voc[eê] [eé] humano/i.test($('body').text()))return null;
  let page;try{page=JSON.parse($('#app[data-page]').attr('data-page')||'');}catch{return null;}
  const article=page.props?.noticia;
  if(page.component!=='Portal/Comunicacao/Noticia' || typeof page.url!=='string' || page.url.split('?')[0].replace(/\/$/,'')!==url.pathname.replace(/\/$/,'') ||
    article?.slug!==slug || !Number.isInteger(article.id) || article.id<=0 ||
    typeof article.conteudo!=='string' || typeof article.titulo!=='string' || article.titulo.length<10)return null;
  const body=load(article.conteudo);body('script,style,nav,form,iframe,noscript').remove();body('p,li,h1,h2,h3,br').append(' ');
  const text=normalizeWhitespace(body.text());if(text.length<100)return null;
  const date=article.datetime?.match(/^(\d{2})\/(\d{2})\/(20\d{2})$/);
  return {text,title:article.titulo,id:article.id,slug,date:date?`${date[3]}-${date[2]}-${date[1]}`:''};
}
