import type { Types } from 'mongoose';
import { AppError } from '../../common/errors.js';
import { encryptSecret } from '../../common/crypto.js';
import { AiAgentRepository } from './ai-agent.repository.js';
import type { SessionRepository } from '../sessions/session.repository.js';
import type { IAiAgent, IProfessionalModeSettings, ITypingIndicatorSettings, IEmojiReactionSettings, IResponseVariantSettings, MemoryRetentionPolicy } from './ai-agent.model.js';

export type AiAgentPublicDto = {
  agentId: string;
  sessionPublicId: string;
  sessionLabel?: string;
  displayName?: string;
  businessName: string;
  businessDescription: string;
  languagePreference: string;
  toneOfVoice: string;
  extraInstructions?: string;
  modelName: string;
  enabled: boolean;
  hasGeminiKey: boolean;
  updatedAt?: Date;
  professionalMode: IProfessionalModeSettings;
  typingIndicator: ITypingIndicatorSettings;
  emojiReactions: IEmojiReactionSettings;
  responseVariants: IResponseVariantSettings;
  memoryRetention: MemoryRetentionPolicy;
};

export class AiAgentsService {
  constructor(
    private readonly repo: AiAgentRepository,
    private readonly sessions: SessionRepository
  ) {}

  private mapPublic(agent: IAiAgent, sessionPublicId: string, sessionLabel?: string): AiAgentPublicDto {
    return {
      agentId: agent._id.toString(),
      sessionPublicId,
      sessionLabel,
      displayName: agent.displayName,
      businessName: agent.businessName,
      businessDescription: agent.businessDescription,
      languagePreference: agent.languagePreference,
      toneOfVoice: agent.toneOfVoice,
      extraInstructions: agent.extraInstructions,
      modelName: agent.modelName,
      enabled: agent.enabled,
      hasGeminiKey: Boolean(agent.geminiKeyEncrypted?.length),
      updatedAt: agent.updatedAt,
      professionalMode: agent.professionalMode,
      typingIndicator: agent.typingIndicator,
      emojiReactions: agent.emojiReactions,
      responseVariants: agent.responseVariants,
      memoryRetention: agent.memoryRetention,
    };
  }

  async listForUser(userId: Types.ObjectId): Promise<AiAgentPublicDto[]> {
    const agents = await this.repo.findAllForUser(userId);
    const out: AiAgentPublicDto[] = [];
    for (const a of agents) {
      const session = await this.sessions.findByIdForUser(a.sessionId, userId);
      if (!session) continue;
      out.push(this.mapPublic(a, session.publicId, session.label));
    }
    return out;
  }

  async getForSession(userId: Types.ObjectId, sessionPublicId: string): Promise<AiAgentPublicDto> {
    const session = await this.sessions.findByPublicIdForUser(sessionPublicId, userId);
    if (!session) throw new AppError('SESSION_NOT_FOUND', 'Session not found', 404);
    const agent = await this.repo.findBySessionForUser(session._id, userId);
    if (!agent) throw new AppError('AGENT_NOT_FOUND', 'No AI agent configured for this session', 404);
    return this.mapPublic(agent, sessionPublicId, session.label);
  }

  async upsertForSession(
    userId: Types.ObjectId,
    sessionPublicId: string,
    body: {
      geminiApiKey?: string;
      displayName?: string;
      businessName: string;
      businessDescription: string;
      languagePreference: string;
      toneOfVoice: string;
      extraInstructions?: string;
      modelName?: string;
      enabled?: boolean;
      professionalMode?: IProfessionalModeSettings;
      typingIndicator?: ITypingIndicatorSettings;
      emojiReactions?: IEmojiReactionSettings;
      responseVariants?: IResponseVariantSettings;
      memoryRetention?: MemoryRetentionPolicy;
    }
  ): Promise<AiAgentPublicDto> {
    const session = await this.sessions.findByPublicIdForUser(sessionPublicId, userId);
    if (!session) throw new AppError('SESSION_NOT_FOUND', 'Session not found', 404);

    const existing = await this.repo.findBySessionForUser(session._id, userId);
    if (!existing && !body.geminiApiKey?.trim()) {
      throw new AppError('GEMINI_KEY_REQUIRED', 'geminiApiKey is required when creating an agent', 400);
    }

    const geminiKeyEncrypted =
      body.geminiApiKey && body.geminiApiKey.trim().length > 0
        ? encryptSecret(body.geminiApiKey.trim())
        : undefined;

    const agent = await this.repo.upsertForSession({
      userId,
      sessionId: session._id,
      geminiKeyEncrypted,
      displayName: body.displayName,
      businessName: body.businessName,
      businessDescription: body.businessDescription,
      languagePreference: body.languagePreference,
      toneOfVoice: body.toneOfVoice,
      extraInstructions: body.extraInstructions,
      modelName: body.modelName,
      enabled: body.enabled,
      professionalMode: body.professionalMode,
      typingIndicator: body.typingIndicator,
      emojiReactions: body.emojiReactions,
      responseVariants: body.responseVariants,
      memoryRetention: body.memoryRetention,
    });

    return this.mapPublic(agent, sessionPublicId, session.label);
  }

  async patchForSession(
    userId: Types.ObjectId,
    sessionPublicId: string,
    patch: {
      geminiApiKey?: string;
      displayName?: string;
      businessName?: string;
      businessDescription?: string;
      languagePreference?: string;
      toneOfVoice?: string;
      extraInstructions?: string;
      modelName?: string;
      enabled?: boolean;
      professionalMode?: Partial<IProfessionalModeSettings>;
      typingIndicator?: Partial<ITypingIndicatorSettings>;
      emojiReactions?: Partial<IEmojiReactionSettings>;
      responseVariants?: Partial<IResponseVariantSettings>;
      memoryRetention?: MemoryRetentionPolicy;
    }
  ): Promise<AiAgentPublicDto> {
    const session = await this.sessions.findByPublicIdForUser(sessionPublicId, userId);
    if (!session) throw new AppError('SESSION_NOT_FOUND', 'Session not found', 404);

    const existing = await this.repo.findBySessionForUser(session._id, userId);
    if (!existing) {
      throw new AppError('AGENT_NOT_FOUND', 'No AI agent configured for this session', 404);
    }

    const mongoPatch: Parameters<AiAgentRepository['patchForSession']>[2] = {};
    if (patch.displayName !== undefined) mongoPatch.displayName = patch.displayName;
    if (patch.businessName !== undefined) mongoPatch.businessName = patch.businessName;
    if (patch.businessDescription !== undefined) mongoPatch.businessDescription = patch.businessDescription;
    if (patch.languagePreference !== undefined) mongoPatch.languagePreference = patch.languagePreference;
    if (patch.toneOfVoice !== undefined) mongoPatch.toneOfVoice = patch.toneOfVoice;
    if (patch.extraInstructions !== undefined) mongoPatch.extraInstructions = patch.extraInstructions;
    if (patch.modelName !== undefined) mongoPatch.modelName = patch.modelName;
    if (patch.enabled !== undefined) mongoPatch.enabled = patch.enabled;
    if (patch.geminiApiKey !== undefined && patch.geminiApiKey.trim().length > 0) {
      mongoPatch.geminiKeyEncrypted = encryptSecret(patch.geminiApiKey.trim());
    }
    if (patch.professionalMode !== undefined) {
      mongoPatch.professionalMode = { ...existing.professionalMode, ...patch.professionalMode };
    }
    if (patch.typingIndicator !== undefined) {
      mongoPatch.typingIndicator = { ...existing.typingIndicator, ...patch.typingIndicator };
    }
    if (patch.emojiReactions !== undefined) {
      mongoPatch.emojiReactions = { ...existing.emojiReactions, ...patch.emojiReactions };
    }
    if (patch.responseVariants !== undefined) {
      mongoPatch.responseVariants = { ...existing.responseVariants, ...patch.responseVariants };
    }
    if (patch.memoryRetention !== undefined) mongoPatch.memoryRetention = patch.memoryRetention;

    const updated = await this.repo.patchForSession(session._id, userId, mongoPatch);
    if (!updated) throw new AppError('AGENT_NOT_FOUND', 'No AI agent configured for this session', 404);
    return this.mapPublic(updated, sessionPublicId, session.label);
  }

  async deleteForSession(userId: Types.ObjectId, sessionPublicId: string): Promise<void> {
    const session = await this.sessions.findByPublicIdForUser(sessionPublicId, userId);
    if (!session) throw new AppError('SESSION_NOT_FOUND', 'Session not found', 404);
    const ok = await this.repo.deleteBySessionForUser(session._id, userId);
    if (!ok) throw new AppError('AGENT_NOT_FOUND', 'No AI agent configured for this session', 404);
  }
}
