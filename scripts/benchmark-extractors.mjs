import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { extractArticleText } from '../src/lib/article-enrichment.mjs';
import { classifyItem } from '../src/lib/classifier.mjs';

const cases = [
  { name: 'Umuarama', url: 'https://portalumuaramanews.com.br/2026/10/06/camara-aprova-adesao-de-umuarama-a-consorcio-de-prevencao-a-desastres/',
    expected: ['Conclima', 'aprovou'] },
  { name: 'Marcelândia', url: 'https://amm.diariomunicipal.org/publicacao/1920936/',
    expected: ['CIDESPA', 'MARCELÂNDIA', 'Serviço de Inspeção Municipal'] },
  { name: 'Alto Paraguai', url: 'https://amm.diariomunicipal.org/publicacao/1919732/',
    expected: ['200.010,82', 'Fila Zero', '02 de Outubro de 2.027'] },
  { name: 'Patos de Minas', url: 'https://www.patosja.com.br/Pol%C3%ADtica/ex-presidente-do-cisalp-depoe-a-cpi-da-saude-e-questiona-criacao-de-novo-consorcio-em-patos-de-minas',
    expected: ['questionou', 'criação de um novo consórcio'] },
];

const archive = (await readFile(new URL('../data/catalogo/arquivo-coletas.ndjson', import.meta.url), 'utf8'))
  .split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const hosts = new Set(cases.map(({ url }) => new URL(url).hostname));
for (const row of archive) {
  const url = row.article_url;
  if (!url || !/^https?:\/\//.test(url) || row.tipo_evento === 'GERAL') continue;
  const host = new URL(url).hostname;
  if (hosts.has(host)) continue;
  hosts.add(host);
  cases.push({ name: `Amostra ${host}`, url, expected: [] });
  if (cases.length >= 10) break;
}

const python = process.argv[2] || '.local/trafilatura-venv/Scripts/python.exe';
function trafilatura(html) {
  const result = spawnSync(python, ['scripts/trafilatura-stdin.py'], {
    input: html, encoding: 'utf8', maxBuffer: 5_000_000, timeout: 30_000,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr?.trim());
  return result.stdout;
}

for (const item of cases) {
  try {
    const response = await fetch(item.url, { signal: AbortSignal.timeout(15_000),
      headers: { 'user-agent': 'RadarConsorciosIPEA/0.2 (+pesquisa acadêmica)' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    if (html.length > 2_000_000) throw new Error('HTML acima de 2 MB');
    const dom = new JSDOM(html, { url: item.url });
    const results = {
      anterior_4k: extractArticleText(html).slice(0, 4000),
      atual: extractArticleText(html),
      readability: new Readability(dom.window.document).parse()?.textContent || '',
      trafilatura: trafilatura(html),
    };
    dom.window.close();
    console.log(`\n${item.name} — ${item.url}`);
    for (const [method, value] of Object.entries(results)) {
      const found = item.expected.filter((term) => value.toLocaleLowerCase('pt-BR').includes(term.toLocaleLowerCase('pt-BR')));
      const classification = classifyItem({ kind: 'news', title: item.name, rawText: value, summary: value.slice(0, 1800), url: item.url });
      console.log(`${method.padEnd(12)} ${String(value.length).padStart(6)} caracteres | provas ${found.length}/${item.expected.length}` +
        (item.expected.length ? ` | faltam: ${item.expected.filter((term) => !found.includes(term)).join('; ') || 'nenhuma'}` : '') +
        ` | classe: ${classification.category} (${classification.score})` +
        ` | início: ${value.replace(/\s+/g, ' ').slice(0, 90)}`);
      if (item.expected.length && method !== 'anterior_4k') {
        console.log(`  evidência: ${classification.evidenceText.replace(/\s+/g, ' ').slice(0, 260)}`);
      }
    }
  } catch (error) {
    console.log(`\n${item.name} — falha: ${error.message}`);
  }
}
