import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIdentityCatalog, findIdentityMentions, normalizeCnpj } from '../src/lib/consortium-identity.mjs';

function row(id, trecho, extra = {}) {
  return { id, tipo_evento: 'ADESÃO', titulo: `Diário Oficial ${id}`, trecho,
    url: `https://exemplo.org/${id}`, ...extra };
}

test('CNPJ só é aceito com dígitos verificadores válidos', () => {
  assert.equal(normalizeCnpj('95.640.322/0001-01'), '95640322000101');
  assert.equal(normalizeCnpj('95.640.322/0001-02'), '');
});

test('nome explícito, sigla e CNPJ do consórcio geram vínculo candidato', () => {
  const document = row('mambore', 'Contratado: CONSORCIO INTERMUNICIPAL DE SAUDE DA COM DOS MUNIC DA REGIAO DE CAMPO MOURAO - CIS COMCAM, inscrito no CNPJ sob n. 95.640.322/0001-01');
  const mentions = findIdentityMentions(document);
  assert.equal(mentions.length, 1);
  assert.equal(mentions[0].cnpj, '95640322000101');
  const { identities, links } = buildIdentityCatalog([document]);
  assert.equal(identities.length, 1);
  assert.equal(links[0].consorcio_id, identities[0].id);
});

test('menção genérica e texto sem evidência não criam consórcio', () => {
  const docs = [row('agenda', 'Consórcio Intermunicipal cria agenda setorial com Brasília.'),
    row('vazio', ''), row('orcamento', 'Transferências de recursos a consórcios públicos mediante rateio.')];
  const { identities, links } = buildIdentityCatalog(docs);
  assert.equal(identities.length, 0);
  assert.equal(links.length, 0);
});

test('não transforma cláusula, manchete cortada ou nome do jornal em identidade', () => {
  const docs = [row('clausula', 'Rateio pela Participação em Consórcio Público CLÁUSULA DOZE - Conforme previsão legal.'),
    row('cortada', '', { titulo: 'Autoriza ingresso no Consórcio Intermunicipal de Saneamento d... - Câmara Municipal' }),
    row('jornal', '', { titulo: 'TCE paralisa licitação do Consórcio Intermunicipal Grande ABC - ABC Repórter' })];
  assert.equal(buildIdentityCatalog(docs).identities.length, 0);
});

test('sigla antes da denominação entre parênteses é recuperada', () => {
  const result = buildIdentityCatalog([row('cimams', '', {
    titulo: 'Rubelita na assembleia do CIMAMS (Consórcio Intermunicipal Multifinalitário da Área Mineira da Sudene) – Jornal Panorama',
  })]);
  assert.equal(result.identities.length, 1);
  assert.equal(result.identities[0].sigla, 'CIMAMS');
  assert.equal(result.identities[0].nome, 'Consórcio Intermunicipal Multifinalitário da Área Mineira da Sudene');
});

test('sigla antes do nome com travessão recupera CONSIRC', () => {
  const result = buildIdentityCatalog([row('catanduva',
    'CONTRATANTE: CONSIRC – CONSÓRCIO PÚBLICO INTERMUNICIPAL DE SAÚDE DA REGIÃO DE CATANDUVA. CONTRATADO: terceiro.')]);
  assert.equal(result.identities.length, 1);
  assert.equal(result.identities[0].sigla, 'CONSIRC');
  assert.equal(result.identities[0].nome, 'CONSÓRCIO PÚBLICO INTERMUNICIPAL DE SAÚDE DA REGIÃO DE CATANDUVA');
});

test('hífen sem espaço antes da sigla recupera CISMESTR', () => {
  const result = buildIdentityCatalog([row('rio-claro',
    'EMPRESA: CONSÓRCIO INTERMUNICIPAL DE SAÚDE NA REGIÃO METROPOLITANA DE PIRACICABA- CISMESTR')]);
  assert.equal(result.identities.length, 1);
  assert.equal(result.identities[0].sigla, 'CISMESTR');
});

test('sigla isolada só vincula quando já conhecida, única e no contexto de consórcio', () => {
  const known = row('inhapi', 'Consórcio Intermunicipal do Agreste Alagoano – CONAGRESTE.');
  const alias = row('junqueiro', 'O Consórcio Conagreste presta serviços ao Município.');
  const unknown = row('simao-dias', 'O CONSCENSUL é uma associação pública.');
  const result = buildIdentityCatalog([known, alias, unknown]);
  assert.equal(result.identities.length, 1);
  assert.equal(result.links.filter((link) => link.consorcio_id).length, 2);
  assert.equal(result.links.find((link) => link.documento_id === 'junqueiro')?.situacao,
    'sigla conhecida no contexto — revisão humana');
  assert.equal(result.links.some((link) => link.documento_id === 'simao-dias'), false);
});

test('mesmo nome em documentos distintos mantém a mesma chave', () => {
  const docs = [row('a', 'Contrato com o Consórcio Intermunicipal de Saneamento do Paraná (CISPAR).'),
    row('b', 'Ratifica o estatuto do Consórcio Intermunicipal de Saneamento do Paraná (CISPAR).')];
  const first = buildIdentityCatalog(docs);
  const second = buildIdentityCatalog(docs, first.identities);
  assert.equal(first.identities.length, 1);
  assert.equal(second.identities.length, 1);
  assert.equal(first.identities[0].id, second.identities[0].id);
  assert.equal(new Set(second.links.map((link) => link.consorcio_id)).size, 1);
});

test('CNPJ contraditório não é atribuído automaticamente ao cadastro existente', () => {
  const old = [{ id: 'cons_existente', nome: 'Consórcio Intermunicipal de Saneamento do Paraná',
    sigla: 'CISPAR', cnpj: '95640322000101', aliases: [], situacao: 'revisado' }];
  const { identities, links } = buildIdentityCatalog([row('x',
    'Consórcio Intermunicipal de Saneamento do Paraná (CISPAR), inscrito no CNPJ 25.103.884/0001-30.')], old);
  assert.equal(identities.length, 1);
  assert.equal(links[0].consorcio_id, '');
  assert.match(links[0].situacao, /divergente/);
});

test('candidato antigo sem menção atual não fica preso no cadastro', () => {
  const previous = [{ id: 'cons_ruido', nome: 'Consórcio Público CLÁUSULA DOZE',
    sigla: '', cnpj: '', aliases: [], situacao: 'candidato — identidade não conferida' }];
  assert.deepEqual(buildIdentityCatalog([], previous).identities, []);
});
