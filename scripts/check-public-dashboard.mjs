import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const directory = path.join(root, 'dashboard', 'dist');
const [raw, versionRaw, size] = await Promise.all([
  readFile(path.join(directory, 'data.json'), 'utf8'),
  readFile(path.join(directory, 'version.json'), 'utf8'),
  stat(path.join(directory, 'data.json')),
]);
const data = JSON.parse(raw);
const version = JSON.parse(versionRaw);
if (!data.public) throw new Error('O pacote não foi gerado no modo público.');
if (data.items.some((item) => item.fullText)) throw new Error('Texto integral entrou no pacote público.');
if (version.generatedAt !== data.generatedAt || version.lastCollectionAt !== data.lastCollectionAt)
  throw new Error('Versão e dados do painel não correspondem.');
if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(raw) ||
    /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/.test(raw) || /\b\d{10,20}@g\.us\b/.test(raw))
  throw new Error('Identificador pessoal detectado no pacote público.');
if (size.size > 10_000_000) throw new Error('Pacote público excede 10 MB; revisar conteúdo antes de publicar.');
console.log(`[painel] Pacote público validado: ${data.items.length} publicações, ${(size.size / 1_000_000).toFixed(2)} MB.`);
