import { loadConfig } from '../src/config.mjs';
import { connectWhatsApp, validateGroupId } from '../src/lib/whatsapp.mjs';
import { jidNormalizedUser } from '@whiskeysockets/baileys';

const config = await loadConfig();
validateGroupId(config.groupId);
const socket = await connectWhatsApp({ authDir: config.authDir });
try {
  const group = await socket.groupMetadata(config.groupId);
  const myJid = jidNormalizedUser(socket.user?.id || '');
  const myParticipant = group.participants.find(
    (participant) => jidNormalizedUser(participant.id) === myJid,
  );
  console.log(`Sessão válida. Grupo encontrado: ${group.subject}`);
  console.log(`Participantes: ${group.participants.length}`);
  console.log(`Somente administradores podem enviar: ${group.announce ? 'sim' : 'não'}`);
  if (group.announce) {
    console.log(`Seu número é administrador: ${myParticipant?.admin ? 'sim' : 'não identificado'}`);
  }
} finally {
  socket.end(new Error('Verificação concluída.'));
  setTimeout(() => process.exit(0), 500);
}
