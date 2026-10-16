import test from 'node:test';
import assert from 'node:assert/strict';
import { IDS, duplicateOwner } from '../scripts/pilot-retroactive-ten.mjs';
import { classifyItem } from '../src/lib/classifier.mjs';

test('piloto tem exatamente dez IDs distintos, sem seleção aberta do acervo', () => {
  assert.equal(IDS.length, 10);
  assert.equal(new Set(IDS).size, 10);
});
const classify = rawText => classifyItem({ kind: 'news', title: 'Documento legislativo', rawText });
test('Varre-Sai não é saída, mas saída real do município continua detectável', () => {
  assert.notEqual(classify('Prefeitura Municipal de Varre-Sai. Ratifica o contrato de Consórcio Público Multifinalitário CONSPNOR.').category, 'SAÍDA');
  assert.equal(classify('O Município de Varre-Sai saiu do consórcio público CONSPNOR.').category, 'SAÍDA');
});
test('lei que autoriza ratificação para constituição não prova consórcio já operando', () => {
  const r = classify('LEI MUNICIPAL 388/2026. Autoriza o Poder Executivo a ratificar protocolo de intenções para a constituição de consórcio público intermunicipal CONVALE.');
  assert.equal(r.category, 'PROTOCOLO');
  assert.match(r.stage, /não comprovada/);
});
test('autógrafo aprovado com minuta não vira constituição consumada', () => {
  const r = classify('Encaminho o Autógrafo n° 17/2021, que autoriza protocolo para a constituição de consórcio público, aprovado em sessão plenária. ANEXO - MINUTA. O consórcio será constituído como associação pública.');
  assert.equal(r.category, 'PROTOCOLO');
  assert.match(r.stage, /autógrafo encaminhado/);
});
test('permanência não é ingresso nem celebração de rateio', () => {
  const r = classify('LEI MUNICIPAL 352/2025. RATIFICA A ALTERAÇÃO DO CONTRATO DO CONSÓRCIO INTERMUNICIPAL CISVAP E AUTORIZA A PERMANÊNCIA DO MUNICÍPIO COMO ENTE CONSORCIADO. Continuará a contribuir pelo sistema de rateio.');
  assert.equal(r.category, 'GOVERNANÇA');
  assert.equal(r.participationEvidence, true);
});
test('ata distingue autorização de cofinanciamento de proposta ainda não votada', () => {
  const body = 'ATA Nº. 04/2021 DA REUNIÃO extraordinária do Consórcio Público CIM NORTE. Foi aprovado por unanimidade autorizar o cofi - nanciamento pelos municípios consorciados no percentual de 40% dos custos.';
  const r = classify(body);
  assert.equal(r.category, 'FINANÇAS');
  assert.match(r.stage, /pagamento.*não comprovados/);
  assert.notEqual(classify(body.replace('Foi aprovado por unanimidade', 'Será debatido se devemos')).category, 'FINANÇAS');
});
test('deduplicação usa conteúdo do PDF, não URL nem título de busca', () => {
  const first = { id: 'original', extraction: { pdf_sha256: 'same' } };
  assert.equal(duplicateOwner([first], { extraction: { pdf_sha256: 'same' } }), 'original');
  assert.equal(duplicateOwner([first], { extraction: { pdf_sha256: 'different' } }), '');
  assert.equal(duplicateOwner([first], {}), '');
});
