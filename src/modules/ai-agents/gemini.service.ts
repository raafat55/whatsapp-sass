import { GoogleGenerativeAI } from '@google/generative-ai';
import type { IMemoryMessage } from '../messages/conversation-memory.model.js';
import type { IProfessionalModeSettings, IResponseVariantSettings, IEmojiReactionSettings } from './ai-agent.model.js';

export type AgentPromptProfile = {
  displayName?: string;
  businessName: string;
  businessDescription: string;
  languagePreference: string;
  toneOfVoice: string;
  extraInstructions?: string;
  // New professional settings
  professionalMode?: IProfessionalModeSettings;
  responseVariants?: IResponseVariantSettings;
  emojiReactions?: IEmojiReactionSettings;
};

function buildSystemPrompt(p: AgentPromptProfile): string {
  const parts = [
    `You represent "${p.businessName}" on WhatsApp.`,
    `Business description: ${p.businessDescription}`,
    `Always respond in the user's preferred language/locale: ${p.languagePreference}.`,
    `Tone of voice: ${p.toneOfVoice}.`,
    'Be concise, clear, and suitable for mobile chat. Do not use markdown unless the user asks.',
  ];

  if (p.displayName?.trim()) {
    parts.unshift(`You are "${p.displayName.trim()}", the assistant for this business.`);
  }

  // Professional mode enhancements
  if (p.professionalMode?.enabled) {
    const formalityInsructions = {
      standard: 'Maintain a professional and friendly tone.',
      formal: 'Use formal language appropriate for corporate or legal communications. Avoid casual expressions.',
      'ultra-formal': 'Use ultra-formal, highly professional language suitable for official correspondence. Be thorough and detailed in all explanations.',
    };
    
    parts.push(formalityInsructions[p.professionalMode.formalityLevel || 'standard']);

    if (p.professionalMode.qualityMode) {
      parts.push('Prioritize response quality and thoroughness. Provide comprehensive answers with relevant details.');
    }

    if (p.professionalMode.disclaimerText?.trim()) {
      parts.push(`Always include this disclaimer at the end of your response: "${p.professionalMode.disclaimerText.trim()}"`);
    }
  }

  // Response variant settings
  if (p.responseVariants?.enabled) {
    if (p.responseVariants.includeSuggestions) {
      parts.push('Always include 1-2 helpful follow-up suggestions or questions at the end of your response.');
    }

    const lengthInstructions = {
      concise: 'Keep responses very brief and to the point (1-2 sentences max).',
      standard: 'Keep responses moderate in length (2-4 sentences typically).',
      detailed: 'Provide detailed, comprehensive responses with full explanations.',
    };
    
    parts.push(lengthInstructions[p.responseVariants.responseLength || 'standard']);

    if (p.responseVariants.includeEmojis) {
      parts.push('Feel free to include relevant emojis to make the response more engaging and visual.');
    }
  }

  if (p.extraInstructions?.trim()) {
    parts.push(`Additional instructions: ${p.extraInstructions.trim()}`);
  }

  return parts.join('\n');
}

export class GeminiService {
  async generateReply(params: {
    apiKey: string;
    modelName: string;
    agent: AgentPromptProfile;
    history: IMemoryMessage[];
    userMessage: string;
  }): Promise<string> {
    const gen = new GoogleGenerativeAI(params.apiKey);
    const model = gen.getGenerativeModel({ model: params.modelName });
    const systemPrompt = buildSystemPrompt(params.agent);
    const historyText = params.history
      .map((m) => `${m.role.toUpperCase()}: ${m.text}`)
      .join('\n');
    const prompt = `${systemPrompt}

Recent conversation:
${historyText}

User message: ${params.userMessage}

Reply as the business assistant (plain text for WhatsApp):`;
    const res = await model.generateContent(prompt);
    const text = res.response.text();
    return text.trim() || '…';
  }

  /**
   * Find appropriate emoji reactions based on message content
   */
  findEmojiReactions(text: string, emojiMap?: Record<string, string>, availableEmojis?: string[]): string[] {
    const reactions: string[] = [];
    const emojis = availableEmojis || ['👍', '❤️', '😂', '😢', '👏'];

    if (!emojiMap || Object.keys(emojiMap).length === 0) {
      // Auto-detect based on common patterns
      const lowerText = text.toLowerCase();
      
      if (lowerText.includes('thank') || lowerText.includes('great') || lowerText.includes('perfect')) {
        reactions.push('👍');
      }
      if (lowerText.includes('love') || lowerText.includes('amazing') || lowerText.includes('awesome')) {
        reactions.push('❤️');
      }
      if (lowerText.includes('laugh') || lowerText.includes('funny') || lowerText.includes('haha')) {
        reactions.push('😂');
      }
      if (lowerText.includes('sorry') || lowerText.includes('sad') || lowerText.includes('issue')) {
        reactions.push('😢');
      }
      if (lowerText.includes('congrats') || lowerText.includes('celebrate') || lowerText.includes('success')) {
        reactions.push('🎉');
      }
    } else {
      // Use custom emoji map
      for (const [keyword, emoji] of Object.entries(emojiMap)) {
        if (text.toLowerCase().includes(keyword.toLowerCase())) {
          if (emojis.includes(emoji)) {
            reactions.push(emoji);
          }
        }
      }
    }

    // Return unique reactions, max 3
    return [...new Set(reactions)].slice(0, 3);
  }
}
