import type { Types } from 'mongoose';
import { ConversationMemoryRepository } from './conversation-memory.repository.js';
import type { MemoryRetentionPolicy } from '../ai-agents/ai-agent.model.js';

export class MemoryRetentionService {
  constructor(private readonly repo: ConversationMemoryRepository) {}

  /**
   * Clean up old messages based on retention policy
   * @param sessionId Session ID
   * @param remoteJid Remote JID (contact)
   * @param policy Retention policy: '5min', '10min', or 'always'
   */
  async cleanupByPolicy(sessionId: Types.ObjectId, remoteJid: string, policy: MemoryRetentionPolicy): Promise<void> {
    if (policy === 'always') return; // Never clean up

    const retentionMs = policy === '5min' ? 5 * 60 * 1000 : 10 * 60 * 1000;
    const cutoffTime = new Date(Date.now() - retentionMs);

    // Remove messages older than the cutoff time from this conversation
    await this.repo.removeMessagesOlderThan(sessionId, remoteJid, cutoffTime);
  }

  /**
   * Get memory size info for monitoring
   */
  async getMemorySize(sessionId: Types.ObjectId, remoteJid: string): Promise<number> {
    return this.repo.getMessageCount(sessionId, remoteJid);
  }

  /**
   * Clear all memory for a conversation (useful for manual reset)
   */
  async clearConversation(sessionId: Types.ObjectId, remoteJid: string): Promise<void> {
    await this.repo.clearMessages(sessionId, remoteJid);
  }

  /**
   * Get memory stats for monitoring/debugging
   */
  async getMemoryStats(sessionId: Types.ObjectId, remoteJid: string) {
    const memory = await this.repo.getRecent(sessionId, remoteJid, 1000);
    const messages = memory || [];
    
    return {
      totalMessages: messages.length,
      oldestMessage: messages.length > 0 ? messages[0].at : null,
      newestMessage: messages.length > 0 ? messages[messages.length - 1].at : null,
      userMessages: messages.filter(m => m.role === 'user').length,
      assistantMessages: messages.filter(m => m.role === 'assistant').length,
    };
  }
}
