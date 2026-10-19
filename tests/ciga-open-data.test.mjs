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
