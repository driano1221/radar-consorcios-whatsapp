import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadState } from '../src/lib/dedupe.mjs';

const root = path.resolve(import.meta.dirname, '..');
const outputDir = path.join(root, 'output');
const cases = [
  ['agenda-abc', 'cria agenda setorial', '2026-09-22', true, ['ATUAÇÃO'], false],
  ['adesao-centenario', 'Autoriza o ingresso do Município de Centenário do Sul', '2026-09-21', true, ['ADESÃO'], false],
  ['adesao-caratinga', 'Município é autorizado a integrar consórcio intermunicipal CIMINAS', '2026-09-22', true, ['ADESÃO'], false],
  ['adesao-neves', 'Ribeirão das Neves oficializa adesão', '2026-09-17', true, ['ADESÃO'], false],
  ['crise-mt', 'Inadimplência deixa oito municípios', '2026-09-16', true, ['CRISE'], false],
  ['protocolo-simao-dias', 'Diário Oficial de Simão Dias', '2026-09-18', true, ['PROTOCOLO', 'GOVERNANÇA', 'ADESÃO'], false],
  ['rateio-votuporanga', 'Diário Oficial de Votuporanga', '2026-09-17', true, ['RATEIO'], false],
  ['balanco-votuporanga', 'Diário Oficial de Votuporanga', '2026-09-18', false, ['IRRELEVANTE'], false],
  ['rreo-arataca', 'Diário Oficial de Arataca', '2026-09-18', false, ['IRRELEVANTE'], false],
  ['orcamento-camaqua', 'Diário Oficial de Camaquã', '2026-09-15', false, ['IRRELEVANTE'], false],
  ['servico-campo-mourao', 'Diário Oficial de Campo Mourão', '2026-09-21', false, ['IRRELEVANTE'], false],
];

function buildDataset(state) {
  const items = Object.values(state.observations || {}).map((record) => record.item);
  const dataset = cases.map(([id, titlePart, date, relevant, acceptedCategories, creation]) => {
    const matches = items.filter((item) => item.title?.includes(titlePart) && item.publishedAt?.startsWith(date));
    const distinct = [...new Map(matches.map((item) => [JSON.stringify([item.title, item.summary, item.classification?.evidenceText]), item])).values()];
    if (distinct.length !== 1) throw new Error(`${id}: esperado um registro distinto, encontrados ${distinct.length}.`);
    const item = distinct[0];
    return {
      id, origin: 'histórico do radar', relevant, acceptedCategories, creation,
      title: item.title, summary: item.summary || '',
      evidence: item.classification?.evidenceText || '',
      source: item.source,
    };
  });
  dataset.push({
    id: 'criacao-sim-oeste', origin: 'Agência Sebrae de Notícias, 05/05/2026',
    relevant: true, acceptedCategories: ['CRIAÇÃO'], creation: true,
    title: 'Cinco cidades da região Oeste passam a contar com consórcio SIM',
    summary: 'Foi formalizada a ata de fundação do Consórcio Intermunicipal SIM Oeste, formado por Faina, Fazenda Nova, Itapirapuã, Jussara e Matrinchã.',
    evidence: 'A formalização da ata de fundação do Consórcio Intermunicipal SIM Oeste ocorreu durante o Agroshow de Jussara.',
    source: 'Agência Sebrae de Notícias',
  });
  dataset.push({
    id: 'saida-campo-belo', origin: 'Lei Municipal 4.497/2026 de Campo Belo',
    relevant: true, acceptedCategories: ['SAÍDA'], creation: false,
    title: 'Campo Belo publica lei que autoriza retirada de consórcio',
    summary: 'A Lei nº 4.497/2026 autoriza a retirada do Município de Campo Belo do Consórcio Intermunicipal de Saúde da Microrregião do Alto Rio Grande.',
    evidence: 'Autoriza a retirada do Município de Campo Belo do Consórcio Intermunicipal de Saúde da Microrregião do Alto Rio Grande.',
    source: 'Diário Oficial de Campo Belo',
  });
  return dataset;
}

const dataset = buildDataset(await loadState(path.join(root, 'state', 'news-state.json')));
await mkdir(outputDir, { recursive: true });
await writeFile(path.join(outputDir, 'ai-eval-dataset.json'), JSON.stringify(dataset, null, 2) + '\n');
console.log(`Amostra congelada: ${dataset.length} casos; ${dataset.filter((item) => item.relevant).length} relevantes; ${dataset.filter((item) => !item.relevant).length} falsos positivos.`);
if (!process.argv.includes('--deepseek')) process.exit(0);

const key = process.env.DEEPSEEK_API_KEY;
if (!key) throw new Error('DEEPSEEK_API_KEY ausente.');
const system = `Você é revisor de notícias sobre consórcios públicos intermunicipais brasileiros. Classifique APENAS o fato comprovado no texto recebido. CRIAÇÃO significa fundação de uma NOVA entidade consorcial; se um consórcio existente criou agenda, projeto ou serviço, classifique ATUAÇÃO. ADESÃO exige ato de ingresso, não proposta ou mera possibilidade. RATEIO exige ato/contrato concreto, não linha contábil, balanço, orçamento ou menção normativa. PROTOCOLO exige ratificação, assinatura ou alteração como fato principal, não citação incidental em contrato de serviço. CONTROLE exige fiscalização real, não cláusula genérica sobre improbidade. Se o texto não comprova evento novo, marque relevante=false e categoria=IRRELEVANTE. Responda somente JSON: {"relevante":boolean,"categoria":"CRIAÇÃO|ADESÃO|SAÍDA|RATEIO|PROTOCOLO|GOVERNANÇA|CONTROLE|CRISE|ATUAÇÃO|IRRELEVANTE|INCERTO","novo_consorcio":boolean,"evidencia":"trecho literal curto do texto","justificativa":"uma frase"}. Não invente fatos nem use conhecimento externo.`;
const results = [];
for (const item of dataset) {
  const user = JSON.stringify({ titulo: item.title, resumo: item.summary.slice(0, 700), trecho: item.evidence.slice(0, 1400), fonte: item.source });
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek-flash', thinking: { type: 'disabled' }, response_format: { type: 'json_object' },
      max_tokens: 250, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
    signal: AbortSignal.timeout(40000),
  });
  if (!response.ok) throw new Error(`DeepSeek HTTP ${response.status} no caso ${item.id}.`);
  const payload = await response.json();
  const answer = JSON.parse(payload.choices?.[0]?.message?.content || '{}');
  const result = {
    id: item.id, expected: { relevant: item.relevant, categories: item.acceptedCategories, creation: item.creation },
    predicted: answer, usage: payload.usage,
    relevantCorrect: answer.relevante === item.relevant,
    categoryCorrect: item.acceptedCategories.includes(answer.categoria),
    creationCorrect: answer.novo_consorcio === item.creation,
  };
  results.push(result);
  console.log(`${item.id}: relevante=${answer.relevante}, categoria=${answer.categoria}, novo=${answer.novo_consorcio}; acertos=${Number(result.relevantCorrect)}/${Number(result.categoryCorrect)}/${Number(result.creationCorrect)}`);
}
const summary = {
  model: 'deepseek-flash', sampleSize: results.length,
  relevantCorrect: results.filter((r) => r.relevantCorrect).length,
  categoryCorrect: results.filter((r) => r.categoryCorrect).length,
  creationCorrect: results.filter((r) => r.creationCorrect).length,
  inputTokens: results.reduce((n, r) => n + (r.usage?.prompt_tokens || 0), 0),
  outputTokens: results.reduce((n, r) => n + (r.usage?.completion_tokens || 0), 0),
};
await writeFile(path.join(outputDir, 'ai-eval-deepseek.json'), JSON.stringify({ summary, results }, null, 2) + '\n');
console.log(JSON.stringify(summary));
