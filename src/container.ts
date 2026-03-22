import { Types } from 'mongoose';
import { getConfig, type AppConfig } from './config/env.js';
import { logger } from './common/logger.js';
import { UserRepository } from './modules/users/user.repository.js';
import { SessionRepository } from './modules/sessions/session.repository.js';
import { ContactRepository } from './modules/contacts/contact.repository.js';
import { ConversationMemoryRepository } from './modules/messages/conversation-memory.repository.js';
import { AiAgentRepository } from './modules/ai-agents/ai-agent.repository.js';
import { AuthService } from './modules/auth/auth.service.js';
import { WhatsAppSessionManager } from './modules/sessions/whatsapp-session.manager.js';
import { SessionsService } from './modules/sessions/sessions.service.js';
import { ContactsService } from './modules/contacts/contacts.service.js';
import { MessagesService } from './modules/messages/messages.service.js';
import { AiAgentsService } from './modules/ai-agents/ai-agents.service.js';
import { GeminiService } from './modules/ai-agents/gemini.service.js';
import { AiReplyQueueService } from './queues/ai-reply-queue.service.js';

export type AppContainer = {
  config: AppConfig;
  logger: typeof logger;
  userRepo: UserRepository;
  sessionRepo: SessionRepository;
  contactRepo: ContactRepository;
  memoryRepo: ConversationMemoryRepository;
  agentRepo: AiAgentRepository;
  authService: AuthService;
  wa: WhatsAppSessionManager;
  aiReplyQueue: AiReplyQueueService;
  sessionsService: SessionsService;
  contactsService: ContactsService;
  messagesService: MessagesService;
  aiAgentsService: AiAgentsService;
  geminiService: GeminiService;
};

export function createContainer(): AppContainer {
  const config = getConfig();
  const userRepo = new UserRepository();
  const sessionRepo = new SessionRepository();
  const contactRepo = new ContactRepository();
  const memoryRepo = new ConversationMemoryRepository();
  const agentRepo = new AiAgentRepository();
  const authService = new AuthService(userRepo);
  const messagesService = new MessagesService(memoryRepo);
  const geminiService = new GeminiService();

  const waSlot: { current?: WhatsAppSessionManager } = {};

  const aiReplyQueue = new AiReplyQueueService({
    sessionRepo,
    agentRepo,
    memoryRepo,
    messagesService,
    geminiService,
    getWa: () => waSlot.current!,
  });

  const wa = new WhatsAppSessionManager(sessionRepo, {
    onContactsBatch: async (ctx, rows) => {
      await contactRepo.upsertMany(
        new Types.ObjectId(ctx.userId),
        new Types.ObjectId(ctx.sessionMongoId),
        rows
      );
    },
    onInboundChatMessage: async (ctx) => {
      const session = await sessionRepo.findByPublicId(ctx.sessionPublicId);
      if (!session) return;
      await messagesService.appendUserMessage(
        new Types.ObjectId(ctx.userId),
        session._id,
        ctx.remoteJid,
        ctx.text
      );
      const agent = await agentRepo.findBySession(session._id);
      if (!agent?.enabled) return;
      aiReplyQueue.enqueue({
        sessionPublicId: ctx.sessionPublicId,
        userId: ctx.userId,
        remoteJid: ctx.remoteJid,
        text: ctx.text,
      });
    },
  });
  waSlot.current = wa;

  const sessionsService = new SessionsService(sessionRepo, wa);
  const contactsService = new ContactsService(contactRepo, sessionRepo, wa);
  const aiAgentsService = new AiAgentsService(agentRepo, sessionRepo);

  return {
    config,
    logger,
    userRepo,
    sessionRepo,
    contactRepo,
    memoryRepo,
    agentRepo,
    authService,
    wa,
    aiReplyQueue,
    sessionsService,
    contactsService,
    messagesService,
    aiAgentsService,
    geminiService,
  };
}
