import { writeFile } from 'node:fs/promises';
import path from 'node:path';

const palette = {
  ink: '#263b30', muted: '#607268', line: '#9fb4a5', paper: '#fffefa',
  neutral: '#f2f5ef', green: '#eaf3e9', greenLine: '#477956',
  rust: '#f7eee9', rustLine: '#aa6d56', amber: '#faf4e3', amberLine: '#aa8b42',
  blue: '#edf3f4', blueLine: '#63818a',
};

const escapeXml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
})[char]);

function card({ x, y, w, h, tag, title, lines = [], tone = 'neutral' }) {
  const fill = palette[tone] || palette.neutral;
  const stroke = palette[`${tone}Line`] || palette.line;
  const short = h < 100;
  const titleY = y + (short ? 45 : 55);
  const bodyY = titleY + (short ? 21 : 25);
  return `<g class="card">
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}"/>
    <rect x="${x}" y="${y}" width="4" height="${h}" fill="${stroke}"/>
    <text class="tag" x="${x + 19}" y="${y + 24}">${escapeXml(tag)}</text>
    <text class="title" x="${x + 19}" y="${titleY}">${escapeXml(title)}</text>
    ${lines.map((line, index) => `<text class="body" x="${x + 19}" y="${bodyY + index * 20}">${escapeXml(line)}</text>`).join('')}
  </g>`;
}

function arrow(d, tone = 'line') {
  return `<path d="${d}" fill="none" stroke="${palette[tone]}" stroke-width="2" stroke-linecap="square" stroke-linejoin="miter" marker-end="url(#arrow)"/>`;
}

function rule(d, tone = 'line') {
  return `<path d="${d}" fill="none" stroke="${palette[tone]}" stroke-width="2" stroke-linecap="square"/>`;
}

function label(x, y, content) {
  return `<text class="lane" x="${x}" y="${y}">${escapeXml(content)}</text>`;
}

function svg({ width, height, title, description, content, mobile = false }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-labelledby="title desc"${mobile ? ' class="mobile"' : ''}>
  <title id="title">${escapeXml(title)}</title>
  <desc id="desc">${escapeXml(description)}</desc>
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="${palette.line}"/></marker>
  </defs>
  <style>
    text { font-family: "Segoe UI", Arial, sans-serif; }
    .tag, .lane { fill: #4f735b; font-size: 12px; font-weight: 700; letter-spacing: 1.2px; }
    .title { fill: ${palette.ink}; font-size: 20px; font-weight: 700; }
    .body { fill: ${palette.muted}; font-size: 14px; }
    .note { fill: ${palette.muted}; font-size: 14px; }
    .mobile .tag, .mobile .lane { font-size: 13.5px; }
    .mobile .title { font-size: 22px; }
    .mobile .body, .mobile .note { font-size: 16px; }
  </style>
  <rect width="${width}" height="${height}" fill="${palette.paper}"/>
  ${content}
</svg>\n`;
}

export function desktopFlowSvg() {
  const content = [
    label(40, 36, '01 / O QUE ACONTECE COM CADA PUBLICAÇÃO'),
    card({ x: 40, y: 66, w: 320, h: 148, tag: '1 · DESCOBERTA', title: 'Coleta nas fontes',
      lines: ['Diários, RSS, notícias, SAPL, CIGA', 'e portais de consórcios.'] }),
    card({ x: 420, y: 66, w: 320, h: 148, tag: '2 · DOCUMENTO', title: 'Leitura do conteúdo',
      lines: ['Texto da página e data original.', 'PDF e OCR seletivo na recuperação.'] }),
    card({ x: 800, y: 66, w: 320, h: 148, tag: '3 · CONTEXTO', title: 'Regras + evidência',
      lines: ['Distingue ato, autorização, intenção', 'e simples menção; guarda o trecho.'] }),
    arrow('M 360 140 H 412'), arrow('M 740 140 H 792'),
    arrow('M 960 214 V 255 H 295 V 284'),
    arrow('M 960 255 H 865 V 284'),
    label(40, 273, 'DECISÃO HISTÓRICA · BASE'),
    label(610, 273, 'DECISÃO DE ENVIO · WHATSAPP'),
    card({ x: 40, y: 288, w: 510, h: 100, tag: '4A · DESTINO NO CATÁLOGO', title: 'O que ficou comprovado?',
      lines: ['A decisão descreve só o que a fonte realmente prova.'], tone: 'blue' }),
    card({ x: 610, y: 288, w: 510, h: 100, tag: '4B · PORTÃO INDEPENDENTE', title: 'Cabe um alerta agora?',
      lines: ['Estar no arquivo ou na base não basta para enviar.'], tone: 'blue' }),
    rule('M 295 388 V 410 H 72 V 751'),
    arrow('M 72 470 H 106'), arrow('M 72 585 H 106'), arrow('M 72 700 H 106'),
    card({ x: 110, y: 424, w: 440, h: 94, tag: 'DENTRO DA BASE', title: 'Fato comprovado',
      lines: ['Ex.: lei autoriza ingresso; não prova adesão efetiva.'], tone: 'green' }),
    card({ x: 110, y: 539, w: 440, h: 94, tag: 'FORA DA BASE', title: 'Descartado com motivo',
      lines: ['Ex.: menção passiva, busca genérica ou duplicata.'], tone: 'rust' }),
    card({ x: 110, y: 654, w: 440, h: 94, tag: 'EXCEÇÃO TEMPORÁRIA', title: 'Candidato para conferir',
      lines: ['Falta texto, identidade ou prova; não inventa fato.'], tone: 'amber' }),
    card({ x: 665, y: 424, w: 400, h: 80, tag: 'FILTRO 1', title: 'Data + publicabilidade',
      lines: ['Data original, relevância e fonte em prévia.'] }),
    card({ x: 665, y: 529, w: 400, h: 80, tag: 'FILTRO 2', title: 'Novidade + limite',
      lines: ['Deduplica, põe na fila e respeita a cota diária.'] }),
    card({ x: 665, y: 634, w: 400, h: 80, tag: 'REVISÃO OPCIONAL', title: 'DeepSeek confere',
      lines: ['Dúvida ou discordância segura o envio.'], tone: 'amber' }),
    card({ x: 665, y: 739, w: 400, h: 80, tag: 'RESULTADO', title: 'Mensagem no grupo',
      lines: ['Só para item elegível, novo e aprovado.'], tone: 'green' }),
    arrow('M 865 388 V 418'), arrow('M 865 504 V 523'),
    arrow('M 865 609 V 628'), arrow('M 865 714 V 733'),
    rule('M 40 850 H 1120'),
    label(40, 879, 'RASTREABILIDADE'),
    `<text class="note" x="40" y="904">Toda coleta guarda fonte e decisão; o trecho, quando obtido. Nem todo item vira alerta.</text>`,
    label(40, 940, 'RESUMO DE SÁBADO'),
    `<text class="note" x="40" y="965">É uma edição separada, produzida a partir dos achados guardados; não é cada alerta somado.</text>`,
  ].join('\n');
  return svg({ width: 1160, height: 994, title: 'Fluxo do Radar Consórcios, da coleta ao catálogo e ao WhatsApp',
    description: 'As fontes alimentam a leitura integral e a triagem. Depois há dois caminhos: decisão histórica para a base, com aceito, descartado ou exceção; e decisão independente de envio, com data, duplicidade, limite, revisão opcional por DeepSeek e WhatsApp.', content });
}

export function mobileFlowSvg() {
  const content = [
    label(20, 38, '01 / DESCOBERTA E LEITURA'),
    card({ x: 20, y: 60, w: 400, h: 115, tag: '1 · DESCOBERTA', title: 'Coleta nas fontes',
      lines: ['Diários, RSS, notícias, SAPL, CIGA', 'e portais de consórcios.'] }),
    card({ x: 20, y: 210, w: 400, h: 115, tag: '2 · DOCUMENTO', title: 'Leitura do conteúdo',
      lines: ['Texto da página e data original.', 'PDF e OCR na recuperação seletiva.'] }),
    card({ x: 20, y: 360, w: 400, h: 115, tag: '3 · CONTEXTO', title: 'Regras + evidência',
      lines: ['Ato, autorização, intenção ou menção?', 'O trecho que sustenta a decisão fica salvo.'] }),
    arrow('M 220 175 V 204'), arrow('M 220 325 V 354'),
    label(20, 520, '02 / DESTINO HISTÓRICO NA BASE'),
    card({ x: 20, y: 540, w: 400, h: 100, tag: '4A · PRIMEIRA DECISÃO', title: 'O que ficou comprovado?',
      lines: ['Só se registra o alcance real da prova.'], tone: 'blue' }),
    rule('M 220 640 V 664 H 40 V 951'),
    arrow('M 40 717 H 66'), arrow('M 40 817 H 66'), arrow('M 40 917 H 66'),
    card({ x: 70, y: 675, w: 350, h: 82, tag: 'DENTRO', title: 'Fato comprovado',
      lines: ['Autorização não é adesão efetiva.'], tone: 'green' }),
    card({ x: 70, y: 775, w: 350, h: 82, tag: 'FORA', title: 'Descartado com motivo',
      lines: ['Menção passiva, busca ou duplicata.'], tone: 'rust' }),
    card({ x: 70, y: 875, w: 350, h: 82, tag: 'EXCEÇÃO TEMPORÁRIA', title: 'Candidato a conferir',
      lines: ['Falta texto, identidade ou prova.'], tone: 'amber' }),
    label(20, 1008, '03 / PORTÃO INDEPENDENTE DE ALERTA'),
    card({ x: 20, y: 1028, w: 400, h: 100, tag: '4B · SEGUNDA DECISÃO', title: 'Cabe um alerta agora?',
      lines: ['Um registro na base não é envio automático.'], tone: 'blue' }),
    card({ x: 45, y: 1163, w: 375, h: 82, tag: 'FILTRO 1', title: 'Data + publicabilidade',
      lines: ['Data original, relevância e prévia.'] }),
    card({ x: 45, y: 1280, w: 375, h: 82, tag: 'FILTRO 2', title: 'Novidade + limite',
      lines: ['Deduplica, fila e cota diária.'] }),
    card({ x: 45, y: 1397, w: 375, h: 82, tag: 'REVISÃO OPCIONAL', title: 'DeepSeek confere',
      lines: ['Dúvida segura o envio.'], tone: 'amber' }),
    card({ x: 45, y: 1514, w: 375, h: 82, tag: 'RESULTADO', title: 'Mensagem no grupo',
      lines: ['Só item novo, elegível e aprovado.'], tone: 'green' }),
    arrow('M 220 1128 V 1157'), arrow('M 232 1245 V 1274'),
    arrow('M 232 1362 V 1391'), arrow('M 232 1479 V 1508'),
    rule('M 20 1630 H 420'),
    label(20, 1659, 'RASTREABILIDADE'),
    `<text class="note" x="20" y="1683">Fonte e decisão; trecho, quando obtido.</text>`,
    label(20, 1730, 'RESUMO DE SÁBADO'),
    `<text class="note" x="20" y="1754">Edição separada dos achados guardados.</text>`,
  ].join('\n');
  return svg({ width: 440, height: 1783, title: 'Fluxo do Radar Consórcios para tela estreita',
    description: 'Coleta, leitura e regras; destino histórico na base com três resultados; portão independente para alertas com data, novidade, limite, DeepSeek opcional e WhatsApp.', content, mobile: true });
}

export async function writeFlowDiagrams(destination) {
  await Promise.all([
    writeFile(path.join(destination, 'fluxo-radar.svg'), desktopFlowSvg(), 'utf8'),
    writeFile(path.join(destination, 'fluxo-radar-mobile.svg'), mobileFlowSvg(), 'utf8'),
  ]);
}
