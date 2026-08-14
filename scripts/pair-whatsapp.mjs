import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import QRCode from 'qrcode';
import { loadConfig } from '../src/config.mjs';
import { connectWhatsApp } from '../src/lib/whatsapp.mjs';

async function main() {
  const config = await loadConfig();
  const qrPath = path.join(config.projectRoot, '.local', 'whatsapp-qr.png');
  await mkdir(path.dirname(qrPath), { recursive: true });
  let qrShown = false;

  console.log('Abra WhatsApp > Dispositivos conectados > Conectar dispositivo.');
  const socket = await connectWhatsApp({
    authDir: config.authDir,
    timeoutMs: 180_000,
    onQr: async (qr) => {
      await QRCode.toFile(qrPath, qr, { width: 420, margin: 2 });
      const terminalQr = await QRCode.toString(qr, { type: 'terminal', small: true });
      if (!qrShown) console.log(`QR salvo em: ${qrPath}`);
      console.log(terminalQr);
      qrShown = true;
    },
  });

  console.log('WhatsApp conectado. Buscando grupos...');
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const groups = Object.values(await socket.groupFetchAllParticipating()).sort((a, b) =>
    a.subject.localeCompare(b.subject, 'pt-BR'),
  );
  const rows = groups.map((group) => ({ nome: group.subject, id: group.id }));
  console.table(rows);
  await writeFile(
    path.join(config.projectRoot, '.local', 'groups.json'),
    `${JSON.stringify(rows, null, 2)}\n`,
    'utf8',
  );
  console.log('Lista salva em .local/groups.json. Copie o ID do grupo desejado.');
  socket.end(new Error('Pareamento concluído.'));
  setTimeout(() => process.exit(0), 500);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
