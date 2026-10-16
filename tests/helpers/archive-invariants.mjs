import assert from 'node:assert/strict';
// Production catalog:update legitimately attaches an already preserved reading.
// Permit only those verified pointers and observation time; all source/decision
// fields, particularly the sealed snippet, must remain identical to the journal.
export function assertOriginalPreserved(actual, original, stored) {
  assert.ok(actual);
  const mutable=['article_url','article_text_sha256','article_reader','article_recovery_reason','ultima_coleta'];
  for(const key of new Set([...Object.keys(actual),...Object.keys(original)])) {
    if(!mutable.includes(key))assert.deepEqual(actual[key],original[key],key);
  }
  for(const key of mutable) {
    if(actual[key]===original[key])continue;
    if(key==='ultima_coleta'){assert.ok(Date.parse(actual[key])>=Date.parse(original[key]));continue;}
    assert.ok(stored,'Updated recovery metadata requires a stored reading');
    if(key==='article_url'){assert.ok(!original.article_url);assert.equal(actual[key],stored.url_artigo);}
    if(key==='article_text_sha256')assert.equal(actual[key],stored.texto_sha256);
    if(key==='article_reader')assert.equal(actual[key],stored.leitor);
    if(key==='article_recovery_reason')assert.equal(actual[key],'');
  }
}
