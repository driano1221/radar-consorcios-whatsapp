// CIGA's independent CKAN bulk export. Does not crawl the DOM/SC frontend.
import { load } from 'cheerio';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fetchWithRetry } from '../http.mjs';
import { normalizeWhitespace } from '../text.mjs';
import { sigpubDate } from './direct-gazettes.mjs';

const HOST='dados.ciga.sc.gov.br';
const RESOURCE=/^\/dataset\/[a-f0-9-]{36}\/resource\/[a-f0-9-]{36}\/download\/cigadados_publicacoes_(\d{4}_\d{2}_\d{2}_\d{4}_\d{4})\.zip$/;
const localDay=date=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
const clean=value=>normalizeWhitespace(value||'');

export function cigaResources(payload, since, now=new Date()) {
  if(payload?.success!==true||!Array.isArray(payload.result?.resources)||payload.result.private===true) {
    throw new Error('CIGA: pacote CKAN público inválido');
  }
  return payload.result.resources.map(resource=>{
    let u;try{u=new URL(resource.url);}catch{return null;}
    const match=u.pathname.match(RESOURCE);
    if(u.protocol!=='https:'||u.hostname!==HOST||!match||u.search||u.hash) return null;
    const date=match[1].slice(0,10).replaceAll('_','-');
    if(date<localDay(since)||date>localDay(now))return null;
    return {url:u.href,key:match[1],date,size:Number(resource.size)||0};
  }).filter(Boolean).sort((a,b)=>b.key.localeCompare(a.key));
}

export function parseCigaExportRow(row, resource, site, since, now=new Date()) {
  const id=String(row?.codigo||'');
  if(!/^\d{1,12}$/.test(id)||!row.titulo||typeof row.texto!=='string') throw new Error('CIGA: ato incompleto');
  const link=new URL(row.link);
  if(link.protocol!=='https:'||!['diariomunicipal.sc.gov.br','www.diariomunicipal.sc.gov.br'].includes(link.hostname)||
    link.searchParams.get('q')!==`id:${id}`)throw new Error('CIGA: link/código fora da origem');
  let publishedAt='';
  if(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(row.data||'')) publishedAt=row.data.replace(' ','T')+'-03:00';
  else publishedAt=sigpubDate(row._edition_date||'');
  if(!publishedAt||!Number.isFinite(new Date(publishedAt).getTime()))throw new Error('CIGA: data não comprovada');
  if(localDay(new Date(publishedAt))<localDay(since)||localDay(new Date(publishedAt))>localDay(now))return null;
  const $=load(row.texto);
  $('script,style,head,nav,footer,form,iframe').remove();
  $('p,li,h1,h2,h3,h4,br,tr').append(' ');
  const text=clean($('body').text());
  // PDF metadata, signatures and page menus must not become search evidence.
  if(!/cons[oó]rcio/i.test(text) && !(text.length<100&&/cons[oó]rcio/i.test(row.titulo)))return null;
  const url=`https://diariomunicipal.sc.gov.br/atos/${id}`;
  return {kind:'gazette',title:clean(row.titulo),url,articleUrl:url,publishedAt,sourcePublishedAt:publishedAt,
    source:site.name,sourceUrl:site.url,stateCode:'SC',territoryName:clean(row.municipio),
    gazetteCode:id,gazettePublisher:clean(row.entidade),scraper:'ciga-open-data',
    rawText:text.length>=100?text:'',summary:text.slice(0,1800),
    articleFetchUrl:resource.url,articleVariant:'exportacao_oficial_ckan',
    articleReader:'ciga_dados_abertos',contentProvenance:text.length>=100?'pagina_original':'resumo_listagem',
    previewOnly:text.length<100||site.publish!==true,
    ...(text.length<100?{extractionError:'CIGA: texto exportado curto; não prova íntegra suficiente'}:{})};
}

export function decodeCigaZip(bytes) {
  return new Promise((resolve,reject)=>{
    const child=spawn(process.env.PYTHON_BIN||'python',[fileURLToPath(new URL('../../../scripts/read-ciga-export.py',import.meta.url))],
      {windowsHide:true,stdio:['pipe','pipe','pipe']});
    const chunks=[];let size=0;let errors='';
    const timer=setTimeout(()=>{child.kill();reject(new Error('CIGA: leitura ZIP excedeu 30 segundos'));},30000);
    child.stdout.on('data',chunk=>{size+=chunk.length;if(size>20_000_000)child.kill();else chunks.push(chunk);});
    child.stderr.on('data',chunk=>{errors+=chunk.toString().slice(0,500);});
    child.on('error',error=>{clearTimeout(timer);reject(error);});
    child.on('close',code=>{
      clearTimeout(timer);
      if(code!==0||size>20_000_000)return reject(new Error(errors.trim()||'CIGA: falha ao ler exportação ZIP'));
      try{resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));}catch(error){reject(error);}
    });
    child.stdin.on('error',()=>{});child.stdin.end(bytes);
  });
}

async function request(url, config, fetchImpl, limit) {
  const r=await fetchWithRetry(url,{fetchImpl,timeoutMs:config.timeoutMs||25000,retries:config.retries??1,
    redirect:'error',headers:{'user-agent':config.userAgent||'RadarConsorciosIPEA/0.3 (+pesquisa academica)'}});
  if(!r.ok)throw new Error(`CIGA dados abertos HTTP ${r.status}`);
  const chunks=[];let size=0;
  for await(const chunk of r.body){size+=chunk.length;if(size>limit)throw new Error('CIGA: resposta maior que o limite');chunks.push(chunk);}
  return Buffer.concat(chunks);
}

export async function fetchCigaOpenData(site,since,config={},fetchImpl=fetch,decode=decodeCigaZip){
  if(site.url!==`https://${HOST}/dataset/`)throw new Error('CIGA: origem CKAN inesperada');
  const now=config.now||new Date();const started=Date.now();
  // Three latest published exports, not every ZIP of every historical month.
  const months=[...new Set([localDay(now).slice(0,7),localDay(since).slice(0,7)])];
  const resources=[];const errors=[];
  for(const month of months){
    const [year,mm]=month.split('-');
    const url=`https://${HOST}/api/3/action/package_show?id=domsc-publicacoes-de-${mm}-${year}`;
    try{resources.push(...cigaResources(JSON.parse((await request(url,config,fetchImpl,3_000_000)).toString('utf8')),since,now));}
    catch(error){errors.push(error.message);}
  }
  const selected=[...new Map(resources.map(r=>[r.url,r])).values()].sort((a,b)=>b.key.localeCompare(a.key))
    .slice(0,Math.min(site.maxResources||3,6));
  if(!selected.length)throw new Error(errors.join('; ')||'CIGA: nenhum pacote recente localizado');
  const items=new Map();let total=0;let opened=0;let oldest='';
  for(const resource of selected){
    if(resource.size>12_000_000){errors.push('CIGA: pacote maior que 12 MB adiado');continue;}
    try{
      const decoded=await decode(await request(resource.url,config,fetchImpl,12_000_000));
      if(!Array.isArray(decoded.rows)||!Number.isInteger(decoded.total))throw new Error('CIGA: exportação decodificada inválida');
      total+=decoded.total;opened++;oldest=resource.key;
      for(const row of decoded.rows){
        const item=parseCigaExportRow(row,resource,site,since,now);
        if(item&&!items.has(item.url))items.set(item.url,item);
      }
    }catch(error){errors.push(`${resource.key}: ${error.message}`);}
  }
  if(!opened)throw new Error(errors.join('; '));
  const rows=[...items.values()];
  return {items:rows,diagnostic:{name:site.name,adapter:site.adapter,status:errors.length||rows.some(i=>i.extractionError)?'degraded':'ok',
    itemCount:rows.length,fullTextCount:rows.filter(i=>i.contentProvenance==='pagina_original').length,
    resources:opened,rawActOccurrences:total,oldestResource:oldest,durationMs:Date.now()-started,
    message:`${opened} pacotes oficiais; ${rows.length} atos únicos sobre consórcios. Exportações periódicas: não é busca nacional nem histórico integral.`+
      (errors.length?` ${errors.join('; ')}`:'')}};
}
