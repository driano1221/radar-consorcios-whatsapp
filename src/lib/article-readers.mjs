import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { normalizeWhitespace } from './text.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const script = path.join(root, 'scripts', 'trafilatura-stdin.py');
const localPython = path.join(root, '.local', 'trafilatura-venv', 'Scripts', 'python.exe');

export function readWithReadability(html, url) {
  const dom = new JSDOM(html, { url }); // Scripts e recursos remotos permanecem desativados.
  try {
    return normalizeWhitespace(new Readability(dom.window.document).parse()?.textContent || '');
  } finally {
    dom.window.close();
  }
}

export function readWithTrafilatura(html, { python = process.env.TRAFILATURA_PYTHON ||
  (existsSync(localPython) ? localPython : 'python'), timeoutMs = 20000 } = {}) {
  return new Promise((resolve, reject) => {
    const process = spawn(python, [script], { cwd: root, windowsHide: true,
      env: { ...globalThis.process.env, PYTHONIOENCODING: 'utf-8' }, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(normalizeWhitespace(value));
    };
    const timer = setTimeout(() => {
      process.kill();
      finish(new Error('Trafilatura excedeu o tempo limite'));
    }, timeoutMs);
    process.stdout.setEncoding('utf8');
    process.stderr.setEncoding('utf8');
    process.stdout.on('data', (chunk) => {
      stdout += chunk;
      if (stdout.length > 2_000_000) process.kill();
    });
    process.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-1000); });
    process.on('error', (error) => finish(error));
    process.on('close', (code) => finish(code === 0 ? null : new Error(stderr.trim() || `Trafilatura saiu com código ${code}`), stdout));
    process.stdin.on('error', () => {});
    process.stdin.end(html);
  });
}
