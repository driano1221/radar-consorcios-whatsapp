// Exercise the production collectors, without running radar/AI/WhatsApp/persistence.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setDefaultResultOrder } from 'node:dns';
import { fetchWebScrapers } from '../src/lib/sources/web-scrapers.mjs';
import { readKnownPublicUrls } from '../src/lib/sources/public-routes.mjs';
import { classifyItem } from '../src/lib/classifier.mjs';
import { decidePublication, isNotifiable } from '../src/lib/publication-gate.mjs';
setDefaultResultOrder('ipv4first');
const config = JSON.parse(await readFile('config/default.json', 'utf8'));
const sites = config.webScrapers.sites.filter(s => ['semana7-rss', 'guanhaes-portaltp'].includes(s.adapter));
assert.equal(sites.length, 2);
const known = await readKnownPublicUrls('data/catalogo/arquivo-coletas.ndjson');
const since = new Date(Date.now() - config.lookbackHours * 3600000);
for (let pass = 1; pass <= 2; pass++) {
  const result = await fetchWebScrapers({ ...config.webScrapers, sites, knownPublicUrls: known }, since);
  assert.equal(result.ok, true, JSON.stringify(result.diagnostics));
  assert.equal(result.degraded, false, JSON.stringify(result.diagnostics));
  for (const item of result.items) {
    const gated = decidePublication({ ...item, classification: classifyItem(item) }, { sourceActivations: sites });
    assert.equal(isNotifiable(gated), false);
    assert.equal(known.has(item.url), false, 'Documento repetido entre passagens');
    known.add(item.url);
  }
  // New items arriving between passes are allowed; previously seen URLs are not.
  console.log(JSON.stringify({ validationPass: pass, newDocuments: result.items.length,
    notifiable: 0, diagnostics: result.diagnostics }));
}
