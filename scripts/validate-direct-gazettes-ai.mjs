// Five public examples; no persistent cache, state, catalogue or WhatsApp writes.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { classifyItem } from '../src/lib/classifier.mjs';
import { reviewWithDeepSeek, applyAiReview } from '../src/lib/ai-review.mjs';
import { locateQuote } from '../src/lib/quote-evidence.mjs';
assert.notEqual(process.env.SEND_ENABLED,'true');
assert.notEqual(process.env.PERSIST_STATE,'true');
const report=JSON.parse(await readFile('output/direct-gazettes/report.json','utf8'));
const definitions=[
  ['A54CFAEC','rejected',[]], // Generic budget credit, not a signed rateio.
  ['3DC37B4C','rejected',[]], // Budget lines do not establish execution.
  ['E8656463','rejected',[]], // Private supplier procurement, not municipal entry.
  ['9D13CAC8','approved',['RATEIO']], // Published rateio, not a new membership.
  ['82BE246D','approved',['GOVERNANÇA','PROTOCOLO']], // Ratification, not an actual crisis.
];
const results=[];
try{
  for(const [code,status,categories]of definitions){
    const row=report.samples.find(i=>i.url.endsWith('/'+code));
    assert.ok(row,`Exemplo público não recuperado: ${code}`);
    const item={kind:'gazette',title:row.title,url:row.url,publishedAt:row.publishedAt,
      sourcePublishedAt:row.publishedAt,source:row.reader,rawText:row.text,summary:row.text.slice(0,1800)};
    item.classification=classifyItem(item);
    let review;
    try{review=await reviewWithDeepSeek(item,{apiKey:process.env.DEEPSEEK_API_KEY});}
    catch(error){if(error.code!=='INVALID_AI_DECISION')throw error;
      review=await reviewWithDeepSeek(item,{apiKey:process.env.DEEPSEEK_API_KEY,retryStrict:true});}
    const after=applyAiReview(item,review);
    const literal=locateQuote(review.evidence,[item.rawText]);
    results.push({url:row.url,title:row.title,before:item.classification.category,status:review.status,
      after:after.classification.category,evidence:literal||'',literal:Boolean(literal),usage:review.usage,
      expectedStatus:status,expectedCategories:categories});
    assert.ok(literal,`${code}: prova precisa existir no corpo exportado`);
    assert.equal(review.status,status,`${code}: resultado contrário ao fato publicado`);
    if(categories.length)assert.ok(categories.includes(after.classification.category),`${code}: etapa institucional incorreta`);
    console.log(`[triagem de teste] ${code}: ${item.classification.category} → ${after.classification.category}; prova literal conferida.`);
  }
}catch(error){results.push({error:error.message});process.exitCode=1;console.error(error.message);}
finally{await writeFile('output/direct-gazettes/ai-validation.json',JSON.stringify({results,whatsappSends:0,persistedReviews:0},null,2));}
