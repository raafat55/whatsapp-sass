import { AiAgentModel, type IAiAgent, type IProfessionalModeSettings, type ITypingIndicatorSettings, type IEmojiReactionSettings, type IResponseVariantSettings, type MemoryRetentionPolicy } from './ai-agent.model.js';
import type { Types } from 'mongoose';
import { AppError } from '../../common/errors.js';

export type UpsertAgentInput = {
  userId: Types.ObjectId;
  sessionId: Types.ObjectId;
  geminiKeyEncrypted?: string;
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
};

export class AiAgentRepository {
  async findBySession(sessionId: Types.ObjectId): Promise<IAiAgent | null> {
    return AiAgentModel.findOne({ sessionId });
  }

  async findBySessionForUser(
    sessionId: Types.ObjectId,
    userId: Types.ObjectId
  ): Promise<IAiAgent | null> {
    return AiAgentModel.findOne({ sessionId, userId });
  }

  async findAllForUser(userId: Types.ObjectId): Promise<IAiAgent[]> {
    return AiAgentModel.find({ userId }).sort({ updatedAt: -1 });
  }

  async upsertForSession(data: UpsertAgentInput): Promise<IAiAgent> {
    const existing = await AiAgentModel.findOne({ sessionId: data.sessionId });
    if (!existing && !data.geminiKeyEncrypted) {
      throw new AppError('GEMINI_KEY_REQUIRED', 'Gemini API key is required when creating an agent', 400);
    }

    const set: Record<string, unknown> = {
      userId: data.userId,
      businessName: data.businessName,
      businessDescription: data.businessDescription,
      languagePreference: data.languagePreference,
      toneOfVoice: data.toneOfVoice,
    };
    if (data.displayName !== undefined) set.displayName = data.displayName;
    if (data.extraInstructions !== undefined) set.extraInstructions = data.extraInstructions;
    if (data.modelName !== undefined) set.modelName = data.modelName;
    if (data.enabled !== undefined) set.enabled = data.enabled;
    if (data.geminiKeyEncrypted) set.geminiKeyEncrypted = data.geminiKeyEncrypted;

    return AiAgentModel.findOneAndUpdate(
      { sessionId: data.sessionId },
      { $set: set },
      { upsert: true, new: true, runValidators: true }
    ).then((d) => d!);
  }

  async patchForSession(
    sessionId: Types.ObjectId,
    userId: Types.ObjectId,
    patch: Partial<
      Pick<
        IAiAgent,
        | 'displayName'
        | 'businessName'
        | 'businessDescription'
        | 'languagePreference'
        | 'toneOfVoice'
        | 'extraInstructions'
        | 'modelName'
        | 'enabled'
        | 'professionalMode'
        | 'typingIndicator'
        | 'emojiReactions'
        | 'responseVariants'
        | 'memoryRetention'
      >
    > & { geminiKeyEncrypted?: string }
  ): Promise<IAiAgent | null> {
    return AiAgentModel.findOneAndUpdate(
      { sessionId, userId },
      { $set: patch },
      { new: true, runValidators: true }
    );
  }

  async deleteBySessionForUser(sessionId: Types.ObjectId, userId: Types.ObjectId): Promise<boolean> {
    const r = await AiAgentModel.deleteOne({ sessionId, userId });
    return r.deletedCount > 0;
  }
}
