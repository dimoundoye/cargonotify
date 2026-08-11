const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');
const pino = require('pino');

const SESSIONS_BASE_DIR = path.join(__dirname, '../../whatsapp_sessions');

// Collection multi-session : companyId => sessionState
const sessions = new Map();

function getSessionState(companyId = 1) {
  const cid = String(companyId || 1);
  if (!sessions.has(cid)) {
    sessions.set(cid, {
      sock: null,
      qrCodeDataUrl: null,
      isConnected: false,
      connectedPhone: null,
      statusText: 'Déconnecté',
      isInitializing: false
    });
  }
  return sessions.get(cid);
}

function getCompanySessionDir(companyId = 1) {
  const cid = String(companyId || 1);
  const dir = path.join(SESSIONS_BASE_DIR, `company_${cid}`);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Formatage international automatique (préserve +33, +221, +86, +1, etc., et ajoute +221 si omis)
function formatInternationalPhone(phone) {
  if (!phone) return '';
  let clean = String(phone).replace(/\D/g, '');
  if (clean.length === 9 && (clean.startsWith('77') || clean.startsWith('78') || clean.startsWith('76') || clean.startsWith('70') || clean.startsWith('75') || clean.startsWith('33'))) {
    clean = `221${clean}`;
  }
  return clean;
}

async function initWhatsApp(companyId = 1) {
  const cid = companyId || 1;
  const session = getSessionState(cid);

  if (session.sock && session.isConnected) {
    return { isConnected: session.isConnected, connectedPhone: session.connectedPhone, statusText: session.statusText };
  }
  if (session.isInitializing) {
    return { isConnected: session.isConnected, qrCodeDataUrl: session.qrCodeDataUrl, statusText: 'Initialisation...' };
  }

  session.isInitializing = true;
  session.statusText = 'Génération du QR Code...';

  try {
    const sessionDir = getCompanySessionDir(cid);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    session.sock = makeWASocket({
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: [`CargoNotify Company ${cid}`, 'Chrome', '1.0.0']
    });

    session.sock.ev.on('creds.update', saveCreds);

    session.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          session.qrCodeDataUrl = await QRCode.toDataURL(qr);
          session.statusText = 'QR Code prêt. Scannez avec WhatsApp.';
          console.log(`📱 Nouveau QR Code WhatsApp généré pour l'entreprise ID ${cid} !`);
        } catch (err) {
          console.error(`Erreur génération QRCode (Entreprise ${cid}):`, err);
        }
      }

      if (connection === 'open') {
        session.isConnected = true;
        session.qrCodeDataUrl = null;
        session.statusText = 'Connecté';
        const userJid = session.sock.user ? session.sock.user.id : '';
        const rawPhone = userJid.split(':')[0] || userJid.split('@')[0] || '';
        session.connectedPhone = rawPhone ? `+${rawPhone}` : 'Connecté';
        console.log(`✅ WhatsApp connecté pour l'Entreprise ID ${cid} sur le numéro: ${session.connectedPhone}`);
        session.isInitializing = false;
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 401;

        session.isConnected = false;
        session.connectedPhone = null;
        session.qrCodeDataUrl = null;
        session.isInitializing = false;

        console.log(`🔌 Connexion WhatsApp fermée pour l'Entreprise ID ${cid} (Code: ${statusCode}). Reconnexion: ${shouldReconnect}`);

        if (shouldReconnect) {
          session.statusText = 'Reconnexion en cours...';
          setTimeout(() => initWhatsApp(cid).catch(() => {}), 5000);
        } else {
          session.statusText = 'Déconnecté (Session expirée). Scannez à nouveau.';
          clearSession(cid);
        }
      }
    });

    return { isConnected: session.isConnected, qrCodeDataUrl: session.qrCodeDataUrl, statusText: session.statusText };
  } catch (err) {
    console.error(`Erreur initWhatsApp (Entreprise ${cid}):`, err.message);
    session.isInitializing = false;
    session.statusText = 'Erreur de connexion';
    return { isConnected: false, error: err.message };
  }
}

function clearSession(companyId = 1) {
  try {
    const cid = companyId || 1;
    const sessionDir = path.join(SESSIONS_BASE_DIR, `company_${cid}`);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true, maxRetries: 3 });
    }
  } catch (e) {
    console.error(`Erreur nettoyage session WhatsApp (Entreprise ${companyId}):`, e.message);
  }
}

async function getStatus(companyId = 1) {
  const cid = companyId || 1;
  const session = getSessionState(cid);
  if (!session.sock && !session.isInitializing) {
    await initWhatsApp(cid).catch(() => {});
  }
  return {
    companyId: cid,
    isConnected: session.isConnected,
    qrCodeDataUrl: session.qrCodeDataUrl,
    connectedPhone: session.connectedPhone,
    statusText: session.statusText
  };
}

async function sendTextMessage(companyId = 1, toPhone, messageText) {
  const cid = companyId || 1;
  const session = getSessionState(cid);
  if (!session.sock || !session.isConnected) {
    throw new Error(`WhatsApp n'est pas connecté pour cette entreprise. Veuillez d'abord scanner le QR Code.`);
  }

  const cleanPhone = formatInternationalPhone(toPhone);
  const jid = `${cleanPhone}@s.whatsapp.net`;

  try {
    const sent = await session.sock.sendMessage(jid, { text: messageText });
    console.log(`💬 Message WhatsApp (Entreprise ${cid}) envoyé avec succès à +${cleanPhone}`);
    return { success: true, messageId: sent.key.id, jid };
  } catch (err) {
    console.error(`Erreur envoi message WhatsApp (Entreprise ${cid}) à ${toPhone}:`, err);
    throw err;
  }
}

async function disconnect(companyId = 1) {
  const cid = companyId || 1;
  const session = getSessionState(cid);
  try {
    if (session.sock) {
      await session.sock.logout();
      session.sock = null;
    }
  } catch (e) {
    console.error(`Erreur logout WhatsApp (Entreprise ${cid}):`, e);
  } finally {
    session.isConnected = false;
    session.connectedPhone = null;
    session.qrCodeDataUrl = null;
    session.statusText = 'Déconnecté';
    clearSession(cid);
  }
  return { message: 'Session WhatsApp déconnectée.' };
}

// Initialiser l'entreprise par défaut au démarrage
setTimeout(() => {
  initWhatsApp(1).catch(() => {});
}, 2000);

module.exports = {
  initWhatsApp,
  getStatus,
  formatInternationalPhone,
  sendTextMessage,
  disconnect
};
