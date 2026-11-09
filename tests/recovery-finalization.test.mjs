import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('recuperação conclui triagem e valida base/painel antes de persistir qualquer leitura', async () => {
  const workflow = await readFile(new URL('../.github/workflows/recuperar-textos.yml', import.meta.url), 'utf8');
  const steps = workflow.split(/(?=^      - name:)/m);
  const index = command => steps.findIndex(step => step.includes(command));
  const conclude = index('npm run catalog:update');
  const validate = steps.findIndex((step, i) => i > conclude && /run: npm test\s*$/m.test(step));
  const safety = steps.findIndex(step => /run: node scripts\/check-recovery-safety\.mjs\s*$/m.test(step));
  const publicCheck = index('node scripts/check-public-dashboard.mjs');
  const persist = index('id: persist');
  assert.ok(conclude >= 0, 'íntegra recuperada precisa chegar à conclusão compartilhada antes do commit');
  assert.ok(conclude > index('node scripts/triage-alternative-texts.mjs --apply'));
  assert.ok(validate > conclude && safety > validate && publicCheck > safety && persist > publicCheck,
    'conclusão → testes posteriores → invariantes → painel válido → persistência');
  assert.ok(steps[publicCheck].includes('npm run dashboard:build:public'));
  assert.doesNotMatch(steps[conclude], /^        if:/m, 'a seleção por ID também precisa concluir a leitura');
  assert.doesNotMatch(steps[validate] + steps[publicCheck], /continue-on-error:/);
});
