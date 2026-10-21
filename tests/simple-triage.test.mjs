import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { decideSimpleTriage, applySimpleTriage, categoryGroup, CATEGORY_FAMILIES,
  categoryLabel, rowFingerprint, validOriginalTriage, loadOriginalTriage } from '../src/lib/simple-triage.mjs';
import { loadEditorialGuard, applyEditorialGuard } from '../src/lib/editorial-guard.mjs';
import { isNotifiable } from '../src/lib/publication-gate.mjs';
import { isWhatsAppCategoryAllowed } from '../src/lib/whatsapp-policy.mjs';
import { prepareWeeklyState } from '../src/lib/weekly-selection.mjs';
import { buildWeeklyReport } from '../src/lib/history.mjs';
import { AI_PROMPT_VERSION } from '../src/lib/ai-review.mjs';
import { refineEventProof } from '../src/lib/event-proof.mjs';
import { canonicalUrl } from '../src/lib/dedupe.mjs';

const evidence = 'O Consórcio Intermunicipal de Saúde realizou a reunião técnica e apresentou os resultados dos serviços aos municípios.';
const item = { kind: 'news', title: 'Reunião realizada pelo consórcio', url: 'https://example.org/noticia/1',
  rawText: evidence + ' Os representantes municipais participaram da atividade presencial e discutiram os procedimentos regionais.',
  classification: { category: 'ATUAÇÃO', score: 10, evidenceText: evidence },
  aiReview: { status: 'approved', category: 'ATUAÇÃO', evidence, promptVersion: AI_PROMPT_VERSION } };

test('sete famílias preservam categorias e etapas sem liberar controle no WhatsApp', () => {
  assert.equal(CATEGORY_FAMILIES.length, 7);
  for (const category of ['GOVERNANÇA', 'FINANÇAS', 'CONTROLE']) assert.equal(categoryGroup(category), 'ATUAÇÃO');
  assert.equal(categoryGroup('ADESÃO AUTORIZADA'), 'ADESÃO');
  assert.equal(categoryGroup('RATEIO EM TRAMITAÇÃO'), 'RATEIO');
  assert.equal(categoryLabel('CONTROLE'), 'Atuação · Controle/Fiscalização');
  assert.equal(isWhatsAppCategoryAllowed({ classification: { category: 'CONTROLE' } }), false);
});
test('regra e IA com prova literal confirmam antes de autorizar mensagem', () => {
  const result = applySimpleTriage(item);
  assert.equal(result.catalogDecision, 'confirmado');
  assert.ok(item.rawText.includes(result.triage.evidence));
  assert.ok(result.triage.evidence.length > 80);
  assert.equal(result.triage.bodyHash.length, 64);
});
test('não aprova evidência que só aparece no título nem usa aprovação desatualizada', () => {
  assert.equal(decideSimpleTriage({ ...item, aiReview: { ...item.aiReview, evidence: 'Apenas palavras inventadas no título' } }).status, 'revisao');
  assert.equal(decideSimpleTriage({ ...item, aiReview: { ...item.aiReview, promptVersion: AI_PROMPT_VERSION - 1 } }).status, 'revisao');
});
test('discordância preserva a regra independente e a decisão semanal usa o veredito guardado', () => {
  const triaged = applySimpleTriage({ ...item, ruleClassification:item.classification,
    classification:{category:'GERAL',score:0},aiReview:{...item.aiReview,status:'rejected'} });
  assert.equal(triaged.catalogDecision,'revisao');
  assert.equal(triaged.classification.category,'ATUAÇÃO');
  const confirmed=applySimpleTriage(item);
  assert.deepEqual(applySimpleTriage({...confirmed,rawText:undefined}).triage,confirmed.triage);
});
test('falta de texto, fonte em teste, leitura parcial e discordância ficam em Revisar comigo', () => {
  const cases = [{ rawText: '' }, { previewOnly: true }, { rawText: item.rawText.repeat(200) },
    { aiReview: { ...item.aiReview, status: 'disputed' } }, { aiReview: { ...item.aiReview, status: 'rejected' } },
    { classification: { ...item.classification, category: 'GERAL', score: 0 } }];
  for (const change of cases) {
    const decision = decideSimpleTriage({ ...item, ...change });
    assert.equal(decision.status, 'revisao'); assert.ok(decision.checks.length >= 2);
  }
});
test('sem segunda leitura não se finge confirmação por mera palavra-chave', () => {
  assert.equal(decideSimpleTriage({ ...item, aiReview: null }).status, 'revisao');
});
test('listagem e versões da mesma publicação ficam para revisão, mesmo com aprovação em cache', () => {
  assert.equal(decideSimpleTriage({ ...item, duplicatePublication: true }).status, 'revisao');
  assert.equal(decideSimpleTriage({ ...item, articleUrl: 'https://example.org/category/institucional/' }).status, 'revisao');
});
test('rateio com partes e assinatura ganha prova de celebração; minuta não ganha', () => {
  const rawText = 'CONTRATO DE RATEIO Nº 1/2026. Município de São Pedro e Consórcio Intermunicipal de Saúde. Objeto: custeio regional. Data de Assinatura: 08/10/2026. Assinantes: prefeito e presidente.';
  const classification = {category:'RATEIO',score:10,reasons:[]};
  const proof = refineEventProof({title:'CONTRATO DE RATEIO Nº 1/2026',rawText},classification);
  assert.equal(proof.proofKind, 'documented_rateio');
  const decision=decideSimpleTriage({...item,rawText,aiReview:null,classification:proof});
  assert.equal(decision.status,'confirmado'); assert.ok(rawText.includes(decision.evidence));
  assert.equal(refineEventProof({title:'CONTRATO DE RATEIO Nº 1/2026',rawText:rawText.replace('08/10/2026','___/___/____')},classification).proofKind,undefined);
});
test('prova documental específica aceita norma publicada sem chamada nova à IA', () => {
  const result = decideSimpleTriage({ ...item, aiReview: null,
    classification: { ...item.classification, proofKind: 'published_inspection_rule', evidenceText: evidence.slice(2, -2) } });
  assert.equal(result.status, 'confirmado'); assert.ok(item.rawText.includes(result.evidence));
});
test('rejeição exige texto e evidência; não confunde erro de acesso com conteúdo irrelevante', () => {
  const result = decideSimpleTriage({ ...item, aiReview: null,
    classification: { category: 'GERAL', score: 0, evidenceText: evidence, reasons: ['rejeitado: contratação rotineira'] } });
  assert.equal(result.status, 'descartado');
  assert.equal(decideSimpleTriage({ ...item, rawText: '', classification: { category: 'GERAL', score: 0 } }).status, 'revisao');
});
test('instalação rotineira de ar-condicionado é exclusão documentada, sem excluir ato positivo de outra categoria', () => {
  const rawText='O Consórcio Intermunicipal publicou aviso para contratação de empresa especializada para prestação de serviços de instalação de um aparelho de ar-condicionado na cabine da usina. Envio de propostas até 27 de outubro.';
  const irrelevant={...item,rawText,aiReview:null,classification:{category:'GERAL',score:0}};
  const result=decideSimpleTriage(irrelevant);
  assert.equal(result.status,'descartado'); assert.ok(rawText.includes(result.evidence));
  assert.equal(decideSimpleTriage({...irrelevant,classification:{category:'RATEIO',score:8}}).status,'revisao');
});
test('revisões documentais anteriores mantêm precedência sobre aprovação automática', () => {
  assert.equal(applySimpleTriage({ ...item, editorialDecision: 'nao_evento' }).catalogDecision, 'descartado');
  assert.equal(applySimpleTriage({ ...item, editorialDecision: 'confirmar_evento', rawText: '' }).catalogDecision, 'confirmado');
});
test('revisão humana posterior substitui pendência automática histórica e permite a seleção semanal autorizada', () => {
  const pending={...item,ruleClassification:{category:'GERAL'},triage:{...decideSimpleTriage(item),status:'revisao',retroactive:true}};
  const guard=new Map([[canonicalUrl(item.url),{decisao:'confirmar_evento',categoria:'ATUAÇÃO',evidencia:evidence,motivo:'Atividade comprovada',publicar:false}]]);
  const reviewed=applyEditorialGuard(pending,guard);
  assert.equal(reviewed.triage,undefined);
  assert.equal(applySimpleTriage({...reviewed,rawText:undefined}).catalogDecision,'confirmado');
  const report=buildWeeklyReport({seen:{},observations:{one:{firstSeenAt:'2026-10-21T12:00:00Z',lastSeenAt:'2026-10-21T12:00:00Z',item:{...reviewed,weeklyDecision:'incluir',weeklyDate:'2026-10-21T12:00:00Z'}}}},
    {start:new Date('2026-10-20T12:00:00Z'),end:new Date('2026-10-22T12:00:00Z')});
  assert.equal(report.events,1);
});
test('lote histórico é vinculado ao registro exato e não vale após alterar o trecho', () => {
  const row = { id: 'x', url: item.url, titulo: item.title, trecho: evidence };
  const decision = { ...decideSimpleTriage(item), documentId: 'x', rowHash: rowFingerprint(row), retroactive: true };
  assert.equal(validOriginalTriage(row, decision), true);
  assert.equal(validOriginalTriage({ ...row, trecho: 'outro' }, decision), false);
});
test('lote contém exatamente as 69 pendências e cada exceção possui fonte e roteiro', async () => {
  const directory = new URL('../data/catalogo/', import.meta.url);
  const batch = JSON.parse(await readFile(new URL('triagem-simples-lote.json', directory), 'utf8'));
  const decisions = await loadOriginalTriage(fileURLToPath(directory));
  assert.equal(batch.ids.length, 69); assert.equal(decisions.size, 69);
  for (const id of batch.ids) {
    const d = decisions.get(id); assert.ok(d); assert.ok(/^https:\/\//.test(d.sourceUrl));
    if (d.status === 'revisao') assert.ok(d.checks?.length >= 2);
    else assert.ok(d.evidence);
  }
});
test('as 69 URLs não geram alertas ou boletim, inclusive confirmação sem alteração de estado', async () => {
  const directory = new URL('../data/catalogo/', import.meta.url);
  const decisions = await loadOriginalTriage(fileURLToPath(directory));
  const guard = await loadEditorialGuard(fileURLToPath(directory));
  const archive = (await readFile(new URL('arquivo-coletas.ndjson', directory), 'utf8')).trim().split('\n').map(JSON.parse);
  for (const row of archive.filter(r => decisions.has(r.id))) {
    for (const url of [row.url, row.article_url, decisions.get(row.id).sourceUrl].filter(Boolean)) {
      const protectedItem = applyEditorialGuard({ ...item, url }, guard);
      assert.ok(['historico','descartado'].includes(protectedItem.publicationDecision), row.id);
      assert.equal(isNotifiable(protectedItem), false, row.id);
    }
  }
  const state = JSON.parse(await readFile(new URL('../state/news-state.json', import.meta.url), 'utf8'));
  const before = createHash('sha256').update(JSON.stringify(state)).digest('hex');
  const window = { start: new Date('2026-10-19T03:00:00Z'), end: new Date('2026-10-26T03:00:00Z') };
  const prepared = await prepareWeeklyState(state, fileURLToPath(directory), window);
  const report = buildWeeklyReport(prepared, window);
  const urls = new Set(archive.filter(r => decisions.has(r.id)).map(r => r.url));
  assert.ok(report.highlights.every(i => !urls.has(i.url)));
  assert.equal(createHash('sha256').update(JSON.stringify(state)).digest('hex'), before);
});
