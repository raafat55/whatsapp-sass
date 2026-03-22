import type { Types } from 'mongoose';
import { AppError } from '../../common/errors.js';
import { ContactRepository } from './contact.repository.js';
import type { WhatsAppSessionManager } from '../sessions/whatsapp-session.manager.js';
import type { SessionRepository } from '../sessions/session.repository.js';

export class ContactsService {
  constructor(
    private readonly repo: ContactRepository,
    private readonly sessions: SessionRepository,
    private readonly wa: WhatsAppSessionManager
  ) {}

  async syncForSession(userId: Types.ObjectId, sessionPublicId: string): Promise<{ upserted: number }> {
    const session = await this.sessions.findByPublicIdForUser(sessionPublicId, userId);
    if (!session) throw new AppError('SESSION_NOT_FOUND', 'Session not found', 404);
    if (!this.wa.isConnected(sessionPublicId)) {
      throw new AppError('SESSION_OFFLINE', 'WhatsApp session is not connected', 409);
    }
    const rows = this.wa.getContactSnapshot(sessionPublicId);
    if (!rows.length) {
      return { upserted: 0 };
    }
    const n = await this.repo.upsertMany(userId, session._id, rows);
    return { upserted: n };
  }

  async list(
    userId: Types.ObjectId,
    sessionPublicId: string,
    q: { search?: string; limit: number; page: number }
  ) {
    const session = await this.sessions.findByPublicIdForUser(sessionPublicId, userId);
    if (!session) throw new AppError('SESSION_NOT_FOUND', 'Session not found', 404);
    return this.repo.list(session._id, q);
  }

  async deleteContact(userId: Types.ObjectId, contactId: string): Promise<void> {
    const ok = await this.repo.deleteById(contactId, userId);
    if (!ok) throw new AppError('CONTACT_NOT_FOUND', 'Contact not found', 404);
  }
}
