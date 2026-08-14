import { mkdir } from 'node:fs/promises';
import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
} from '@whiskeysockets/baileys';
import pino from 'pino';

const logger = pino({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' });

// libsignal logs complete session objects directly through console.info/warn,
// including ephemeral private keys. Filter only those known messages so they
// never reach local or GitHub Actions logs.
const signalLogFilter = Symbol.for('radar-consorcios.signal-log-filter');
if (!globalThis[signalLogFilter]) {
  const suppressedPrefixes = ['Closing session:', 'Closing open session in favor of'];
  for (const method of ['info', 'warn']) {
    const original = console[method];
    console[method] = (...args) => {
      const first = args[0];
      if (typeof first === 'string' && suppressedPrefixes.some((prefix) => first.startsWith(prefix))) {
        return;
      }
      original.apply(console, args);
    };
  }
  globalThis[signalLogFilter] = true;
}

async function connectOnce({ authDir, onQr, timeoutMs }) {
  await mkdir(authDir, { recursive: true });
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const { version } = await fetchLatestBaileysVersion();
  const socket = makeWASocket({
    version,
    auth: state,
    logger,
    printQRInTerminal: false,
    syncFullHistory: false,
    markOnlineOnConnect: false,
    generateHighQualityLinkPreview: false,
    browser: ['Radar de Consórcios', 'Chrome', '1.0.0'],
  });
  socket.ev.on('creds.update', saveCreds);

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Tempo esgotado ao conectar ao WhatsApp.')), timeoutMs);
    socket.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
      if (qr && onQr) await onQr(qr);
      if (connection === 'open') {
        clearTimeout(timer);
        resolve();
      }
      if (connection === 'close') {
        clearTimeout(timer);
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;
        const error = new Error(
          loggedOut
            ? 'A sessão do WhatsApp foi desconectada. Faça o pareamento novamente.'
            : `Conexão do WhatsApp encerrada antes de abrir (código ${statusCode || 'desconhecido'}).`,
        );
        error.statusCode = statusCode;
        reject(error);
      }
    });
  });

  return socket;
}

export async function connectWhatsApp({ authDir, onQr, timeoutMs = 70_000 }) {
  const transientCodes = new Set([
    DisconnectReason.connectionClosed,
    DisconnectReason.connectionLost,
    DisconnectReason.restartRequired,
    DisconnectReason.timedOut,
    DisconnectReason.unavailableService,
  ]);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await connectOnce({ authDir, onQr, timeoutMs });
    } catch (error) {
      if (!transientCodes.has(error.statusCode) || attempt === 3) throw error;
      console.log(`WhatsApp indisponível temporariamente; reconexão ${attempt}/3...`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw new Error('Não foi possível conectar ao WhatsApp após três tentativas.');
}

export function validateGroupId(groupId) {
  if (!/^\d+(?:-\d+)?@g\.us$/.test(groupId)) {
    throw new Error('WHATSAPP_GROUP_ID inválido. Execute npm run pair para listar os grupos.');
  }
}

export async function sendMessages({ authDir, groupId, messages, delayMs = 5000, onSent }) {
  validateGroupId(groupId);
  const socket = await connectWhatsApp({ authDir });
  const sent = [];
  try {
    for (const message of messages) {
      await socket.sendMessage(groupId, { text: message.text });
      sent.push(message);
      if (onSent) await onSent(message);
      if (delayMs > 0 && sent.length < messages.length) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  } finally {
    socket.end(new Error('Execução do radar concluída.'));
  }
  return sent;
}
