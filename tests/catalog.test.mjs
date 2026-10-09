import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { catalogRecord, mergeCatalogRecord, mergeStateIntoCatalog, saveCatalog } from '../src/lib/catalog.mjs';

test('catálogo guarda o texto de itens gerais e preserva o link direto recuperado', () => {
  const item = { kind: 'news', title: 'Consórcio abre seleção', url: 'https://news.google.com/rss/articles/id',
    articleUrl: 'https://example.org/materia', summary: 'A seleção oferece onze vagas para profissionais de saúde.',
    classification: { category: 'GERAL', score: 0 } };
  const enriched = catalogRecord(item, '2026-10-05T00:00:00Z', '2026-10-05T00:00:00Z');
  assert.match(enriched.trecho, /onze vagas/);
  assert.equal(enriched.article_url, item.articleUrl);
  assert.equal(mergeCatalogRecord(enriched, { ...enriched, article_url: '' }).article_url, item.articleUrl);
});

test('descarte com prova explícita mostra o trecho que explica a decisão', () => {
  const row = catalogRecord({ kind: 'news', title: 'Questiona criação de consórcio',
    url: 'https://example.org/depoimento', summary: 'Resumo genérico sobre uma audiência.',
    classification: { category: 'GERAL', score: 0, stage: 'criação apenas cogitada',
      evidenceText: 'O depoente questionou a possível criação de um novo consórcio.' } },
  '2026-10-08T12:00:00Z', '2026-10-08T12:00:00Z');
  assert.match(row.trecho, /questionou a possível criação/);
  assert.equal(row.etapa, 'criação apenas cogitada');
});

const at = '2026-10-02T15:00:00.000Z';

test('lei que autoriza ingresso não vira participação confirmada', () => {
  const row = catalogRecord({ kind: 'gazette', title: 'LEI Nº 42/2026',
    url: 'https://diario.exemplo/lei/42', source: 'Diário Oficial',
    territoryName: 'Pains', stateCode: 'MG', classification: {
      category: 'ADESÃO AUTORIZADA', score: 12,
      evidenceText: 'Autoriza o ingresso de Pains no Consórcio Intermunicipal X.',
    } }, at, at);
  assert.equal(row.tipo_evento, 'ADESÃO AUTORIZADA');
  assert.equal(row.etapa, 'autorização — ingresso não comprovado');
  assert.equal(row.efeito_na_participacao, 'não inferido automaticamente');
  assert.equal(row.municipio, 'Pains');
});

test('projeto de lei continua identificado como proposta', () => {
  const row = catalogRecord({ kind: 'legislative', title: 'PROJETO DE LEI 14/2026: adesão ao consórcio',
    url: 'https://camara.exemplo/materia/14', classification: { category: 'ADESÃO', score: 9 } }, at, at);
  assert.equal(row.etapa, 'proposta — não aprovada');
});

test('publicação no WhatsApp não equivale a confirmação manual', () => {
  const item = { title: 'Consórcio X', url: 'https://portal.exemplo/1',
    classification: { category: 'GOVERNANÇA', score: 10, evidenceText: 'Ata de assembleia.' } };
  const old = catalogRecord(item, at, at, at);
  const richer = catalogRecord({ ...item, kind: 'gazette',
    classification: { ...item.classification, evidenceText: 'Ata de assembleia do consórcio com alteração do estatuto.' } }, at, at);
  const merged = mergeCatalogRecord(old, richer);
  assert.match(merged.situacao_analise, /não confirmado manualmente/);
  assert.match(merged.trecho, /alteração do estatuto/);
});

test('mesma URL de versões históricas é consolidada e rejeição posterior prevalece', () => {
  const url = 'https://portal.exemplo/ato/1';
  const item = { kind: 'gazette', title: 'Ato sobre consórcio', url,
    classification: { category: 'RATEIO', score: 10, evidenceText: 'Contrato de rateio celebrado.' } };
  const map = new Map();
  mergeStateIntoCatalog(map, { observations: { x: { item, firstSeenAt: at, lastSeenAt: at } } });
  mergeStateIntoCatalog(map, { observations: { x: { item: { ...item,
    aiReview: { status: 'rejected' } }, firstSeenAt: at, lastSeenAt: at } } });
  assert.equal(map.size, 1);
  assert.match([...map.values()][0].situacao_analise, /rejeitado/);
});

test('envio antigo sem evidência não vira fato confirmado nem supera triagem atual', () => {
  const url = 'https://portal.exemplo/agenda';
  const map = new Map();
  const old = { seen: { x: { url, title: 'Consórcio cria agenda de reuniões',
    category: 'CRIAÇÃO', sentAt: at } } };
  mergeStateIntoCatalog(map, old);
  assert.match([...map.values()][0].situacao_analise, /legado sem texto/);
  mergeStateIntoCatalog(map, { observations: { x: { item: { title: old.seen.x.title, url,
    source: 'Portal', summary: 'O consórcio existente cria agenda de reuniões.',
    classification: { category: 'CRIAÇÃO', score: 12 } }, firstSeenAt: at, lastSeenAt: at } } });
  assert.equal([...map.values()][0].tipo_evento, 'GERAL');
});

test('leitura integral corrigida prevalece sobre estado antigo publicado', () => {
  const url = 'https://portal.exemplo/adesao-autorizada';
  const corrected = catalogRecord({ title: 'Lei autoriza ingresso no consórcio', url,
    classification: { category: 'ADESÃO AUTORIZADA', score: 10,
      evidenceText: 'A lei autoriza o ingresso, sem comprovar a adesão consumada.' } }, at, at, at);
  corrected.situacao_analise = 'categoria recalculada após leitura integral — ADESÃO → ADESÃO AUTORIZADA; conferir';
  const map = new Map([[corrected.id, corrected]]);
  mergeStateIntoCatalog(map, { seen: { x: { url, title: corrected.titulo, category: 'ADESÃO', sentAt: at } },
    observations: { x: { item: { title: corrected.titulo, url,
      classification: { category: 'ADESÃO', score: 8 } }, firstSeenAt: at, lastSeenAt: at } } });
  const after = map.get(corrected.id);
  assert.equal(after.tipo_evento, 'ADESÃO AUTORIZADA');
  assert.match(after.situacao_analise, /categoria recalculada/);
});

test('lei de 2022 já enviada permanece no arquivo bruto, mas sai dos eventos derivados', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'radar-ato-antigo-'));
  try {
    const row = catalogRecord({ kind: 'news',
      title: '14/03/2022 - LEI Nº559-2022 (Ratifica protocolo de intenções do consórcio público)',
      url: 'https://news.google.com/rss/articles/lei-antiga', source: 'Câmara Municipal',
      publishedAt: '2026-10-04T11:02:26Z',
      classification: { category: 'PROTOCOLO', score: 19, evidenceText: 'Ratifica o protocolo de intenções.' } },
    at, at, at);
    const result = await saveCatalog(directory, new Map([[row.id, row]]));
    assert.equal(result.all, 1);
    assert.equal(result.relevant, 0);
    assert.match(await readFile(path.join(directory, 'arquivo-coletas.ndjson'), 'utf8'), /"tipo_evento":"PROTOCOLO"/);
    assert.doesNotMatch(await readFile(path.join(directory, 'eventos.csv'), 'utf8'), /LEI Nº559-2022/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('revisão de IA aprovada não supera reclassificação determinística do catálogo', () => {
  const map = new Map();
  const old = { kind: 'news', title: '14/03/2022 - LEI Nº559-2022 (Ratifica protocolo de intenções do Consórcio publico)',
    url: 'https://news.google.com/rss/articles/lei-antiga', publishedAt: '2026-10-04T11:02:26Z',
    summary: 'Ratifica protocolo de intenções do consórcio público intermunicipal.',
    aiReview: { status: 'approved', category: 'PROTOCOLO' },
    classification: { category: 'PROTOCOLO', score: 19 } };
  mergeStateIntoCatalog(map, { observations: { x: { item: old, firstSeenAt: at, lastSeenAt: at } } });
  assert.equal([...map.values()][0].tipo_evento, 'GERAL');
});

test('catálogo aplica evidência complementar por documento e exporta sua URL', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'radar-catalogo-'));
  try {
    const row = catalogRecord({ title: 'Diário Oficial de Dracena (SP)',
      url: 'https://exemplo.org/diario.pdf', source: 'Diário Oficial',
      classification: { category: 'PROTOCOLO', score: 8 } }, at, at);
    const evidence = { documento_id: row.id,
      nome: 'Consórcio Intermunicipal de Serviços da Nova Alta Paulista', sigla: 'CISNAP',
      fonte_evidencia: 'https://exemplo.org/diario.pdf', evidencia: 'PDF p. 2: nome e sigla' };
    await writeFile(path.join(directory, 'evidencias-complementares.ndjson'), `${JSON.stringify(evidence)}\n`);
    const result = await saveCatalog(directory, new Map([[row.id, row]]));
    assert.equal(result.consortia, 1);
    assert.equal(result.pendingIdentity, 0);
    const links = await readFile(path.join(directory, 'vinculos-documentos.csv'), 'utf8');
    assert.match(links, /url_evidencia/);
    assert.match(links, /fonte complementar conferida/);
    assert.match(links, /https:\/\/exemplo.org\/diario.pdf/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('revisão editorial tira falso evento das tabelas sem apagar o registro bruto', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'radar-revisao-'));
  try {
    const row = catalogRecord({ title: 'Diário Oficial de Andradina (SP)',
      url: 'https://exemplo.org/andradina.pdf', source: 'Diário Oficial',
      classification: { category: 'CRISE', score: 10,
        evidenceText: 'Extinção amigável de contrato de locação do consórcio.' } }, at, at);
    const review = { documento_id: row.id, decisao: 'nao_evento',
      motivo: 'extinção de contrato, não do consórcio', evidencia: 'Contrato de locação 30/2025',
      trecho_sha256: createHash('sha256').update(row.trecho).digest('hex') };
    await writeFile(path.join(directory, 'revisoes-eventos.ndjson'), `${JSON.stringify(review)}\n`);
    const result = await saveCatalog(directory, new Map([[row.id, row]]));
    assert.equal(result.all, 1);
    assert.equal(result.relevant, 0);
    assert.match(await readFile(path.join(directory, 'arquivo-coletas.ndjson'), 'utf8'), /"tipo_evento":"CRISE"/);
    assert.doesNotMatch(await readFile(path.join(directory, 'eventos.csv'), 'utf8'), /Andradina/);
    const richer = { ...row, trecho: `${row.trecho} Dissolução do consórcio confirmada pela assembleia.` };
    const refreshed = await saveCatalog(directory, new Map([[row.id, richer]]));
    assert.equal(refreshed.relevant, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('duplicata sai da tabela de eventos mas conserva o vínculo com o documento principal', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'radar-duplicata-'));
  try {
    const row = catalogRecord({ title: 'TCE suspende credenciamento de consórcio',
      url: 'https://exemplo.org/noticia-alternativa', source: 'TCE',
      classification: { category: 'CONTROLE', score: 10,
        evidenceText: 'TCE suspendeu o credenciamento do consórcio público.' } }, at, at);
    const review = { documento_id: row.id, decisao: 'duplicata', documento_relacionado: 'documento-principal',
      motivo: 'mesma página oficial e mesmo ato', evidencia: row.trecho,
      trecho_sha256: createHash('sha256').update(row.trecho).digest('hex') };
    await writeFile(path.join(directory, 'revisoes-eventos.ndjson'), `${JSON.stringify(review)}\n`);
    const result = await saveCatalog(directory, new Map([[row.id, row]]));
    assert.equal(result.relevant, 0);
    assert.match(await readFile(path.join(directory, 'arquivo-coletas.ndjson'), 'utf8'), /"tipo_evento":"CONTROLE"/);
    assert.doesNotMatch(await readFile(path.join(directory, 'eventos.csv'), 'utf8'), /noticia-alternativa/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('revisão editorial corrige categoria sem declarar adesão consumada', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'radar-categoria-'));
  try {
    const row = catalogRecord({ title: 'Proposta de ingresso em consórcio regional',
      url: 'https://exemplo.org/proposta', source: 'Conselho de Saúde',
      classification: { category: 'ADESÃO', score: 8,
        evidenceText: 'Conselho aprova proposta de ingresso em consórcio intermunicipal.' } }, at, at);
    const review = { documento_id: row.id, decisao: 'corrigir_categoria',
      categoria: 'PROPOSTA DE ADESÃO', etapa: 'ingresso não comprovado',
      motivo: 'somente proposta aprovada', evidencia: 'Ata do conselho',
      trecho_sha256: createHash('sha256').update(row.trecho).digest('hex') };
    await writeFile(path.join(directory, 'revisoes-eventos.ndjson'), `${JSON.stringify(review)}\n`);
    const result = await saveCatalog(directory, new Map([[row.id, row]]));
    assert.equal(result.relevant, 1);
    const events = await readFile(path.join(directory, 'eventos.csv'), 'utf8');
    assert.match(events, /PROPOSTA DE ADESÃO/);
    assert.match(events, /ingresso não comprovado/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('replay histórico separa aceitação na base de alerta atual', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'radar-base-alerta-'));
  try {
    const row = catalogRecord({ kind: 'news', title: 'Lei autoriza ingresso no consórcio',
      url: 'https://exemplo.org/lei', publishedAt: '2026-10-08T12:00:00Z',
      classification: { category: 'ADESÃO AUTORIZADA', score: 10,
        evidenceText: 'Lei 1117/2026 autoriza ingresso de Campina Grande do Sul no CISPAR.' } }, at, at);
    const review = { documento_id: row.id, decisao: 'confirmar_evento',
      categoria: 'ADESÃO AUTORIZADA', motivo: 'lei sancionada em junho', evidencia: row.trecho,
      data_fato: '2026-06-23T12:00:00Z',
      trecho_sha256: createHash('sha256').update(row.trecho).digest('hex') };
    await writeFile(path.join(directory, 'revisoes-eventos.ndjson'), `${JSON.stringify(review)}\n`);
    const result = await saveCatalog(directory, new Map([[row.id, row]]),
      { now: new Date('2026-10-09T12:00:00Z') });
    assert.equal(result.relevant, 1);
    const events = await readFile(path.join(directory, 'eventos.csv'), 'utf8');
    assert.match(events, /decisao_base,decisao_alerta/);
    assert.match(events, /"confirmado","historico"/);
    assert.match(events, /2026-06-23T12:00:00Z/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('sigla suspeita fica sem identidade até conferir o ato, com revisão lacrada ao trecho', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'radar-identidade-pendente-'));
  try {
    const row = catalogRecord({ kind: 'gazette', title: 'Diário Oficial de Rio Claro (SP)',
      url: 'https://exemplo.org/rio-claro.pdf', source: 'Diário Oficial',
      classification: { category: 'FINANÇAS', score: 8,
        evidenceText: 'CONSÓRCIO INTERMUNICIPAL DE SAÚDE NA REGIÃO METROPOLITANA DE PIRACICABA- CISMESTR' } }, at, at);
    const review = { documento_id: row.id, decisao: 'pendente',
      motivo: 'sigla diverge do portal oficial', fonte_evidencia: 'https://exemplo.org/protocolo.pdf',
      trecho_sha256: createHash('sha256').update(row.trecho).digest('hex') };
    await writeFile(path.join(directory, 'revisoes-identidades.ndjson'), `${JSON.stringify(review)}\n`);
    const first = await saveCatalog(directory, new Map([[row.id, row]]));
    assert.equal(first.relevant, 1);
    assert.equal(first.links, 0);
    assert.equal(first.pendingIdentity, 1);
    assert.match(await readFile(path.join(directory, 'identidade-pendente.csv'), 'utf8'),
      /sigla diverge do portal oficial/);
    const changed = { ...row, trecho: `${row.trecho} Novo ato com sigla confirmada - CISMETRO.` };
    const second = await saveCatalog(directory, new Map([[row.id, changed]]));
    assert.equal(second.links, 1, 'revisão antiga não vale para evidência nova');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
