import PQueue from 'p-queue';
import { Types } from 'mongoose';
import { getConfig } from '../config/env.js';
import { logger } from '../common/logger.js';
import { decryptSecret } from '../common/crypto.js';
import type { SessionRepository } from '../modules/sessions/session.repository.js';
import type { AiAgentRepository } from '../modules/ai-agents/ai-agent.repository.js';
import type { ConversationMemoryRepository } from '../modules/messages/conversation-memory.repository.js';
import type { MessagesService } from '../modules/messages/messages.service.js';
import type { GeminiService } from '../modules/ai-agents/gemini.service.js';
import type { WhatsAppSessionManager } from '../modules/sessions/whatsapp-session.manager.js';
import { MemoryRetentionService } from '../modules/messages/memory-retention.service.js';
import { allowSend, aiRateKey, maxAiPerMinute } from '../infra/rate-limit.js';

export type AiJobData = {
  sessionPublicId: string;
  userId: string;
  remoteJid: string;
  text: string;
};

export class AiReplyQueueService {
  private readonly q = new PQueue({ concurrency: 6 });
  private readonly memoryRetention: MemoryRetentionService;

  constructor(
    private readonly deps: {
      sessionRepo: SessionRepository;
      agentRepo: AiAgentRepository;
      memoryRepo: ConversationMemoryRepository;
      messagesService: MessagesService;
      geminiService: GeminiService;
      getWa: () => WhatsAppSessionManager;
    }
  ) {
    this.memoryRetention = new MemoryRetentionService(deps.memoryRepo);
  }

  enqueue(data: AiJobData): void {
    void this.q.add(() => this.process(data));
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((r) => setTimeout(r, ms));
  }

  private async sendTypingIndicator(
    wa: WhatsAppSessionManager,
    sessionPublicId: string,
    remoteJid: string,
    durationMs: number
  ): Promise<void> {
    try {
      // Show typing indicator
      await wa.sendTyping(sessionPublicId, remoteJid);
      // Wait for the specified duration
      await this.sleep(durationMs);
    } catch (e) {
      logger.warn({ sessionPublicId, remoteJid, error: String(e) }, 'Failed to send typing indicator');
    }
  }

  private async sendEmojiReaction(
    wa: WhatsAppSessionManager,
    sessionPublicId: string,
    remoteJid: string,
    emojis: string[]
  ): Promise<void> {
    for (const emoji of emojis) {
      try {
        await wa.sendReaction(sessionPublicId, remoteJid, emoji);
        await this.sleep(200); // Small delay between reactions
      } catch (e) {
        logger.warn({ sessionPublicId, remoteJid, emoji, error: String(e) }, 'Failed to send emoji reaction');
      }
    }
  }

  private async process(data: AiJobData): Promise<void> {
    const { sessionPublicId, userId, remoteJid, text } = data;
    const session = await this.deps.sessionRepo.findByPublicIdForUser(
      sessionPublicId,
      new Types.ObjectId(userId)
    );
    if (!session) return;
    
    const agent = await this.deps.agentRepo.findBySessionForUser(
      session._id,
      new Types.ObjectId(userId)
    );
    if (!agent?.enabled) return;

    while (!allowSend(aiRateKey(session._id.toString()), maxAiPerMinute())) {
      await this.sleep(1000);
    }

    const wa = this.deps.getWa();
    if (!wa.isConnected(sessionPublicId)) {
      logger.warn({ sessionPublicId }, 'AI reply skipped: session offline');
      return;
    }

    try {
      // Clean up old messages based on retention policy BEFORE generating response
      await this.memoryRetention.cleanupByPolicy(session._id, remoteJid, agent.memoryRetention);

      const apiKey = decryptSecret(agent.geminiKeyEncrypted);
      const limit = getConfig().AI_MEMORY_MAX_MESSAGES;
      const history = await this.deps.memoryRepo.getRecent(session._id, remoteJid, limit);

      // Send emoji reactions if enabled
      if (agent.emojiReactions?.enabled && agent.emojiReactions.autoReactToMessages) {
        const reactions = this.deps.geminiService.findEmojiReactions(
          text,
          agent.emojiReactions.customEmojiMap,
          agent.emojiReactions.supportedEmojis
        );
        if (reactions.length > 0) {
          await this.sendEmojiReaction(wa, sessionPublicId, remoteJid, reactions);
        }
      }

      // Send typing indicator if enabled and response will be long enough
      if (agent.typingIndicator?.enabled) {
        // We'll estimate - send typing for most responses
        const estimatedWordCount = Math.ceil(text.split(/\s+/).length * 2); // Rough estimate
        if (estimatedWordCount >= (agent.typingIndicator.minWordCount || 5)) {
          this.sendTypingIndicator(wa, sessionPublicId, remoteJid, agent.typingIndicator.typingDurationMs).catch(
            (e) => logger.warn({ error: String(e) }, 'Typing indicator failed')
          );
        }
      }

      const reply = await this.deps.geminiService.generateReply({
        apiKey,
        modelName: agent.modelName,
        agent: {
          displayName: agent.displayName,
          businessName: agent.businessName,
          businessDescription: agent.businessDescription,
          languagePreference: agent.languagePreference,
          toneOfVoice: agent.toneOfVoice,
          extraInstructions: agent.extraInstructions,
          professionalMode: agent.professionalMode,
          responseVariants: agent.responseVariants,
          emojiReactions: agent.emojiReactions,
        },
        history,
        userMessage: text,
      });

      await this.deps.messagesService.appendAssistantMessage(
        new Types.ObjectId(userId),
        session._id,
        remoteJid,
        reply
      );

      await wa.sendText(sessionPublicId, remoteJid, reply);
      logger.info({ sessionPublicId, remoteJid }, 'AI reply sent');
    } catch (e) {
      logger.error({ sessionPublicId, remoteJid, error: String(e) }, 'Error processing AI reply');
    }
  }
}
