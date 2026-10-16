import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { enrichArticle } from '../src/lib/article-enrichment.mjs';
import { protectedSnapshot } from './pilot-retroactive-ten.mjs';
import { redactPublicText } from '../src/lib/article-text-store.mjs';
export const IDS = ['afae42c5','c415a567','cc60e177','1bb8aa8d','68160372','a22322a6','74fb6772','b940d094','f46c947c','0c2c9c6b','cfbb82ef','e41368d4','e64cf89d'];
const nd = async n => (await readFile('data/catalogo/'+n,'utf8')).trim().split(/\r?\n/).map(JSON.parse);
const original = await protectedSnapshot();
const archive = await nd('arquivo-coletas.ndjson');
await mkdir('output/historical-thirteen', {recursive:true});
for (let offset=0; offset<IDS.length; offset+=3) await Promise.all(IDS.slice(offset,offset+3).map(async prefix => {
  const row=archive.find(x=>x.id.startsWith(prefix)); assert.ok(row);
  const result={id:row.id,title:row.titulo,originalUrl:row.url,originalSha256:createHash('sha256').update(JSON.stringify(row)).digest('hex'),attemptedAt:new Date().toISOString()};
  const url=row.article_resolved_url||row.article_url||row.url;
  try {
    const article=await enrichArticle({kind:'news',title:row.titulo,url,summary:''},{onFailure:(_,reason)=>result.error=reason,onResolved:(_,resolved)=>result.resolvedUrl=resolved});
    if(article.rawText) Object.assign(result,{url:article.articleUrl,apiUrl:article.apiUrl,text:redactPublicText(article.rawText),reader:article.articleReader,date:article.sourcePublishedAt,comparison:article.extractionCategories});
  } catch(error) { result.error=error.message; }
  await writeFile(`output/historical-thirteen/${prefix}.json`,JSON.stringify(result,null,2)+'\n');
  console.log(prefix,result.error||'ok',result.text?.length||0,result.resolvedUrl||url);
}));
assert.deepEqual(await protectedSnapshot(), original, 'Dados e estado devem permanecer intocados');
