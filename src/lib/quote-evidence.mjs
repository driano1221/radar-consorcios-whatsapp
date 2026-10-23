// Return the exact source spelling, allowing only typography differences.
// Never concatenate separate fields to make a quote that doesn't exist.
function indexed(value) {
  const text = String(value || ''), offsets = [];
  const units=[];let offset = 0,lastSpace=true;
  for (const character of text) {
    const letters = character.normalize('NFKC').toLowerCase();
    for (const letter of letters) {
      const unit = /[\p{P}\p{S}\s]/u.test(letter) ? ' ' : letter;
      if (unit === ' ' && lastSpace) continue;
      units.push(unit);lastSpace=unit===' ';
      offsets.push({ start: offset, end: offset + character.length });
    }
    offset += character.length;
  }
  return { text, normalized: units.join('').trimEnd(), offsets };
}

export function locateQuote(quote, sources) {
  const needle = indexed(quote).normalized.trim();
  if (needle.length < 12 || needle.split(' ').length < 3) return '';
  for (const source of sources) {
    // Most document proofs already have exact spelling. Avoid indexing a whole
    // budget annex when its short operative clause is present verbatim.
    const raw=String(source||''),exact=raw.indexOf(String(quote));
    if(exact>=0 && (!exact||!/[\p{L}\p{N}]/u.test(raw[exact-1])) &&
        !/[\p{L}\p{N}]/u.test(raw[exact+String(quote).length]||''))return String(quote);
    const haystack = indexed(source);
    const at = haystack.normalized.indexOf(needle);
    if (at < 0) continue;
    // Don't match a word fragment as evidence.
    if (at && /[\p{L}\p{N}]/u.test(haystack.normalized[at - 1]) ||
        /[\p{L}\p{N}]/u.test(haystack.normalized[at + needle.length] || '')) continue;
    return haystack.text.slice(haystack.offsets[at].start, haystack.offsets[at + needle.length - 1].end);
  }
  return '';
}
