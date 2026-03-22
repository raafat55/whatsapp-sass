import mongoose, { Schema, Document, Types } from 'mongoose';

/** Memory retention policy for conversations */
export type MemoryRetentionPolicy = '5min' | '10min' | 'always';

/** Professional mode settings for ultra-professional responses */
export interface IProfessionalModeSettings {
  enabled: boolean;
  formalityLevel: 'standard' | 'formal' | 'ultra-formal'; // standard, formal (legal/corporate), ultra-formal
  qualityMode: boolean; // Enhanced response quality with thoroughness
  disclaimerText?: string; // Optional disclaimer to append to responses
}

/** Typing indicator settings */
export interface ITypingIndicatorSettings {
  enabled: boolean;
  typingDurationMs: number; // How long to show "typing..." (100-3000ms)
  minWordCount: number; // Only show typing for responses with more words
}

/** Emoji and reaction settings */
export interface IEmojiReactionSettings {
  enabled: boolean;
  autoReactToMessages: boolean; // React to incoming messages
  customEmojiMap?: Record<string, string>; // Map keywords/patterns to emojis
  supportedEmojis: string[]; // List of emojis the agent can use
}

/** Response variants and flexibility */
export interface IResponseVariantSettings {
  enabled: boolean;
  includeSuggestions: boolean; // Include follow-up suggestions
  responseLength: 'concise' | 'standard' | 'detailed'; // Response length preference
  includeEmojis: boolean; // Include emojis in text responses
}

/** One AI agent per WhatsApp session (unique sessionId). */
export interface IAiAgent extends Document {
  userId: Types.ObjectId;
  sessionId: Types.ObjectId;
  geminiKeyEncrypted: string;
  /** Optional label in the UI (e.g. "Sales bot"). */
  displayName?: string;
  businessName: string;
  businessDescription: string;
  languagePreference: string;
  toneOfVoice: string;
  /** Extra instructions appended to the built system prompt. */
  extraInstructions?: string;
  enabled: boolean;
  modelName: string;
  
  // New professional features
  professionalMode: IProfessionalModeSettings;
  typingIndicator: ITypingIndicatorSettings;
  emojiReactions: IEmojiReactionSettings;
  responseVariants: IResponseVariantSettings;
  memoryRetention: MemoryRetentionPolicy;
  
  createdAt: Date;
  updatedAt: Date;
}

const AiAgentSchema = new Schema<IAiAgent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true, unique: true },
    geminiKeyEncrypted: { type: String, required: true },
    displayName: { type: String, maxlength: 120 },
    businessName: { type: String, default: 'Business', maxlength: 500 },
    businessDescription: { type: String, default: '', maxlength: 8000 },
    languagePreference: { type: String, default: 'en', maxlength: 32 },
    toneOfVoice: { type: String, default: 'professional', maxlength: 80 },
    extraInstructions: { type: String, maxlength: 4000 },
    enabled: { type: Boolean, default: true },
    modelName: { type: String, default: 'gemini-1.5-flash' },
    
    // Professional mode settings
    professionalMode: {
      type: {
        enabled: { type: Boolean, default: false },
        formalityLevel: { type: String, enum: ['standard', 'formal', 'ultra-formal'], default: 'standard' },
        qualityMode: { type: Boolean, default: false },
        disclaimerText: { type: String, maxlength: 500 },
      },
      default: { enabled: false, formalityLevel: 'standard', qualityMode: false },
    },
    
    // Typing indicator settings
    typingIndicator: {
      type: {
        enabled: { type: Boolean, default: true },
        typingDurationMs: { type: Number, default: 1000, min: 100, max: 3000 },
        minWordCount: { type: Number, default: 5, min: 1, max: 100 },
      },
      default: { enabled: true, typingDurationMs: 1000, minWordCount: 5 },
    },
    
    // Emoji and reaction settings
    emojiReactions: {
      type: {
        enabled: { type: Boolean, default: false },
        autoReactToMessages: { type: Boolean, default: false },
        customEmojiMap: { type: Schema.Types.Mixed, default: {} },
        supportedEmojis: { type: [String], default: ['👍', '❤️', '😂', '😢', '😡', '👏', '🎉', '💯'] },
      },
      default: {
        enabled: false,
        autoReactToMessages: false,
        customEmojiMap: {},
        supportedEmojis: ['👍', '❤️', '😂', '😢', '😡', '👏', '🎉', '💯'],
      },
    },
    
    // Response variant settings
    responseVariants: {
      type: {
        enabled: { type: Boolean, default: true },
        includeSuggestions: { type: Boolean, default: false },
        responseLength: { type: String, enum: ['concise', 'standard', 'detailed'], default: 'standard' },
        includeEmojis: { type: Boolean, default: false },
      },
      default: { enabled: true, includeSuggestions: false, responseLength: 'standard', includeEmojis: false },
    },
    
    // Memory retention policy
    memoryRetention: { type: String, enum: ['5min', '10min', 'always'], default: 'always' },
  },
  { timestamps: true }
);

AiAgentSchema.index({ userId: 1, updatedAt: -1 });

export const AiAgentModel = mongoose.model<IAiAgent>('AiAgent', AiAgentSchema);
