import { findIdentityMentions } from './consortium-identity.mjs';
import { normalizeWhitespace, truncate } from './text.mjs';

function shortMoney(text = '') {
  const money = text.match(/R\$\s*[\d.,]+/)?.[0] || '';
  const number = Number(money.replace(/[^\d,]/g, '').replace(',', '.'));
  return money && number >= 1000 && number % 1000 === 0
    ? `R$ ${new Intl.NumberFormat('pt-BR').format(number / 1000)} mil` : money;
}

function compactFact(item, context, opening, article, object, rectified) {
  const proof = item.classification?.proofKind;
  const amendment = /aditivo|aditamento/i.test(context.title);
  const amount = shortMoney(amendment
    ? context.values.find(value => /acrescid|adicional|(?:do|no)\s+aditiv|aditamento/i.test(value))
    : context.values[0]);
  const rateio = context.title.match(/(?:contrato\s+de\s+)?rateio\s*(?:n[º°o.]?\s*)?([\d.]+\/\d{4})/i)?.[1];
  if (rectified) return `Retificação do ${/rateio/i.test(context.title) ? 'rateio' : 'instrumento'}${rateio ? ` nº ${rateio}` : ''}${shortMoney(rectified) ? `: valor corrigido para ${shortMoney(rectified)}` : ' publicada'}.`;
  if (proof === 'documented_rateio') {
    if (/aditivo|aditamento/i.test(context.title)) return `Aditivo${amount ? ` de ${amount}` : ''} ao rateio${rateio ? ` nº ${rateio}` : ''}.`;
    return `Contrato de rateio${rateio ? ` nº ${rateio}` : ''}${amount ? `, de ${amount}` : ''}.`;
  }
  if (proof === 'public_service_agreement' && object) {
    const service = /aquisi[cç][aã]o e distribui[cç][aã]o de medicamentos essenciais/i.test(object)
      ? `aquisição e distribuição de medicamentos essenciais${/\bSUS\b/.test(object) ? ' do SUS' : ''}`
      : object.match(/presta[cç][aã]o de ([^,;.]+)/i)?.[1];
    if (service) return `${/aditivo/i.test(context.title) ? 'Aditivo' : 'Convênio'}${amount ? ` de ${amount}` : ''} para ${service}.`;
  }
  if (/^Fica ratificad[oa]/i.test(article || '')) {
    if (proof === 'published_governance_rule' && /altera[cç][aã]o.{0,30}protocolo/i.test(article)) {
      const inspection = /Fica delegada\b.{0,1200}Servi[cç]o de Inspe[cç][aã]o Municipal/i.test(opening) && /produtos de origem animal/i.test(opening);
      return `Lei ratifica alteração do protocolo${inspection ? ' e delega ao consórcio competências de inspeção municipal de produtos de origem animal' : ' de intenções'}.`;
    }
    if (proof === 'ratified_protocol') {
      const name = context.consortia.length === 1 ? context.consortia[0].replace(/\s*\([^)]+\)$/, '')
        .replace(/^Cons[oó]rcio\s+(?:P[uú]blico\s+)?Intermunicipal\s+/i, 'Consórcio ') : 'consórcio';
      return /visando [àa] constitui[cç][aã]o/i.test(article)
        ? `Município ratifica protocolo para constituir o ${name}.`
        : `Município ratifica o protocolo de intenções${/consolidado e substitutivo/i.test(article) ? ' consolidado e substitutivo' : ''}.`;
    }
  }
  if (proof === 'published_inspection_rule' && /SISBI/i.test(opening) && /produtos de origem animal/i.test(opening))
    return 'Norma define requisitos de inspeção para o comércio de produtos de origem animal (SIM/SISBI).';
  return context.description ? `No ato: ${truncate(context.description, 190)}` : context.title || '';
}

// Presentation only from the stored document; never infer a new decision.
export function weeklyContext(item, row = {}, body = item.rawText || item.summary || '') {
  const text = normalizeWhitespace(body);
  // An annex may list other municipalities/acts; identify the issuer before it.
  const opening = text.split(/\bANEXO\s+(?:[IVX]+|[ÚU]NICO|\d+)\s+(?:PROTOCOLO|ESTATUTO|CL[ÁA]USULA)\b/i)[0];
  const names = findIdentityMentions({ tipo_evento: item.classification?.category,
    titulo: item.title, trecho: opening, consorcio: row.consorcio, sigla: row.sigla });
  const intergestores = opening.match(/cons[oó]rcio\s+intergestores\s+[\p{L} ]+?(?=\s+(?:com\s+vistas|inscrito|e\s+o\s+munic)|[,.;(]|$)/iu)?.[0];
  const consortia = names.map(name => {
    const index = opening.toLocaleLowerCase('pt-BR').indexOf(name.name.toLocaleLowerCase('pt-BR'));
    const tail = index < 0 ? '' : opening.slice(index + name.name.length);
    const alias = tail.match(/^\s*(?:[–—-]\s*|\(\s*)([\p{L}\d -]+?)(?=\s*(?:[,.;()]|\bCNPJ\b|\binscrit[oa]\b|$))/iu)?.[1]?.trim();
    const acronym = alias && alias.length <= 50 ? alias : name.acronym.replace(/\s+CNPJ\b.*$/i, '');
    return `${name.name}${acronym ? ` (${acronym})` : ''}`;
  });
  if (!consortia.length && intergestores) consortia.push(intergestores);
  const placeEnd = '(?=\\s*(?:[,.;:/]|[–—-]\\s*[A-Z]{2}\\b)|\\s+e\\s+o\\s+cons[oó]rcio\\b|$)';
  const issuer = opening.match(new RegExp('prefeito\\s+(?:municipal\\s+de|do\\s+munic[ií]pio\\s+de)\\s+([\\p{L} \'’–-]+?)' + placeEnd, 'iu'))?.[1];
  const party = opening.match(new RegExp('(?:prefeitura\\s+municipal|munic[ií]pio)\\s+de\\s+([\\p{L} \'’–-]+?)' + placeEnd, 'iu'))?.[1];
  const municipality = item.editorialFacts?.municipio || issuer || row.municipio || item.territoryName || party || '';
  const stateCode = row.uf || item.stateCode || '';
  const location = municipality ? `${municipality}${stateCode && !new RegExp('[/–—-]\\s*' + stateCode + '$', 'i').test(municipality) ? `/${stateCode}` : ''}` : '';

  const instrumentPattern = /(?:(?:\d+[º°o]?\s+)?termo\s+aditivo(?:\s+ao\s+contrato\s+de\s+rateio)?|contrato\s+de\s+rateio|(?:termo\s+de\s+)?conv[eê]nio|instru[cç][aã]o\s+normativa|lei(?:\s+municipal)?)\s*(?:n[º°o.]?\s*)?[:\s]*[\d.]+\s*\/\s*\d{4}/i;
  const instrument = (item.title || '').match(instrumentPattern)?.[0] || opening.slice(0, 350).match(instrumentPattern)?.[0] || '';
  const correction = /retifica[cç][aã]o|onde\s+se\s+l[eê]/i.test(`${item.title || ''} ${opening.slice(0, 400)}`);
  const title = instrument ? `${correction ? 'Retificação do ' : ''}${instrument}` : '';
  const object = opening.match(/\bOBJETO\s*[:–—-]\s*(.+?)(?=\s+CL[ÁA]USULA\s+\w+\s*[:–—-]|\s+(?:VALOR[^:.;]{0,55}|VIG[ÊE]NCIA|DATA\s+DA\s+ASSINATURA|FUNDAMENTO\s+LEGAL)\s*:|$)/i)?.[1];
  const article = opening.match(/\bArt\.\s*1[º°o]?(?:\s*[.\-–]\s*|\s+)(.+?)(?=\s+(?:Art\.\s*2[º°o]?(?!\d)|§\s*1[º°o]?|Par[áa]grafo\s+[úu]nico)|$)/i)?.[1];
  const rectified = correction && opening.match(/Leia-se:\s*["“]?(.+?)(?=["”]?\s*Ratificam-se|$)/i)?.[1];
  const lead = opening.match(/^Estabelece\s+.+?(?:\.\s|$)/i)?.[0];
  const evidence = item.weeklyEvidence?.evidence || item.classification?.evidenceText || '';
  const description = truncate(rectified || object || article || lead || evidence, 520);
  const values = !correction && opening.match(/\bValor[^:.;]{0,55}:\s*(?:O\s+Valor[^;:]{0,80}?\s+de\s+)?R\$\s*[\d.,]+/gi);
  const context = { title, consortia: [...new Set(consortia)].slice(0, 3), location,
    description, values: (values || []).slice(0, 2) };
  context.labels = context.consortia.map(name => {
    const alias = name.match(/\(([^)]+)\)$/)?.[1];
    return (alias || name.replace(/^cons[oó]rcio\s+intergestores\s+/i, '')).split(' ').map((word, index) => {
      if (alias && index === 0) return word;
      if (/^(?:de|do|da|dos|das|e)$/i.test(word)) return word.toLowerCase();
      return word === word.toUpperCase() ? word[0] + word.slice(1).toLowerCase() : word;
    }).join(' ');
  });
  context.fact = compactFact(item, context, opening, article, object, rectified);
  return context;
}
