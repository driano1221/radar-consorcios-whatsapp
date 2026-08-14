import { randomBytes } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';

const projectRoot = path.resolve(import.meta.dirname, '..');
const localDir = path.join(projectRoot, '.local');
const passwordFile = path.join(localDir, 'bot-state-password.txt');

async function getOrCreatePassword() {
  const exists = await stat(passwordFile).catch(() => null);
  if (exists?.isFile()) return (await readFile(passwordFile, 'utf8')).trim();
  const value = randomBytes(32).toString('base64url');
  await mkdir(localDir, { recursive: true });
  await writeFile(passwordFile, `${value}\n`, { encoding: 'utf8', mode: 0o600 });
  return value;
}

function runEncryption(password) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(import.meta.dirname, 'session-state.mjs'), 'encrypt'], {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, BOT_STATE_PASSWORD: password },
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Criptografia terminou com código ${code}.`)),
    );
  });
}

const password = await getOrCreatePassword();
await runEncryption(password);
console.log(`Senha local salva em ${passwordFile}`);
console.log('Copie seu conteúdo para o secret BOT_STATE_PASSWORD no GitHub.');
