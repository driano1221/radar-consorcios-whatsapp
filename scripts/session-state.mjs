import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from 'node:crypto';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as tar from 'tar';

const projectRoot = path.resolve(import.meta.dirname, '..');
const authDir = path.resolve(process.env.AUTH_DIR || path.join(projectRoot, '.local', 'auth'));
const encryptedFile = path.resolve(
  process.env.AUTH_ENCRYPTED_FILE || path.join(projectRoot, 'state', 'auth.enc'),
);
const hashFile = path.resolve(process.env.AUTH_HASH_FILE || path.join(projectRoot, 'state', 'auth.sha256'));
const magic = Buffer.from('RCON1');

function password() {
  const value = process.env.BOT_STATE_PASSWORD;
  if (!value || value.length < 16) {
    throw new Error('BOT_STATE_PASSWORD deve ter pelo menos 16 caracteres.');
  }
  return value;
}

async function listFiles(directory, base = directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(fullPath, base)));
    else if (entry.isFile()) files.push(path.relative(base, fullPath).replaceAll('\\', '/'));
  }
  return files;
}

async function directoryHash(directory) {
  const hash = createHash('sha256');
  for (const relativePath of await listFiles(directory)) {
    hash.update(relativePath);
    hash.update(await readFile(path.join(directory, relativePath)));
  }
  return hash.digest('hex');
}

async function encrypt() {
  const info = await stat(authDir).catch(() => null);
  if (!info?.isDirectory()) throw new Error(`Sessão não encontrada em ${authDir}. Execute npm run pair.`);
  const contentHash = await directoryHash(authDir);
  const previousHash = await readFile(hashFile, 'utf8').catch(() => '');
  const encryptedExists = await stat(encryptedFile).catch(() => null);
  if (previousHash.trim() === contentHash && encryptedExists?.isFile()) {
    console.log('Sessão não mudou; arquivo criptografado preservado.');
    return;
  }

  await mkdir(path.dirname(encryptedFile), { recursive: true });
  const archivePath = path.join(path.dirname(encryptedFile), `.auth-${process.pid}.tar.gz`);
  try {
    await tar.c({ gzip: true, cwd: path.dirname(authDir), file: archivePath }, [path.basename(authDir)]);
    const plaintext = await readFile(archivePath);
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = scryptSync(password(), salt, 32);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    await writeFile(encryptedFile, Buffer.concat([magic, salt, iv, tag, ciphertext]));
    await writeFile(hashFile, `${contentHash}\n`, 'utf8');
    console.log(`Sessão criptografada em ${encryptedFile}.`);
  } finally {
    await rm(archivePath, { force: true });
  }
}

async function decrypt() {
  const payload = await readFile(encryptedFile);
  if (!payload.subarray(0, magic.length).equals(magic)) throw new Error('Formato de sessão inválido.');
  const saltStart = magic.length;
  const salt = payload.subarray(saltStart, saltStart + 16);
  const iv = payload.subarray(saltStart + 16, saltStart + 28);
  const tag = payload.subarray(saltStart + 28, saltStart + 44);
  const ciphertext = payload.subarray(saltStart + 44);
  const key = scryptSync(password(), salt, 32);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  await rm(authDir, { recursive: true, force: true });
  await mkdir(path.dirname(authDir), { recursive: true });
  const archivePath = path.join(path.dirname(authDir), `.auth-${process.pid}.tar.gz`);
  try {
    await writeFile(archivePath, plaintext);
    await tar.x({ cwd: path.dirname(authDir), file: archivePath, strict: true });
    console.log(`Sessão descriptografada em ${authDir}.`);
  } finally {
    await rm(archivePath, { force: true });
  }
}

const command = process.argv[2];
if (command === 'encrypt') await encrypt();
else if (command === 'decrypt') await decrypt();
else throw new Error('Uso: node scripts/session-state.mjs encrypt|decrypt');
