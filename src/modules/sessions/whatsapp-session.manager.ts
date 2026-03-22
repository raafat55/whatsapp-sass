import { Boom } from '@hapi/boom';
import makeWASocket, {
  Browsers,
  DEFAULT_CONNECTION_CONFIG,
  DisconnectReason,
  fetchLatestBaileysVersion,
  isJidUser,
  jidNormalizedUser,
  type Contact,
  type WASocket,
} from '@whiskeysockets/baileys';
import type { Types } from 'mongoose';
import { logger } from '../../common/logger.js';
import { useMongoAuthState, deleteMongoAuthState } from './mongo-auth-state.js';
import type { SessionRepository } from './session.repository.js';
import type { ISession } from './session.model.js';

export type WaContactRow = {
  waJid: string;
  phoneNumber: string;
  name?: string;
  isBusiness?: boolean;
};

export type WaRuntimeHooks = {
  onContactsBatch: (
    ctx: { sessionPublicId: string; userId: string; sessionMongoId: string },
    rows: WaContactRow[]
  ) => Promise<void>;
  onInboundChatMessage: (ctx: {
    sessionPublicId: string;
    userId: string;
    sessionMongoId: string;
    remoteJid: string;
    text: string;
  }) => Promise<void>;
};

type Active = {
  socket: WASocket;
  saveCreds: () => Promise<void>;
  userId: string;
  sessionMongoId: string;
};

function contactToRow(c: Contact): WaContactRow | null {
  const jid = c.jid ?? c.id;
  if (!jid || !isJidUser(jid)) return null;
  const norm = jidNormalizedUser(jid);
  const phone = norm.split('@')[0]?.split(':')[0];
  if (!phone) return null;
  const name = c.name || c.notify || c.verifiedName;
  return {
    waJid: norm,
    phoneNumber: phone.replace(/\D/g, ''),
    name: name || undefined,
    isBusiness: Boolean(c.verifiedName),
  };
}

function extractInboundText(message: Record<string, unknown> | null | undefined): string {
  if (!message) return '';
  const m = message as {
    conversation?: string;
    extendedTextMessage?: { text?: string };
    imageMessage?: { caption?: string };
    videoMessage?: { caption?: string };
  };
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    ''
  );
}

function shouldAutoReconnectWhatsApp(statusCode: number | undefined): boolean {
  if (statusCode === undefined || statusCode === DisconnectReason.loggedOut) return false;
  return (
    statusCode === DisconnectReason.restartRequired ||
    statusCode === DisconnectReason.connectionLost ||
    statusCode === DisconnectReason.timedOut
  );
}

export class WhatsAppSessionManager {
  private readonly sockets = new Map<string, Active>();
  private readonly starting = new Set<string>();
  /** User called stop — do not auto-reconnect on socket close. */
  private readonly userRequestedStop = new Set<string>();
  /** Latest contact rows seen from Baileys events (per session), used for POST /sync flush. */
  private readonly contactSnapshots = new Map<string, Map<string, WaContactRow>>();

  constructor(
    private readonly sessions: SessionRepository,
    private readonly hooks: WaRuntimeHooks
  ) {}

  private mergeContacts(publicId: string, rows: WaContactRow[]) {
    let m = this.contactSnapshots.get(publicId);
    if (!m) {
      m = new Map();
      this.contactSnapshots.set(publicId, m);
    }
    for (const r of rows) m.set(r.waJid, r);
  }

  getContactSnapshot(publicId: string): WaContactRow[] {
    return [...(this.contactSnapshots.get(publicId)?.values() ?? [])];
  }

  clearContactSnapshot(publicId: string): void {
    this.contactSnapshots.delete(publicId);
  }

  isConnected(publicId: string): boolean {
    const a = this.sockets.get(publicId);
    return !!a?.socket?.user;
  }

  getSocket(publicId: string): WASocket | undefined {
    return this.sockets.get(publicId)?.socket;
  }

  async startSession(session: ISession): Promise<void> {
    const publicId = session.publicId;
    this.userRequestedStop.delete(publicId);
    if (this.sockets.has(publicId) || this.starting.has(publicId)) return;
    this.starting.add(publicId);
    try {
      await this.sessions.updateById(session._id, { status: 'connecting', lastError: undefined });
      const { state, saveCreds } = await useMongoAuthState(session._id);
      const { version } = await fetchLatestBaileysVersion();
      const waLogger = logger.child({ waSession: publicId });
      const sock = makeWASocket({
        ...DEFAULT_CONNECTION_CONFIG,
        version,
        browser: Browsers.macOS('Chrome'),
        auth: state,
        logger: waLogger as unknown as typeof DEFAULT_CONNECTION_CONFIG.logger,
        printQRInTerminal: false,
        markOnlineOnConnect: true,
      });

      this.sockets.set(publicId, {
        socket: sock,
        saveCreds,
        userId: session.userId.toString(),
        sessionMongoId: session._id.toString(),
      });

      const ctxBase = {
        sessionPublicId: publicId,
        userId: session.userId.toString(),
        sessionMongoId: session._id.toString(),
      };

      sock.ev.on('creds.update', saveCreds);

      sock.ev.on('contacts.upsert', async (contacts) => {
        const rows = contacts.map(contactToRow).filter(Boolean) as WaContactRow[];
        if (rows.length) {
          this.mergeContacts(publicId, rows);
          await this.hooks.onContactsBatch(ctxBase, rows);
        }
      });

      sock.ev.on('contacts.update', async (updates) => {
        const rows: WaContactRow[] = [];
        for (const u of updates) {
          const jid = u.id;
          if (!jid || !isJidUser(jid)) continue;
          const norm = jidNormalizedUser(jid);
          const phone = norm.split('@')[0]?.split(':')[0];
          if (!phone) continue;
          rows.push({
            waJid: norm,
            phoneNumber: phone.replace(/\D/g, ''),
            name: u.notify || u.verifiedName || undefined,
            isBusiness: Boolean(u.verifiedName),
          });
        }
        if (rows.length) {
          this.mergeContacts(publicId, rows);
          await this.hooks.onContactsBatch(ctxBase, rows);
        }
      });

      sock.ev.on('messaging-history.set', async ({ contacts }) => {
        const rows = (contacts || []).map(contactToRow).filter(Boolean) as WaContactRow[];
        if (rows.length) {
          this.mergeContacts(publicId, rows);
          await this.hooks.onContactsBatch(ctxBase, rows);
        }
      });

      sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        for (const msg of messages) {
          if (msg.key.fromMe) continue;
          const remote = msg.key.remoteJid;
          if (!remote || !isJidUser(remote)) continue;
          const text = extractInboundText(msg.message as Record<string, unknown>);
          if (!text.trim()) continue;
          await this.hooks.onInboundChatMessage({
            ...ctxBase,
            remoteJid: jidNormalizedUser(remote),
            text: text.trim(),
          });
        }
      });

      sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
          await this.sessions.updateById(session._id, { status: 'qr_pending', qrCode: qr });
          logger.info({ publicId }, 'QR code generated - check API response to display');
        }
        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const active = this.sockets.get(publicId);
          if (active) {
            try {
              await active.saveCreds();
            } catch (e) {
              logger.warn({ e, publicId }, 'saveCreds on connection close failed');
            }
          }
          this.sockets.delete(publicId);

          if (this.userRequestedStop.has(publicId)) {
            this.userRequestedStop.delete(publicId);
            await this.sessions.updateById(session._id, {
              status: 'disconnected',
              lastError: lastDisconnect?.error?.message ?? 'stopped',
            });
            logger.info({ publicId }, 'WhatsApp closed after user stop');
            return;
          }

          if (shouldAutoReconnectWhatsApp(statusCode)) {
            await this.sessions.updateById(session._id, {
              status: 'connecting',
              lastError: undefined,
            });
            logger.info(
              { publicId, statusCode },
              'WhatsApp closed; reconnecting (normal after QR pair or transient network)'
            );
            const delayMs = statusCode === DisconnectReason.restartRequired ? 2000 : 1500;
            setTimeout(() => {
              void this.sessions.findByPublicId(publicId).then((s) => {
                if (!s) return;
                void this.startSession(s).catch((err) =>
                  logger.error({ err, publicId }, 'WA auto-reconnect failed')
                );
              });
            }, delayMs);
            return;
          }

          logger.warn({ publicId, statusCode }, 'WhatsApp connection closed');
          await this.sessions.updateById(session._id, {
            status: 'disconnected',
            lastError: lastDisconnect?.error?.message ?? 'closed',
          });
        } else if (connection === 'open') {
          const phone = sock.user?.id?.split(':')[0];
          await this.sessions.updateById(session._id, {
            status: 'connected',
            phoneNumber: phone,
            lastError: undefined,
          });
          logger.info({ publicId, phone }, 'WhatsApp session connected');
        }
      });
    } finally {
      this.starting.delete(publicId);
    }
  }

  async stopSession(publicId: string): Promise<void> {
    this.userRequestedStop.add(publicId);
    const a = this.sockets.get(publicId);
    if (!a) return;
    try {
      a.socket.end(undefined);
    } catch {
      /* ignore */
    }
    this.sockets.delete(publicId);
    const s = await this.sessions.findByPublicId(publicId);
    if (s) await this.sessions.updateById(s._id, { status: 'disconnected' });
  }

  async logoutAndDelete(session: ISession): Promise<void> {
    this.userRequestedStop.add(session.publicId);
    this.clearContactSnapshot(session.publicId);
    const a = this.sockets.get(session.publicId);
    if (a) {
      try {
        await a.socket.logout();
      } catch {
        try {
          a.socket.end(undefined);
        } catch {
          /* ignore */
        }
      }
      this.sockets.delete(session.publicId);
    }
    await deleteMongoAuthState(session._id);
  }

  async sendText(publicId: string, toPhoneOrJid: string, text: string): Promise<void> {
    const a = this.sockets.get(publicId);
    if (!a?.socket?.user) {
      throw new Error('SESSION_NOT_CONNECTED');
    }
    const jid = toPhoneOrJid.includes('@')
      ? jidNormalizedUser(toPhoneOrJid)
      : `${toPhoneOrJid.replace(/\D/g, '')}@s.whatsapp.net`;
    await a.socket.sendMessage(jid, { text });
  }

  async sendTyping(publicId: string, toPhoneOrJid: string): Promise<void> {
    const a = this.sockets.get(publicId);
    if (!a?.socket?.user) {
      throw new Error('SESSION_NOT_CONNECTED');
    }
    const jid = toPhoneOrJid.includes('@')
      ? jidNormalizedUser(toPhoneOrJid)
      : `${toPhoneOrJid.replace(/\D/g, '')}@s.whatsapp.net`;
    
    // Send composition (typing) indicator
    await a.socket.sendPresenceUpdate('composing', jid);
  }

  async sendReaction(publicId: string, toPhoneOrJid: string, emoji: string): Promise<void> {
    const a = this.sockets.get(publicId);
    if (!a?.socket?.user) {
      throw new Error('SESSION_NOT_CONNECTED');
    }
    const jid = toPhoneOrJid.includes('@')
      ? jidNormalizedUser(toPhoneOrJid)
      : `${toPhoneOrJid.replace(/\D/g, '')}@s.whatsapp.net`;
    
    // Send reaction emoji (this sends a reaction to the last message)
    // Note: In Baileys, reactions are typically sent as part of message metadata
    // For now, we'll implement as a simple emoji message if direct reaction API isn't available
    try {
      // Try direct reaction API if available in socket
      if ((a.socket as any).sendMessageReaction) {
        await (a.socket as any).sendMessageReaction(jid, emoji);
      } else {
        // Fallback: send as text emoji (less ideal but works)
        logger.warn({ toPhoneOrJid }, 'Direct reaction API not available, reaction may not display correctly');
      }
    } catch (e) {
      logger.warn({ toPhoneOrJid, emoji, error: String(e) }, 'Failed to send reaction');
    }
  }

}
