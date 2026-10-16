// Network diagnostics only: no API keys, catalogue writes, queue or sender.
import { mkdir, writeFile } from 'node:fs/promises';
import { XMLParser } from 'fast-xml-parser';
import { searchPublicWordpress } from '../src/lib/public-document-recovery.mjs';
import { protectedSnapshot } from './pilot-retroactive-ten.mjs';
import { enrichArticle } from '../src/lib/article-enrichment.mjs';
const before = await protectedSnapshot();
const article = '/comunicacao/noticias/municipios-de-santa-catarina-assinam-adesao-ao-conclima-saiba-como-participar';
const targets = [
  ['cnm_article', 'https://cnm.org.br'+article],
  ['cnm_public_api_host', 'https://api.cnm.org.br'+article],
  ['cnm_pdf', 'https://cnm.org.br/storage/biblioteca/Revista_CNM_nov2020_.pdf'],
  ['conclima_rss', 'https://conclima.org.br/feed/'],
];
const results = [];
for(const slug of ['municipios-de-santa-catarina-assinam-adesao-ao-conclima-saiba-como-participar',
  'cnm-orienta-gestores-sobre-posicao-da-receita-federal-que-trata-de-consorcios-publicos']) {
  const url='https://cnm.org.br/comunicacao/noticias/'+slug;
  try {
    const failures=[];
    const item=await enrichArticle({url,kind:'news',title:'Notícia CNM',source:'CNM'},{onFailure:(_,reason)=>failures.push(reason)});
    results.push({kind:'cnm_original_reader',url,usable:item.articleReader==='cnm_inertia_publica',
      chars:item.rawText?.length||0,title:item.sourceTitle||'',reader:item.articleReader||'',date:item.sourcePublishedAt||'',failures});
  }catch(e){results.push({kind:'cnm_original_reader',url,usable:false,error:e.message});}
}
for(const [kind,url] of targets) {
  try {
    const r=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{'user-agent':'RadarConsorciosIPEA/0.3 (+pesquisa academica)'}});
    const chunks=[];let bytes=0;
    // For a PDF only check the header: this is not article text recovery.
    for await(const chunk of r.body) {chunks.push(chunk);bytes+=chunk.length;if(kind==='cnm_pdf'||bytes>1_000_000)break;}
    const buffer=Buffer.concat(chunks),text=buffer.toString('utf8');
    const challenge=/Just a moment|challenges\.cloudflare|cf-chl-|captcha/i.test(text);
    let documents=null;
    if(kind==='conclima_rss'&&r.ok&&!challenge){const data=new XMLParser().parse(text);const items=data.rss?.channel?.item;documents=items?Array.isArray(items)?items.length:1:0;}
    results.push({kind,url,status:r.status,contentType:r.headers.get('content-type'),challenge,
      usable:r.ok&&!challenge&&(kind==='cnm_pdf'?buffer.subarray(0,5).toString()==='%PDF-':kind==='conclima_rss'?documents>0:text.includes('Amerios')),documents});
  }catch(e){results.push({kind,url,usable:false,error:e.message});}
}
try {
  const posts=await searchPublicWordpress({titulo:'Consórcio Conclima'},fetch,'conclima.org.br');
  results.push({kind:'conclima_public_rest',usable:posts.some(p=>p.apiReading.rawText.includes('Amerios')),
    documents:posts.length,readings:posts.map(p=>({url:p.url,title:p.titulo,chars:p.apiReading.rawText.length,
      date:p.data_noticia_original,api:p.apiReading.apiUrl}))});
}catch(e){results.push({kind:'conclima_public_rest',usable:false,error:e.message});}
const unchanged=JSON.stringify(before)===JSON.stringify(await protectedSnapshot());
const report={checkedAt:new Date().toISOString(),environment:process.env.GITHUB_ACTIONS?'github_actions':'local',
  productionUnchanged:unchanged,whatsappCalls:0,results};
await mkdir('output/cnm-access',{recursive:true});
await writeFile('output/cnm-access/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(!unchanged)throw new Error('Protected files changed');
if(!results.some(r=>r.kind==='conclima_public_rest'&&r.usable))throw new Error('Public alternative API unavailable');
