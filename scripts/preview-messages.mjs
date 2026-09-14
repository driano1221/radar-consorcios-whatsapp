import { readFile, writeFile } from 'node:fs/promises';
import { buildWeeklyReport, weeklyWindow } from '../src/lib/history.mjs';
import { formatWeeklyMessage, formatWhatsAppMessage } from '../src/lib/format.mjs';
import { classifyItem, isPublishableClassification } from '../src/lib/classifier.mjs';
const state = JSON.parse(await readFile(process.argv[2] || 'output/research-state-v3.json'));
const items = Object.values(state.observations || {}).map((r) => ({ ...r.item, classification: classifyItem(r.item) }))
  .filter((i) => isPublishableClassification(i.classification));
for (const r of Object.values(state.observations || {})) r.item.classification = classifyItem(r.item);
const report = buildWeeklyReport(state, weeklyWindow(new Date(), true));
const messages = [formatWeeklyMessage(report, true), ...items.slice(0, 3).map(formatWhatsAppMessage)];
const escape = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const format = (s) => escape(s).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/_([^_\n]+)_/g, '<i>$1</i>').replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>').replace(/\n/g, '<br>');
const html = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Validação das mensagens do Radar</title><style>body{margin:0;background:#eeeae2;font:16px/1.5 system-ui;color:#182620}header{background:#075e54;color:white;padding:20px}main{max-width:460px;margin:auto;padding:20px 12px}article{background:#d9fdd3;border-radius:10px;padding:16px;margin:0 0 24px;overflow-wrap:anywhere;box-shadow:0 1px 2px #0002}blockquote{border-left:3px solid #648468;margin:8px 0;padding-left:10px;color:#344b3e}i{font-size:14px;color:#43554a}small{display:block;margin-top:14px;color:#617667}</style><header>Radar Consórcios · prévia visual<br><small style="color:white">Simulação local; confirme o resultado no WhatsApp.</small></header><main>${messages.map(s=>`<article>${format(s)}<small>Prévia · ${s.length} caracteres</small></article>`).join('')}</main></html>`;
await writeFile('output/message-preview.html', html);
await writeFile('output/weekly-preview.txt', messages[0] + '\n');
console.log(`Prévia criada: ${messages.length} mensagens; resumo com ${messages[0].length} caracteres.`);
