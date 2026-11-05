import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {classifyItem} from '../src/lib/classifier.mjs';
import {applySimpleTriage,assertNoReadableProcessing} from '../src/lib/simple-triage.mjs';
import {reviewCatalogRow} from '../scripts/reprocess-triage.mjs';
import {decidePublication,isNotifiable} from '../src/lib/publication-gate.mjs';
import {formalActDate} from '../src/lib/publication-date.mjs';
import {readFile} from 'node:fs/promises';
const sha=x=>createHash('sha256').update(x).digest('hex');
test('validação do catálogo detecta texto íntegro parado, preservando pendências de acesso',()=>{
 const row={id:'document',decisao_base:'processando'},texto='Texto integral validado. '.repeat(10),text={documento_id:row.id,texto,texto_sha256:sha(texto)};
 assert.throws(()=>assertNoReadableProcessing([row],[text]),/sem decisão editorial/);
 assert.doesNotThrow(()=>assertNoReadableProcessing([row],[]));
 assert.doesNotThrow(()=>assertNoReadableProcessing([{...row,decisao_base:'descartado'}],[text]));
 assert.doesNotThrow(()=>assertNoReadableProcessing([{...row,decisao_base:'confirmado',triagem_automatica:{status:'processando'}}],[text]),'decisão canônica concluída tem prioridade sobre marcador técnico antigo');
});
const samples=[
 ['Resolução Nº 2/2026','O Consórcio Intermunicipal de Saúde, em cumprimento ao Protocolo de Intenções. RESOLVE: Art. 1º Nomear Fiscal do Contrato de aquisição de pneus. O acompanhamento obedece à legislação administrativa vigente.','descartado','GERAL'],
 ['Termo de adesão','PROCESSO 1/2026. TERMO DE ADESÃO A ATA DE REGISTRO DE PREÇO. Consórcio Público é órgão gerenciador. EMPRESA CONTRATADA: Comércio de Móveis LTDA. OBJETO: aquisição de cadeiras para a secretaria municipal.','descartado','GERAL'],
 ['Presidência interina do consórcio','A prefeita assume interinamente a presidência do Consórcio Público Intermunicipal de Saúde durante a licença pessoal do titular. A transição temporária segue as normas do Estatuto e do Protocolo de Intenções.','confirmado','GOVERNANÇA'],
 ['1º Termo aditivo ao contrato de rateio','O Consórcio Intermunicipal de Saúde e o Município de Vila Nova celebram o presente Termo aditivo. Objeto: acréscimo ao contrato de rateio vigente. As partes assinam em 04/11/2026; pagamento não demonstrado.','confirmado','RATEIO'],
 ['Lei nº 100/2026','O Prefeito Municipal sanciona a seguinte Lei: Art. 2º Fica o Município de Vila Nova autorizado a participar do Consórcio Público Intermunicipal de Saúde Regional. Os contratos de rateio serão formalizados a cada exercício financeiro.','confirmado','ADESÃO AUTORIZADA'],
 ['Notícia do consórcio','O Consórcio Intermunicipal de Saúde apresentou a possibilidade de realizar novos projetos no ano seguinte. O texto menciona genericamente o protocolo, mas não comprova assinatura ou execução de outro ato institucional.','descartado','GERAL'],
];
test('conclusão legível usa o mesmo caminho na coleta e catálogo, com prova e sem fila/IA',()=>{
 for(const[title,rawText,status,category]of samples){
  const item={title,rawText,kind:'news',url:'https://oficial.gov.br/noticia/1'};item.classification=classifyItem(item);
  const normal=applySimpleTriage(item).triage;
  const catalog=reviewCatalogRow({id:'x',titulo:title,url:item.url,fonte:'Oficial',trecho:''},{kind:'news'},
    {texto:rawText,texto_sha256:sha(rawText),url_artigo:item.url});
  assert.equal(normal.status,status,title);assert.equal(normal.category,category,title);
  assert.deepEqual(catalog,normal);assert.ok(rawText.includes(normal.evidence));assert.equal(normal.bodyHash,sha(rawText));
  assert.equal(normal.nextAction,undefined);
 }
});
test('não confirma intenção ou negação de assinatura; ausência de corpo segue pendência de acesso',()=>{
 for(const prefix of ['não ','poderá ']){
  const rawText=`O Consórcio Intermunicipal ${prefix}firmou um termo de cooperação com universidades da região. A notícia discute a proposta e não apresenta documento assinado, execução regional ou outra mudança institucional comprovada.`;
  const item={title:'Parceria acadêmica',rawText,url:'https://oficial.gov.br/1',kind:'news'};item.classification=classifyItem(item);
  assert.notEqual(applySimpleTriage(item).triage.status,'confirmado');
 }
 const missing=applySimpleTriage({title:'Consórcio',rawText:'',classification:{category:'PROTOCOLO',score:9}}).triage;
 assert.equal(missing.status,'processando');assert.equal(missing.nextAction,'recuperar_texto');
});
test('ano/data do ato prevalece sobre página recente sem misturar leis federais citadas',()=>{
 const now=new Date('2026-11-05T20:00:00Z'),base={title:'LEI MUNICIPAL N.º 836/2025',kind:'gazette',url:'https://oficial.gov.br/1',
  publishedAt:'2026-11-05T15:00:00Z',sourcePublishedAt:'2026-11-05T15:00:00Z',classification:{category:'ADESÃO',score:9}};
 const body='A Câmara aprova e eu sanciono a lei. Art. 1º Autoriza participação em consórcio, nos termos da Lei Federal 11.107, de 06 de abril de 2005. Paço Municipal de Vila Nova, aos 25 de setembro de 2025.';
 assert.equal(formalActDate({...base,rawText:body},now),'2025-09-25T00:00:00.000Z');
 assert.equal(decidePublication({...base,rawText:body},{now}).publicationDecision,'historico');
 assert.equal(decidePublication({...base,rawText:body,eventAt:'2026-11-05T15:00:00Z'},{now}).publicationDecision,'historico');
 const ambiguous=decidePublication({...base,rawText:body.split('Paço')[0]},{now});
 assert.equal(ambiguous.publicationDecision,'data_nao_verificada');assert.equal(isNotifiable(ambiguous),false);
 assert.equal(formalActDate({...base,title:'Notícia atual sobre lei antiga',rawText:body},now),'');
});

test('boletim preserva todas as páginas e conclui somente o dispositivo relevante, sem confundir protocolo antigo',()=>{
 const texto='[Página 1]\nPORTARIA Nº 4/2026. Rotina de férias de servidor.\n[Página 2]\nRESOLUÇÃO AGÊNCIA-REGIONAL Nº 100\nA AGÊNCIA REGULADORA, consórcio público, fundamentada no protocolo ratificado em 2010. O colegiado RESOLVE: Art. 1º - Fixar os valores das Tarifas de Manejo de Resíduos Sólidos Urbanos no município. A cobrança deverá observar os prazos de publicação.\n[Página 3]\nRESOLUÇÃO AGÊNCIA-REGIONAL Nº 100\nANEXO I. Tabela de referência integral.\n[Página 4]\nPORTARIA Nº 9/2026. Rotina de pessoal.';
 const row={id:'boletim',titulo:'Diário Oficial de Vila Nova',url:'https://oficial.gov.br/edicao.pdf',fonte:'Oficial',trecho:'AGÊNCIA REGULADORA consórcio público'};
 const stored={texto,texto_sha256:sha(texto),leitor:'pdf_integral_por_pagina',url_artigo:row.url};
 const result=reviewCatalogRow(row,{kind:'gazette'},stored);
 assert.equal(result.status,'confirmado');assert.equal(result.category,'ATUAÇÃO');
 assert.equal(result.bodyHash,sha(texto));assert.ok(texto.includes(result.evidence));
 assert.match(result.stage,/cobrança e fiscalização executadas não comprovadas/);
 assert.equal(stored.texto,texto);
});

test('os 31 textos do lote têm prova específica, sem usar rejeição genérica para zerar a fila',async()=>{
 const nd=async n=>(await readFile('data/catalogo/'+n+'.ndjson','utf8')).split(/\r?\n/).filter(Boolean).map(JSON.parse);
 const batch=JSON.parse(await readFile('data/catalogo/triagem-38-alvos.json','utf8'));
 const rows=new Map((await nd('arquivo-coletas')).map(r=>[r.id,r]));
 const texts=new Map((await nd('textos-artigos')).map(t=>[t.documento_id,t]));
 for(const target of batch.targets.filter(t=>!t.needsReading)){
  const row=rows.get(target.id),text=texts.get(target.id);assert.ok(text);
  assert.equal(sha(text.texto),text.texto_sha256);
  const d=reviewCatalogRow(row,{},text);
  assert.ok(['confirmado','descartado'].includes(d.status),target.id);
  assert.notEqual(d.method,'leitura_sem_prova_delimitada',target.title);
  assert.ok(text.texto.includes(d.evidence),target.title);
 }
});
