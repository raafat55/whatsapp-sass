import type { Types } from 'mongoose';
import { ConversationMemoryRepository } from './conversation-memory.repository.js';
import type { IMemoryMessage } from './conversation-memory.model.js';

export class MessagesService {
  constructor(private readonly repo: ConversationMemoryRepository) {}

  async appendUserMessage(
    userId: Types.ObjectId,
    sessionId: Types.ObjectId,
    remoteJid: string,
    text: string
  ): Promise<void> {
    const msg: IMemoryMessage = { role: 'user', text, at: new Date(), remoteJid };
    await this.repo.append(userId, sessionId, remoteJid, msg);
  }

  async appendAssistantMessage(
    userId: Types.ObjectId,
    sessionId: Types.ObjectId,
    remoteJid: string,
    text: string
  ): Promise<void> {
    const msg: IMemoryMessage = { role: 'assistant', text, at: new Date(), remoteJid };
    await this.repo.append(userId, sessionId, remoteJid, msg);
  }

  async getContext(sessionId: Types.ObjectId, remoteJid: string, limit: number) {
    return this.repo.getRecent(sessionId, remoteJid, limit);
  }
}
