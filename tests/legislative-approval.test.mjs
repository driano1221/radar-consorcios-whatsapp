import test from 'node:test';import assert from 'node:assert/strict';
import{readFile}from'node:fs/promises';import{createHash}from'node:crypto';
import{classifyItem}from'../src/lib/classifier.mjs';import{applySimpleTriage}from'../src/lib/simple-triage.mjs';
import{formalActDate}from'../src/lib/publication-date.mjs';import{legislativeApproval}from'../src/lib/operative-act.mjs';
import{decidePublication}from'../src/lib/publication-gate.mjs';
import{reviewCatalogRow}from'../scripts/reprocess-triage.mjs';
const title='Projeto de Lei Nº 10/2026 - Câmara Municipal',head='PROJETO DE LEI Nº 10/2026 APROVA O CONTRATO DE CONSÓRCIO PÚBLICO E O ESTATUTO SOCIAL DO CONSÓRCIO INTERFEDERATIVO. Art. 7º. Autoriza celebrar contratos de rateio. ',
 stamp=n=>`CÂMARA MUNICIPAL APROVADO EM ${n}ª VOTAÇÃO Documento aprovado em 16/03/2026 com 11 votos favoráveis e 1 votos contrários de 14 presentes. `;
test('aprovação parlamentar datada é governança; não é sanção, ingresso nem rateio assinado',()=>{
 const rawText=head+stamp(1)+stamp(2)+'Esta folha foi gerada automaticamente em: 08/11/2026';
 const item={title,rawText,kind:'news',url:'https://camara.gov.br/doc/1',publishedAt:'2026-11-08T00:00:00Z'};item.classification=classifyItem(item);
 const d=applySimpleTriage(item).triage;
 assert.equal(d.status,'confirmado');assert.equal(d.category,'GOVERNANÇA');assert.equal(d.method,'regra_documental_especifica');
 assert.match(d.stage,/primeira e segunda votação/);assert.match(d.stage,/sanção, ingresso efetivo e rateio assinado não comprovados/);
 assert.ok(rawText.includes(d.evidence));assert.equal(formalActDate(item),'2026-03-16T00:00:00.000Z');
 assert.equal(decidePublication(item,{now:new Date('2026-11-08T00:00:00Z')}).publicationDecision,'historico');
 assert.equal(decidePublication({...item,eventAt:'2026-11-08T00:00:00Z'},{now:new Date('2026-11-08T00:00:00Z')}).publicationDecision,'historico');
});
test('proposta, assinatura, modelo, data futura ou votação de anexo não comprovam aprovação própria',()=>{
 for(const rawText of[head+'Assinatura FINALIZADA. Art. 1º Fica aprovado o contrato.',head+'não '+stamp(1),head+stamp(1).replace('16/03/2026','16/03/2099'),head+'LISTA DE ANEXOS E ATOS VINCULADOS '+stamp(2)])assert.equal(legislativeApproval(title,rawText),null);
 assert.equal(legislativeApproval(title.replace('10/','11/'),head+stamp(1)),null);
 assert.equal(legislativeApproval(title,head+stamp(1).replace('11 votos favoráveis','0 votos favoráveis')),null);
});
test('Viçosa preserva as seis páginas e a aprovação histórica com bloqueios de envio',async()=>{
 const id='cb9ed2abbd7930c9ac25e7820e86061f934a61ae3331c6bfba4d42d6df009ac3';
 const nd=async name=>(await readFile('data/catalogo/'+name+'.ndjson','utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
 const row=(await nd('arquivo-coletas')).find(r=>r.id===id),text=(await nd('textos-artigos')).find(t=>t.documento_id===id),d=(await nd('triagem-reprocessada')).find(x=>x.documentId===id);
 assert.ok(text);assert.equal((text.texto.match(/\[Página \d+\]/g)||[]).length,6);
 assert.equal(createHash('sha256').update(text.texto).digest('hex'),'4b717215770aced9401e1c5a60bd2b69d18a34d5d4f111ccc08c3ce2e79a16e8');
 assert.equal(reviewCatalogRow(row,{},text).category,'GOVERNANÇA');assert.equal(d.status,'confirmado');assert.equal(d.method,'regra_documental_especifica');
 assert.deepEqual([d.retroactive,d.alertAllowed,d.weeklyAllowed],[true,false,false]);assert.equal(row.data_fato,'2026-03-16T00:00:00.000Z');
});
