import { readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { enrichArticle } from '../src/lib/article-enrichment.mjs';
import { redactPublicText } from '../src/lib/article-text-store.mjs';
import { protectedSnapshot } from './pilot-retroactive-ten.mjs';
const before = await protectedSnapshot();
const folder = 'output/historical-thirteen';
for (const prefix of ['afae42c5','e41368d4','74fb6772']) {
  const file = `${folder}/${prefix}.json`;
  const row = JSON.parse(await readFile(file,'utf8'));
  row.previousError = row.error || ''; delete row.error; delete row.text;
  if (prefix === 'afae42c5') {
    const response = await fetch(row.resolvedUrl, {signal:AbortSignal.timeout(20000)});
    assert.ok(response.ok);const bytes=Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.subarray(0,5).toString(),'%PDF-'); assert.ok(bytes.length<20_000_000);
    await writeFile(`${folder}/${prefix}.pdf`,bytes);
    const {stdout}=await promisify(execFile)('python',['scripts/extract-public-pdf.py',`${folder}/${prefix}.pdf`],{env:{...process.env,PYTHONIOENCODING:'utf-8'},windowsHide:true});
    const pdf=JSON.parse(stdout); assert.ok(pdf.completo);
    Object.assign(row,{url:row.resolvedUrl,text:pdf.paginas.map(p=>p.texto).join('\n\n'),reader:'pypdf por página',pdf,
      pdfSha256:createHash('sha256').update(bytes).digest('hex')});
  } else {
    const alternative = prefix==='74fb6772';
    const url = alternative ? 'https://conclima.org.br/municipios-do-parana-subscrevem-o-protocolo-de-intencoes-do-conclima/' : row.resolvedUrl;
    const title = alternative ? 'Municípios do Paraná subscrevem o Protocolo de Intenções do Conclima' : row.title;
    const article=await enrichArticle({kind:'news',url,title,summary:''},{onFailure:(_,reason)=>row.error=reason});
    assert.ok(article.rawText?.length>500, row.error||'Texto insuficiente');
    Object.assign(row,{url:article.articleUrl,apiUrl:article.apiUrl,text:redactPublicText(article.rawText),reader:article.articleReader,date:article.sourcePublishedAt,
      alternative,alternativeTitle:alternative?title:'',comparison:article.extractionCategories});
  }
  await writeFile(file,JSON.stringify(row,null,2)+'\n'); console.log(prefix,row.text.length,row.url);
}
assert.deepEqual(await protectedSnapshot(),before);
