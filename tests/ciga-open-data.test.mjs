import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {cigaResources,parseCigaExportRow,decodeCigaZip,fetchCigaOpenData} from '../src/lib/sources/ciga-open-data.mjs';
import {decidePublication} from '../src/lib/publication-gate.mjs';
import {classifyItem} from '../src/lib/classifier.mjs';

const site={name:'Diário Municipal SC (CIGA Dados Abertos)',adapter:'ciga-open-data',
  url:'https://dados.ciga.sc.gov.br/dataset/',articleHost:'diariomunicipal.sc.gov.br',publish:true,
  alertsFrom:'2026-10-20T00:00:00-03:00'};
const resource={url:'https://dados.ciga.sc.gov.br/dataset/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/resource/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/download/cigadados_publicacoes_2026_10_19_1200_1559.zip'};
const now=new Date('2026-10-19T22:00:00Z'), since=new Date('2026-10-12T03:00:00Z');
const body='O Município de Exemplo e o Consórcio Intermunicipal de Saúde Regional celebram o presente contrato de rateio para custear as atividades de saúde do exercício de 2026.';
const row={codigo:'8821838',titulo:'CONTRATO DE RATEIO Nº 4/2026',data:'2026-10-19 14:30:00',municipio:'Exemplo',entidade:'Prefeitura Municipal de Exemplo',
  link:'https://diariomunicipal.sc.gov.br/?q=id:8821838',texto:`<html><head><meta name="author" content="Não é prova"></head><body><p>${body}</p><script>não ler</script></body></html>`};

test('CKAN só aceita pacotes públicos, datados e de download oficial',()=>{
  const p={success:true,result:{private:false,resources:[resource,{url:resource.url.replace('dados.ciga.sc.gov.br','outro.org')} ]}};
  assert.equal(cigaResources(p,since,now).length,1);
  assert.equal(cigaResources(p,new Date('2026-10-20T03:00:00Z'),new Date('2026-10-22')).length,0);
  assert.throws(()=>cigaResources({success:true,result:{private:true,resources:[]}},since,now),/inválido/);
});

test('exportação oficial conserva corpo, proveniência ZIP, código/UF e data da edição',()=>{
  const item=parseCigaExportRow(row,resource,site,since,now);
  assert.equal(item.rawText,body);assert.equal(item.articleFetchUrl,resource.url);
  assert.equal(item.stateCode,'SC');assert.equal(item.url,'https://diariomunicipal.sc.gov.br/atos/8821838');
  assert.equal(item.contentProvenance,'pagina_original');assert.equal(item.previewOnly,false);
  const ordinary=parseCigaExportRow({...row,data:undefined,_edition_date:'19/10/2026'},resource,site,since,now);
  assert.equal(ordinary.publishedAt,'2026-10-19T15:00:00.000Z');
  assert.throws(()=>parseCigaExportRow({...row,link:row.link.replace('8821838','111')},resource,site,since,now),/código/);
  assert.equal(parseCigaExportRow({...row,texto:'<html><head><title>Consórcio fake</title></head><body>Outro assunto sem relação.</body></html>',titulo:'Outro assunto'},resource,site,since,now),null);
});

test('CIGA não libera histórico reindexado no Google nem texto curto exportado',()=>{
  const item=parseCigaExportRow(row,resource,site,since,now);
  const guarded=decidePublication({...item,source:'Google',url:'https://news.google.com/rss/articles/abc',
    classification:classifyItem(item)},{now,sourceActivations:[site]});
  assert.equal(guarded.publicationDecision,'historico');
  const short=parseCigaExportRow({...row,texto:'Consórcio sem texto'},resource,site,since,now);
  assert.equal(short.previewOnly,true);assert.ok(short.extractionError);
});

test('ZIP é lido só em memória, com Unicode e suporte a pacote sem edição ordinária',async()=>{
  const build=filename=>spawnSync('python',['-c',
    "import sys,json,zipfile,io; p=json.loads(sys.stdin.buffer.read()); b=io.BytesIO(); z=zipfile.ZipFile(b,'w',zipfile.ZIP_DEFLATED); z.writestr(p['filename'],json.dumps(p['data'])); z.close(); sys.stdout.buffer.write(b.getvalue())"],
    {input:JSON.stringify({filename,data:{autopublicacoes:[row],edicao_ordinaria:[]}}),maxBuffer:1_000_000,windowsHide:true});
  const zip=build('publicacoes_de_2026_10_19_1200_1559.json');assert.equal(zip.status,0);
  const decoded=await decodeCigaZip(zip.stdout);assert.equal(decoded.total,1);assert.equal(decoded.rows[0].titulo,row.titulo);
  await assert.rejects(decodeCigaZip(build('../escape.json').stdout),/fora do formato/);
});

test('CIGA desduplica ato repetido nos pacotes e não depende de abrir o DOM/SC',async()=>{
  const requests=[];
  const out=await fetchCigaOpenData(site,since,{now,retries:0},async url=>{
    requests.push(String(url));
    return String(url).includes('/api/')?Response.json({success:true,result:{private:false,resources:[resource,resource]}}):new Response('fakeZIP');
  },async()=>({total:2,rows:[row,row]}));
  assert.equal(out.items.length,1);assert.equal(out.diagnostic.resources,1);
  assert.ok(requests.every(u=>u.startsWith('https://dados.ciga.sc.gov.br/')));
});

test('CIGA honra os 25 segundos da fonte em vez dos 12 segundos gerais',async t=>{
  const timeouts=[];
  t.mock.method(AbortSignal,'timeout',ms=>{timeouts.push(ms);return new AbortController().signal;});
  const config={now,timeoutMs:12000,retries:0};
  const out=await fetchCigaOpenData({...site,timeoutMs:25000},since,config,async url=>
    String(url).includes('/api/')?Response.json({success:true,result:{private:false,resources:[resource]}}):new Response('ZIP'),
  async()=>({total:1,rows:[row]}));
  assert.equal(out.items.length,1);
  assert.deepEqual(timeouts,[25000,25000]);
  assert.equal(config.timeoutMs,12000,'não alterar a configuração dos outros coletores');
});

test('CIGA respeita a retentativa da fonte e identifica falha no catálogo',async()=>{
  let calls=0;
  await assert.rejects(fetchCigaOpenData({...site,retries:0},since,{now,retries:1},async()=>{
    calls++;throw new DOMException('catálogo lento','TimeoutError');
  }),/CIGA: catálogo 2026-10.*catálogo lento/);
  assert.equal(calls,1,'fonte com retries=0 não deve herdar a repetição geral');
});

test('CIGA recupera uma interrupção do corpo ZIP com uma única nova leitura',async()=>{
  let downloads=0;
  const out=await fetchCigaOpenData({...site,retries:1},since,{now,retries:0},async url=>{
    if(String(url).includes('/api/'))return Response.json({success:true,result:{private:false,resources:[resource]}});
    downloads++;
    let sentPartial=false;
    return downloads===1?new Response(new ReadableStream({pull(controller){
      if(!sentPartial){sentPartial=true;controller.enqueue(Buffer.from('fragmento incompleto'));}
      else controller.error(new DOMException('corpo interrompido','AbortError'));
    }})):new Response('ZIP completo');
  },async bytes=>{assert.equal(bytes.toString(),'ZIP completo');return{total:1,rows:[row]};});
  assert.equal(downloads,2);
  assert.equal(out.items.length,1);
  assert.equal(out.diagnostic.status,'ok');
});

test('CIGA limita repetição do corpo e não repete 403 nem resposta acima do tamanho permitido',async()=>{
  for(const failure of ['timeout','http403','oversized']){
    let downloads=0;
    await assert.rejects(fetchCigaOpenData({...site,retries:1},since,{now,retries:0},async url=>{
      if(String(url).includes('/api/'))return Response.json({success:true,result:{private:false,resources:[resource]}});
      downloads++;
      if(failure==='http403')return new Response('acesso negado',{status:403});
      if(failure==='oversized')return new Response(new Uint8Array(12_000_001));
      return new Response(new ReadableStream({start(controller){
        controller.error(new DOMException('corpo interrompido','TimeoutError'));
      }}));
    },async()=>{throw new Error('não decodificar conteúdo incompleto');}),
    failure==='http403'?/HTTP 403/:failure==='oversized'?/limite/:/corpo interrompido/);
    assert.equal(downloads,failure==='timeout'?2:1,failure);
  }
});
