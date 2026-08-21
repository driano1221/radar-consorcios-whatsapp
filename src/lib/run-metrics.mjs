function sourceName(item) {
  return item.source || item.scraper || 'Origem não identificada';
}

function ensureSource(sources, name) {
  if (!sources[name]) {
    sources[name] = {
      collected: 0,
      classified: 0,
      rejected: 0,
      belowMinimum: 0,
      relevant: 0,
      previewOnly: 0,
      publishable: 0,
      unseen: 0,
      selected: 0,
      discardReasons: {},
    };
  }
  return sources[name];
}

function addDiscardReasons(bucket, reasons = []) {
  for (const reason of reasons.filter((value) => value.startsWith('rejeitado:'))) {
    bucket.discardReasons[reason] = (bucket.discardReasons[reason] || 0) + 1;
  }
}

function incrementItems(sources, items, field) {
  for (const item of items) ensureSource(sources, sourceName(item))[field] += 1;
}

export function buildSourceFunnel({
  collected = [],
  classified = [],
  relevant = [],
  publishable = [],
  unseen = [],
  selected = [],
  minimumScore = 5,
}) {
  const sources = {};
  incrementItems(sources, collected, 'collected');
  for (const item of classified) {
    const bucket = ensureSource(sources, sourceName(item));
    bucket.classified += 1;
    if (item.classification.category === 'GERAL') {
      bucket.rejected += 1;
      addDiscardReasons(bucket, item.classification.reasons);
    } else if (item.classification.score < minimumScore) {
      bucket.belowMinimum += 1;
    }
  }
  incrementItems(sources, relevant, 'relevant');
  incrementItems(sources, publishable, 'publishable');
  incrementItems(sources, relevant.filter((item) => item.previewOnly), 'previewOnly');
  incrementItems(sources, unseen, 'unseen');
  incrementItems(sources, selected, 'selected');

  return {
    generatedAt: new Date().toISOString(),
    minimumScore,
    sources,
  };
}

export function formatSourceFunnel(funnel) {
  const rows = Object.entries(funnel.sources)
    .sort(([left], [right]) => left.localeCompare(right, 'pt-BR'))
    .map(([name, values]) =>
      `| ${name} | ${values.collected} | ${values.rejected} | ${values.belowMinimum} | ${values.relevant} | ${values.previewOnly} | ${values.publishable} | ${values.unseen} | ${values.selected} |`,
    );
  const reasons = Object.entries(funnel.sources)
    .flatMap(([name, values]) =>
      Object.entries(values.discardReasons).map(([reason, count]) => `- ${name}: ${reason} (${count})`),
    );
  return [
    '## Funil de qualidade por fonte',
    '',
    `Limiar de publicação: ${funnel.minimumScore} pontos.`,
    '',
    '| Fonte | Coletados | Rejeitados | Abaixo do limiar | Relevantes | Prévia | Publicáveis | Novos | Selecionados |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...(rows.length ? rows : ['| Nenhuma fonte | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |']),
    '',
    '### Motivos de descarte',
    '',
    ...(reasons.length ? reasons : ['- Nenhum descarte contextual nesta execução.']),
    '',
  ].join('\n');
}
