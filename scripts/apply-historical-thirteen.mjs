// Fixed, document-reviewed historical batch. Never imports WhatsApp or edits its state.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdtemp, cp, readdir, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { loadCatalog, saveCatalog } from '../src/lib/catalog.mjs';
import { redactPublicText } from '../src/lib/article-text-store.mjs';
import { protectedSnapshot } from './pilot-retroactive-ten.mjs';

const batch = 'historicos-13-2026-10-16';
const directory = 'data/catalogo', output = 'output/historical-thirteen';
const hash = value => createHash('sha256').update(value).digest('hex');
const normalize = text => text.replace(/\s+/g, ' ').trim();
const rows = async (dir, name) => (await readFile(path.join(dir, name), 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const writeRows = (dir, name, items) => writeFile(path.join(dir, name), items.map(JSON.stringify).join('\n') + '\n');
const abc = 'Consórcio Intermunicipal Grande ABC';
const methodology = 'Revisão documental pelo assistente; critérios de composição, atuação realizada e descarte de convocação confirmados pelo usuário. Não é classificação automática.';
const partnership = 'ca8c07d28d948677c3e27f7d13f01f64b9efcf85d25847b17a2418a994231898';
const definitions = [
  { prefix: 'afae42c5', decision: 'duplicata', duplicate: '78bf95a46f809b5e13e3f0d5d76985601e42251221ada1fe0785d38a2540e2fa',
    title: 'Indaiatuba: duplicata do despacho do PL 74/2024 sobre ARES-PCJ', year: 2024, uf: 'SP', municipality: 'Indaiatuba', type: 'despacho de tramitação',
    proof: 'Segue para elaboração de parecer.', reason: 'O PDF é byte a byte idêntico ao despacho já revisado: apenas encaminha o PL 74/2024 para parecer jurídico. Não comprova aprovação ou sanção.' },
  { prefix: 'c415a567', decision: 'nao_evento', title: 'TCE-PR premia Curitiba e Pinhais no Progov', uf: 'PR',
    proof: 'Os primeiros municípios reconhecidos no seminário Progov: Gestão que Transforma Políticas Públicas foram Curitiba e Pinhais.',
    reason: 'O texto completo trata de reconhecimento de boas práticas municipais no Progov, sem consórcio intermunicipal como ator do acontecimento. Fora do escopo, não falta de texto.' },
  { prefix: 'cc60e177', decision: 'nao_evento', title: 'TCE-PR realiza seminário do Progov com gestores municipais', uf: 'PR',
    proof: 'O evento, promovido pelo Tribunal de Contas do Estado do Paraná com o apoio da Fiep, celebra, até esta quarta (dia 14), os cinco anos de implementação do Programa de Avaliação das Contas Municipais de Governo (Progov) do TCE-PR',
    reason: 'Seminário e palestras de gestão municipal, sem fato de consórcio público identificado na íntegra. A data do corpo recuperado é outubro, não o setembro citado no fragmento anterior; original preservado.' },
  { prefix: '1bb8aa8d', decision: 'duplicata', duplicate: partnership, name: abc, uf: 'SP', title: 'ABC e Metodista: outra fonte do acordo de bolsas já registrado',
    proof: 'O Consórcio Intermunicipal Grande ABC e o Instituto Metodista de Ensino Superior firmaram, nesta sexta-feira (11/09), acordo de cooperação técnica',
    reason: 'Mesmo acordo ABC–Metodista firmado em setembro, para até mil bolsas, já confirmado na fonte oficial. Vinculada ao registro existente; não é outro fato nem prova de bolsas efetivamente concedidas.' },
  { prefix: '68160372', decision: 'duplicata', duplicate: partnership, name: abc, uf: 'SP', title: 'ABC e Metodista: republicação do acordo para até mil bolsas',
    proof: 'O Consórcio Intermunicipal Grande ABC e o Instituto Metodista de Ensino Superior firmaram, na última sexta-feira (11), um acordo de cooperação técnica',
    reason: 'Mesmas partes, assinatura em setembro e condições de bolsas do acordo já registrado. Texto recuperado após corrigir o charset inválido do portal; manter como fonte adicional, sem novo fato.' },
  { prefix: 'a22322a6', decision: 'duplicata', duplicate: partnership, name: abc, uf: 'SP', title: 'ABC e Metodista: cobertura adicional do mesmo acordo de bolsas',
    proof: 'O Consórcio Intermunicipal Grande ABC e o Instituto Metodista de Ensino Superior firmaram, nesta sexta-feira (11/9), acordo de cooperação Técnica',
    reason: 'Cobertura do mesmo acordo de setembro para até mil bolsas, já confirmado na base. Data de publicação diferente não cria novo acontecimento.' },
  { prefix: '74fb6772', decision: 'confirmar_evento', category: 'PROTOCOLO', title: 'Prefeitos de 12 municípios do Paraná assinam protocolo do Conclima',
    name: 'Consórcio Nacional para Gestão Climática e Prevenção de Desastres', acronym: 'CONCLIMA', uf: 'PR',
    stage: 'protocolo de intenções assinado; ingresso efetivo não comprovado',
    proof: 'Prefeitos de 12 Municípios do Paraná, integrantes da Associação dos Municípios de Entre Rios (Amerios), assinaram o protocolo de intenções para integrarem o Consórcio Nacional para Gestão Climática e Prevenção de Desastres (Conclima).',
    reason: 'A reprodução no portal oficial do Conclima comprova assinatura do protocolo por 12 municípios do Paraná, não ingresso concluído nem constituição consumada. Corrige a UF do título indexado (Santa Catarina); os municípios não são nomeados, portanto não são criados vínculos individuais.' },
  { prefix: 'b940d094', decision: 'confirmar_evento', category: 'ATUAÇÃO', name: abc, uf: 'SP', municipality: 'Santo André',
    title: 'Consórcio ABC realiza visita técnica ao centro de formação da GCM', stage: 'visita técnica realizada',
    proof: 'O Consórcio Intermunicipal Grande ABC realizou, na quinta (24), visita técnica ao Centro de Formação da Guarda Civil Municipal (GCM) de Santo André',
    reason: 'Visita conduzida pelo consórcio e efetivamente realizada: atuação comprovada conforme critério aprovado. Não comprova contratação, capacitação já entregue ou novo investimento.' },
  { prefix: 'f46c947c', decision: 'confirmar_evento', category: 'ATUAÇÃO', name: abc, uf: 'SP',
    title: 'Consórcio ABC realiza reunião com a Braskem sobre o Polo Petroquímico', stage: 'reunião institucional realizada',
    proof: 'O Consórcio Intermunicipal Grande ABC recebeu nesta quarta-feira (9/9) a vice-presidente Jurídica, de Relações Institucionais e Comunicação da Braskem, Camilla Tápias',
    reason: 'O consórcio recebeu representantes e conduziu discussão concreta: atuação institucional realizada. A notícia não comprova novo acordo, investimento executado ou entrega industrial.' },
  { prefix: '0c2c9c6b', decision: 'confirmar_evento', category: 'GOVERNANÇA',
    name: 'Consórcio Intermunicipal de Acolhimento de Crianças e Adolescentes', uf: 'SC',
    title: 'Consórcio de acolhimento: composição de quatro municípios documentada', stage: 'composição documentada em 2026; ingresso original desconhecido',
    municipalities: ['Curitibanos', 'Frei Rogério', 'Ponte Alta do Norte', 'São Cristóvão do Sul'],
    proof: 'O consórcio é formado por Curitibanos, Frei Rogério, Ponte Alta do Norte e São Cristóvão do Sul.',
    reason: 'Aproveitada somente a composição explicitamente comprovada na notícia de seleção, conforme autorização do usuário. Participação documentada em 2026, sem ano original de ingresso e sem afirmar início dos atendimentos. AMURC é a associação apoiadora, não a sigla do consórcio.' },
  { prefix: 'cfbb82ef', decision: 'confirmar_evento', category: 'ATUAÇÃO', name: abc, uf: 'SP',
    title: 'Consórcio ABC reúne o GT Gestão de Riscos para discutir plano climático', stage: 'reunião realizada; plano em discussão',
    proof: 'O Consórcio Intermunicipal Grande ABC realizou nesta segunda-feira (28) uma reunião do Grupo de Trabalho (GT) Gestão de Riscos, que reúne as Defesas Civis da região.',
    reason: 'Reunião realizada pelo consórcio comprova atuação. O plano climático permanece em construção: não registrar plano aprovado, obras realizadas ou recursos garantidos.' },
  { prefix: 'e41368d4', decision: 'nao_evento', uf: 'RO', title: 'CIMCERO: convocação da 121ª assembleia, sem realização comprovada', type: 'convocação de assembleia',
    proof: 'O Consórcio Intermunicipal da Região Centro Leste do Estado de Rondônia – CIMCERO convoca os municípios consorciados para participarem da 121ª Assembleia Geral Ordinária, que será realizada no dia 22 de setembro de 2026',
    reason: 'Simples convocação com pautas futuras. Conforme decisão do usuário, fica no acervo, fora da base de fatos. Não comprova reunião realizada, alteração dos cargos ou aprovação do orçamento de 2027.' },
  { prefix: 'e64cf89d', decision: 'nao_evento', title: 'Correios: consórcio de bancos, não consórcio intermunicipal',
    proof: 'O g1 apurou que a nova injeção de dinheiro deve vir de um novo consórcio de bancos',
    reason: 'Consórcio financeiro de bancos para crédito aos Correios, não consórcio público intermunicipal. A crise da empresa não é crise de um consórcio público.' },
];
const existingReviews = await rows(directory, 'revisoes-eventos.ndjson');
const applied = existingReviews.filter(r => r.lote_retroativo === batch);
if (applied.length) {
  assert.equal(applied.length, definitions.length, 'Lote parcialmente aplicado');
  assert.deepEqual(applied.map(r => r.documento_id.slice(0, 8)).sort(), definitions.map(d => d.prefix).sort());
  console.log('Lote de 13 já aplicado: nenhuma gravação ou envio.');
} else {
  const snapshot = await protectedSnapshot();
  const archive = await rows(directory, 'arquivo-coletas.ndjson');
  const texts = await rows(directory, 'textos-artigos.ndjson');
  const alternatives = await rows(directory, 'fontes-alternativas.ndjson');
  const pdfs = await rows(directory, 'recuperacao-pdf-google.ndjson');
  const evidence = await rows(directory, 'evidencias-complementares.ndjson');
  const reviews = [...existingReviews], originals = [];
  assert.equal(existingReviews.find(r => r.documento_id === partnership)?.decisao, 'confirmar_evento');
  for (const d of definitions) {
    const source = JSON.parse(await readFile(`${output}/${d.prefix}.json`, 'utf8'));
    const row = archive.find(r => r.id === source.id);
    assert.ok(row && row.id.startsWith(d.prefix));
    assert.equal(hash(JSON.stringify(row)), source.originalSha256, 'Original mudou após recuperação');
    assert.ok(!row.enviado_em && !row.documento_pai_id);
    assert.ok(!reviews.some(r => r.documento_id === row.id), 'Não substituir revisão');
    assert.ok(!texts.some(r => r.documento_id === row.id), 'Não substituir leitura');
    assert.ok(source.text.length > 500 && normalize(source.text).includes(d.proof), `Prova ausente: ${d.prefix}`);
    const text = redactPublicText(source.text);
    assert.ok(normalize(text).includes(d.proof));
    const url = source.url + (source.pdf ? '#page=1' : '');
    if (source.pdf) {
      assert.equal(hash(await readFile(`${output}/${d.prefix}.pdf`)), source.pdfSha256);
      assert.equal(texts.find(t => t.documento_id === d.duplicate)?.pdf_sha256, source.pdfSha256, 'Duplicata deve ter bytes iguais');
    }
    const facts = { ano: d.year || 2026, precisao_data: 'ano', ano_ingresso: '',
      consorcio: d.name || '', sigla: d.acronym || '', municipio: d.municipality || '', uf: d.uf || '',
      tipo_documento: d.type || 'notícia', limite: d.reason,
      ...(source.pdf ? { pagina_pdf: 1 } : {}),
      ...(d.municipalities ? { participacao: true, municipios: d.municipalities } : {}),
      ...(source.alternative ? { quantidade_municipios: 12, municipios: [] } : {}) };
    reviews.push({ documento_id: row.id, lote_retroativo: batch, revisado_em: new Date().toISOString(),
      validacao: methodology, decisao: d.decision, titulo: d.title, categoria: d.category || 'GERAL',
      etapa: d.stage || '', motivo: d.reason, evidencia: d.proof, fonte_evidencia: url,
      fatos: facts, trecho_sha256: hash(row.trecho || ''), texto_evidencia_sha256: hash(text),
      ...(source.pdf ? { pdf_sha256: source.pdfSha256 } : {}),
      documento_relacionado: d.duplicate || '',
      urls_documento: [...new Set([row.url, source.resolvedUrl, source.url].filter(Boolean))],
      publicar: false, motivo_publicacao: 'Revisão retroativa somente na base. Não enviar no WhatsApp nem no resumo semanal.' });
    if (source.alternative) {
      alternatives.push({ id: hash(`${row.id}:${source.url}`), documento_id: row.id,
        url_original_bloqueada: source.resolvedUrl, url_fonte: source.url, titulo_fonte: source.alternativeTitle,
        fonte: 'Portal oficial do Conclima', origem_descoberta: 'busca_web', recuperado_em: source.attemptedAt,
        data_fonte: source.date || '', leitor: source.reader, texto: text, texto_sha256: hash(text),
        independencia: 'Reprodução institucional da informação da CNM; não é confirmação independente.',
        relacao_validada: 'Revisão documental do relato da assinatura do protocolo por 12 prefeitos da Amerios, em setembro. O corpo da fonte oficial identifica Paraná; o antigo título indexado mencionava Santa Catarina. Essa divergência foi preservada e explicitada, não resolvida por semelhança de títulos.',
        situacao: 'fonte citada na revisão documental', lote_retroativo: batch });
    } else {
      texts.push({ documento_id: row.id, url_original: row.url, url_artigo: source.url,
        recuperado_em: source.attemptedAt, leitor: source.reader, texto: text, texto_sha256: hash(text),
        ...(source.apiUrl ? { api_url: source.apiUrl } : {}),
        ...(source.pdf ? { pdf_sha256: source.pdfSha256, paginas: source.pdf.paginas } : {}),
        completo: true, lote_retroativo: batch });
    }
    if (source.pdf) {
      const index = pdfs.findIndex(p => p.documento_id === row.id);
      assert.ok(index >= 0);
      pdfs[index] = { ...pdfs[index], url_pdf: source.url, situacao: 'texto integral recuperado; duplicata revisada',
        paginas: source.pdf.paginas.length, paginas_ocr_pendente: [], pdf_sha256: source.pdfSha256,
        trechos: [{ pagina: 1, texto: d.proof, leitor: 'pypdf' }], lote_retroativo: batch };
    }
    if (d.decision === 'confirmar_evento') evidence.push({ documento_id: row.id, nome: d.name,
      sigla: d.acronym || '', cnpj: '', fonte_evidencia: url,
      evidencia: `${d.proof} ${d.reason}` });
    originals.push({ documento_id: row.id, original: row, decisao: d.decision,
      texto_sha256: hash(text), fonte_evidencia: url });
  }
  await mkdir(output, { recursive: true });
  const staged = await mkdtemp(path.join(output, 'aplicacao-'));
  await cp(directory, staged, { recursive: true });
  for (const [name, data] of [['revisoes-eventos', reviews], ['textos-artigos', texts],
    ['fontes-alternativas', alternatives], ['recuperacao-pdf-google', pdfs], ['evidencias-complementares', evidence]])
    await writeRows(staged, `${name}.ndjson`, data);
  await writeFile(path.join(staged, 'lote-historicos-13.json'), JSON.stringify({ lote: batch,
    aplicado_em: new Date().toISOString(), bloqueio_whatsapp: true, validacao: methodology, registros: originals }, null, 2) + '\n');
  const counts = await saveCatalog(staged, await loadCatalog(path.join(staged, 'arquivo-coletas.ndjson')));
  assert.equal(await readFile(path.join(staged, 'arquivo-coletas.ndjson'), 'utf8'), await readFile(path.join(directory, 'arquivo-coletas.ndjson'), 'utf8'));
  const eventRows = dir => readFile(path.join(dir, 'eventos.csv'), 'utf8').then(text => text.trim().split('\n').slice(1));
  const oldEvents = await eventRows(directory), newEvents = await eventRows(staged);
  assert.ok(oldEvents.every(row => newEvents.includes(row)), 'Não alterar outros fatos');
  assert.equal(newEvents.length, oldEvents.length + 5);
  const ids = newEvents.map(line => /^"([a-f0-9]{64})"/.exec(line)?.[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const d of definitions) assert.equal(ids.some(id => id?.startsWith(d.prefix)), d.decision === 'confirmar_evento');
  const participants = (await readFile(path.join(staged, 'participacoes.csv'), 'utf8')).split('\n').filter(l => l.includes('0c2c9c6b'));
  assert.equal(participants.length, 4, 'Quatro vínculos documentados, sem inventar ingressos');
  assert.deepEqual(await protectedSnapshot(), snapshot, 'Produção mudou durante preparação');
  if (process.argv.includes('--apply')) {
    for (const name of await readdir(staged)) {
      const next = await readFile(path.join(staged, name));
      const prior = await readFile(path.join(directory, name)).catch(e => e.code === 'ENOENT' ? null : Promise.reject(e));
      if (!prior?.equals(next)) await writeFile(path.join(directory, name), next);
    }
    const after = await protectedSnapshot();
    for (const [name, sha] of Object.entries(snapshot)) if (name.startsWith('state')) assert.equal(after[name], sha);
  }
  console.log(JSON.stringify({ applied: process.argv.includes('--apply'), staged, ...counts,
    addedFacts: 5, duplicates: 4, discarded: 4, originalTexts: 12, alternativeTexts: 1,
    originalArchiveUnchanged: true, whatsappCalls: 0 }, null, 2));
}
