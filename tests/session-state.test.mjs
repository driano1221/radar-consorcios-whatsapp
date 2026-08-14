import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

function runNode(args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { env: { ...process.env, ...env } });
    let stderr = '';
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(stderr))));
  });
}

test('criptografa e restaura a sessão', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'radar-session-'));
  const authDir = path.join(temp, 'auth');
  const encryptedFile = path.join(temp, 'auth.enc');
  const hashFile = path.join(temp, 'auth.sha256');
  const script = path.resolve('scripts/session-state.mjs');
  const env = {
    AUTH_DIR: authDir,
    AUTH_ENCRYPTED_FILE: encryptedFile,
    AUTH_HASH_FILE: hashFile,
    BOT_STATE_PASSWORD: 'senha-de-teste-com-mais-de-16-caracteres',
  };
  try {
    await mkdir(authDir, { recursive: true });
    await writeFile(path.join(authDir, 'creds.json'), '{"ok":true}', 'utf8');
    await runNode([script, 'encrypt'], env);
    await rm(authDir, { recursive: true, force: true });
    await runNode([script, 'decrypt'], env);
    assert.equal(await readFile(path.join(authDir, 'creds.json'), 'utf8'), '{"ok":true}');
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
