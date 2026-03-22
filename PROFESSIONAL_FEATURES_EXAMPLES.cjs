#!/usr/bin/env node
/**
 * Quick API examples for using the new professional features
 * 
 * Prerequisites:
 * - Set BASE_URL and TOKEN environment variables
 * - Agent must be created first
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const TOKEN = process.env.TOKEN || '';
const SESSION_ID = process.env.SESSION_ID || '';

const examples = {
  // Example 1: Create agent with professional mode enabled
  createProfessionalAgent: {
    method: 'PUT',
    path: `/api/sessions/${SESSION_ID}/ai-agent`,
    body: {
      geminiApiKey: 'YOUR_GEMINI_KEY',
      displayName: 'Legal Assistant',
      businessName: 'LawCorp LLC',
      businessDescription: 'Professional legal services and consultation',
      languagePreference: 'en',
      toneOfVoice: 'professional',
      extraInstructions: 'Always cite relevant laws and statutes. Never provide personal legal advice.',
      
      professionalMode: {
        enabled: true,
        formalityLevel: 'ultra-formal',
        qualityMode: true,
        disclaimerText: 'This is legal information only and does not constitute legal advice. Please consult with a qualified attorney.'
      },
      
      typingIndicator: {
        enabled: true,
        typingDurationMs: 1500,
        minWordCount: 10
      },
      
      responseVariants: {
        enabled: true,
        includeSuggestions: true,
        responseLength: 'detailed',
        includeEmojis: false
      },
      
      memoryRetention: 'always'
    }
  },

  // Example 2: Create fast-moving support bot
  createFastSupportBot: {
    method: 'PUT',
    path: `/api/sessions/${SESSION_ID}/ai-agent`,
    body: {
      geminiApiKey: 'YOUR_GEMINI_KEY',
      displayName: 'Quick Support',
      businessName: 'FastCorp',
      businessDescription: 'Rapid response technical support',
      languagePreference: 'en',
      toneOfVoice: 'friendly',
      
      typingIndicator: {
        enabled: false
      },
      
      responseVariants: {
        enabled: true,
        responseLength: 'concise',
        includeSuggestions: false
      },
      
      memoryRetention: '5min'
    }
  },

  // Example 3: Create engagement-focused bot with emojis
  createEngagementBot: {
    method: 'PUT',
    path: `/api/sessions/${SESSION_ID}/ai-agent`,
    body: {
      geminiApiKey: 'YOUR_GEMINI_KEY',
      displayName: 'Fun Bot',
      businessName: 'FunCorp',
      businessDescription: 'Entertainment and engagement platform',
      languagePreference: 'en',
      toneOfVoice: 'casual',
      
      emojiReactions: {
        enabled: true,
        autoReactToMessages: true,
        customEmojiMap: {
          'love': '❤️',
          'awesome': '🎉',
          'help': '🆘',
          'question': '❓',
          'idea': '💡'
        }
      },
      
      responseVariants: {
        enabled: true,
        includeEmojis: true,
        includeSuggestions: true,
        responseLength: 'standard'
      },
      
      memoryRetention: '10min'
    }
  },

  // Example 4: Enable only typing indicator
  enableTypingIndicator: {
    method: 'PATCH',
    path: `/api/sessions/${SESSION_ID}/ai-agent`,
    body: {
      typingIndicator: {
        enabled: true,
        typingDurationMs: 1000,
        minWordCount: 5
      }
    }
  },

  // Example 5: Switch to concise mode for faster responses
  switchToConciseMode: {
    method: 'PATCH',
    path: `/api/sessions/${SESSION_ID}/ai-agent`,
    body: {
      responseVariants: {
        responseLength: 'concise'
      },
      memoryRetention: '5min'
    }
  },

  // Example 6: Enable professional mode with quality
  enableProfessionalMode: {
    method: 'PATCH',
    path: `/api/sessions/${SESSION_ID}/ai-agent`,
    body: {
      professionalMode: {
        enabled: true,
        formalityLevel: 'formal',
        qualityMode: true,
        disclaimerText: 'This is automated support for common questions.'
      }
    }
  },

  // Example 7: Setup emoji reactions with custom mapping
  setupEmojiReactions: {
    method: 'PATCH',
    path: `/api/sessions/${SESSION_ID}/ai-agent`,
    body: {
      emojiReactions: {
        enabled: true,
        autoReactToMessages: true,
        customEmojiMap: {
          'thank': '👍',
          'great': '👍',
          'love': '❤️',
          'amazing': '❤️',
          'bug': '🐛',
          'issue': '⚠️',
          'help': '🆘',
          'urgent': '⚠️',
          'congrats': '🎉',
          'success': '✅'
        },
        supportedEmojis: ['👍', '❤️', '😂', '😢', '👏', '🎉', '💯', '🚀', '✅', '⚠️', '🐛', '🆘']
      }
    }
  },

  // Example 8: Get agent with all features
  getAgent: {
    method: 'GET',
    path: `/api/sessions/${SESSION_ID}/ai-agent`,
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  },

  // Example 9: Clear conversation memory for a contact
  clearMemory: {
    method: 'POST',
    path: `/api/sessions/${SESSION_ID}/memory/clear/201011508719@s.whatsapp.net`,
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  },

  // Example 10: Get memory statistics
  getMemoryStats: {
    method: 'GET',
    path: `/api/sessions/${SESSION_ID}/memory/stats/201011508719@s.whatsapp.net`,
    headers: {
      'Authorization': `Bearer ${TOKEN}`
    }
  }
};

console.log('WhatsApp AI Agent Professional Features - API Examples');
console.log('='.repeat(60));

Object.entries(examples).forEach(([name, example]) => {
  console.log(`\n${name}:`);
  console.log('-'.repeat(40));
  
  if (example.method) console.log(`Method: ${example.method}`);
  console.log(`Path: ${example.path}`);
  
  if (example.headers) {
    console.log('Headers:');
    Object.entries(example.headers).forEach(([k, v]) => {
      console.log(`  ${k}: ${v}`);
    });
  }
  
  if (example.body) {
    console.log('Body:');
    console.log(JSON.stringify(example.body, null, 2));
  }
});

console.log('\n' + '='.repeat(60));
console.log('Usage:');
console.log('  export BASE_URL=http://localhost:3000');
console.log('  export TOKEN=your_jwt_token');
console.log('  export SESSION_ID=your_session_id');
console.log('  node examples.cjs');
