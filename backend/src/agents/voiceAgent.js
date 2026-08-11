const fs = require('fs');
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

class VoiceAgent {
  async transcribe(filePath, options = {}) {
    try {
      if (!process.env.GROQ_API_KEY) {
        return { success: false, error: 'GROQ_API_KEY is not set in environment. Voice transcription requires a Groq API key.' };
      }
      const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: options.model || 'whisper-large-v3-turbo',
        temperature: options.temperature ?? 0,
        response_format: options.response_format || 'verbose_json',
        language: options.language,
        prompt: options.prompt,
      });

      return {
        success: true,
        text: transcription.text,
        duration: transcription.duration,
        segments: transcription.segments,
        language: transcription.language,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async process(userMessage, parameters = {}) {
    return {
      success: true,
      content: `Voice input processed. You said: "${userMessage}"`,
      metadata: { agent: 'voice' },
    };
  }
}

module.exports = new VoiceAgent();
