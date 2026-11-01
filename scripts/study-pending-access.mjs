// Bounded read-only study of the five known failures. No catalog or delivery writes.
import assert from'node:assert/strict';
import{readFile,writeFile,mkdir,mkdtemp,rm}from'node:fs/promises';
import{execFile}from'node:child_process';
import{promisify}from'node:util';
import{tmpdir}from'node:os';
import path from'node:path';
import{fileURLToPath}from'node:url';
import{createHash}from'node:crypto';
import{load}from'cheerio';
import{enrichArticle}from'../src/lib/article-enrichment.mjs';
import{redactPublicText}from'../src/lib/article-text-store.mjs';
const digest=x=>createHash('sha256').update(x).digest('hex');
const key=raw=>{const u=new URL(raw);return u.hostname.replace(/^www\./,'')+u.pathname.replace(/\/$/,'');};
export function samePublisherPost(data,url){
 const post=Array.isArray(data)?data.find(p=>p.link&&key(p.link)===key(url)):data;
 if(!post?.link||key(post.link)!==key(url)||post.status!=='publish'||post.type!=='post'||post.content?.protected||typeof post.content?.rendered!=='string')return null;
 const $=load(post.content.rendered);$('script,style,nav,form').remove();$('p,li,br,h1,h2,h3').append(' ');
 const text=redactPublicText($.text().replace(/\s+/g,' ').trim());
 return text.length>=100?{text,date:post.date_gmt?post.date_gmt+'Z':'',reader:'wordpress_api_publica_mesmo_artigo',sourceUrl:post.link}:null;
}
async function main(){
 const directory='output/public-recovery';await mkdir(directory,{recursive:true});
 const batch=JSON.parse(await readFile('data/catalogo/conclusao-pendencias-51.json','utf8'));
 const archive=(await readFile('data/catalogo/arquivo-coletas.ndjson','utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
 const ids=batch.decisions.filter(d=>d.status==='processando').map(d=>d.id);assert.equal(ids.length,5);
 const extra={
  '29e26512':['https://www.reporterdiario.com.br/wp-json/wp/v2/posts/3919446'],
  '7b9e6e3e':['https://www2.itanhaem.sp.gov.br/wp-content/uploads/2023/10/829.pdf'],
  'ef76ec87':['https://midiamax.com.br/wp-json/wp/v2/posts?slug=tce-ms-anula-licitacao-r-36-milhoes-consorcio-central-irregularidades&per_page=1'],
  '198bc150':['https://api.cnm.org.br/comunicacao/noticias/presidente-da-cnm-aborda-desafios-do-financiamento-da-defesa-civil-em-evento-em-gramado-rs'],
 };
 const reports=[],readings=[];
 for(const id of ids){
  const row=archive.find(r=>r.id===id),original=row.article_resolved_url||row.article_url||row.url;
  const report={id,title:row.titulo,previousAttempts:Number(row.article_attempts||0),routes:[]};
  for(const url of[original,...(extra[id.slice(0,8)]||[])]){
   const route={url,attemptedAt:new Date().toISOString()};report.routes.push(route);
   try{
    const fetchImpl=async(input,options={})=>{
     await new Promise(resolve=>setTimeout(resolve,350));
     const response=await fetch(input,{...options,signal:AbortSignal.timeout(15000)});
     route.status=response.status;route.contentType=response.headers.get('content-type')||'';
     return response;
    };
    let reading;
    if(url.endsWith('.pdf')){
     const response=await fetchImpl(url,{redirect:'error'});if(!response.ok)throw Error('http_'+response.status);
     const chunks=[];let size=0;for await(const c of response.body){size+=c.length;if(size>20*1024*1024)throw Error('pdf_grande_demais');chunks.push(c);}
     const bytes=Buffer.concat(chunks);if(bytes.subarray(0,5).toString()!=='%PDF-')throw Error('resposta_nao_pdf');
     const temporary=await mkdtemp(path.join(tmpdir(),'radar-access-study-'));
     try{
      const pdf=path.join(temporary,'document.pdf');await writeFile(pdf,bytes);
      const{stdout}=await promisify(execFile)(process.env.RADAR_PYTHON||'python',['scripts/extract-public-pdf.py',pdf,'--ocr','--large'],{timeout:120000,maxBuffer:64*1024*1024,windowsHide:true});
      const parsed=JSON.parse(stdout);route.pages=parsed.paginas.length;route.complete=parsed.completo;route.pendingPages=parsed.paginas_pendentes;
      if(parsed.completo)reading={text:parsed.paginas.map(p=>`[Página ${p.pagina}]\n${p.texto}`).join('\n\n'),reader:'pdf_oficial_completo',sourceUrl:url,pages:parsed.paginas,pdfSha256:parsed.pdf_sha256};
     }finally{await rm(temporary,{recursive:true,force:true});}
    }else if(url.includes('/wp-json/')){
     const response=await fetchImpl(url,{redirect:'error'});if(!response.ok)throw Error('http_'+response.status);
     const chunks=[];let size=0;for await(const c of response.body){size+=c.length;if(size>2_000_000)throw Error('api_grande_demais');chunks.push(c);}
     const bytes=Buffer.concat(chunks);
     reading=samePublisherPost(JSON.parse(bytes),original);
    }else{
     let reason='';const item=await enrichArticle({kind:'news',title:row.titulo,url,summary:'',source:row.fonte},
       {fetchImpl,onFailure:(_,failure)=>reason=failure});
     route.failure=reason;
     if(item.contentProvenance==='pagina_original')reading={text:redactPublicText(item.rawText),reader:item.articleReader,sourceUrl:item.articleUrl,date:item.sourcePublishedAt};
    }
    if(reading){route.characters=reading.text.length;route.bodyHash=digest(reading.text);route.reader=reading.reader;readings.push({id,route:url,...reading,bodyHash:route.bodyHash});}
   }catch(error){route.failure=error.message.slice(0,160);}
  }
  reports.push(report);console.log(JSON.stringify({id:id.slice(0,8),routes:report.routes.map(r=>({status:r.status,characters:r.characters||0,failure:r.failure||'',reader:r.reader||''}))}));
 }
 await writeFile(`${directory}/pending-access-study.json`,JSON.stringify({at:new Date().toISOString(),reports,aiCalls:0,whatsappSends:0,archiveWrites:0},null,2));
 await writeFile(`${directory}/pending-access-readings.json`,JSON.stringify(readings,null,2));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
