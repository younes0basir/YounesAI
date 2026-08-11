const { logAgentCall } = require('./metricsLogger');
const { prefixWithSourceCheck } = require('./context');
const tools = require('../tools');

class ImageAgent {
  constructor() {
    this.systemPrompt = `You are an image generation agent. Extract the image generation request from the user's message and return JSON.

Rules:
- If the user wants to generate, create, draw, or make an image ("generate an image of ...", "draw ...", "create an image ..."), ALWAYS set action to "generate".
- Extract the prompt as the descriptive text after "image of", "draw", "generate", or "create".
- Default dimensions: width 768, height 1344.
- Default steps: 4.
- Default seed: 1.

Return ONLY valid JSON:
{
  "action": "generate" | "chat",
  "prompt": "the extracted image description",
  "width": 768,
  "height": 1344,
  "steps": 4,
  "seed": 1,
  "response": "brief text if chat action"
}

Examples:
- "generate an image of a wolf in evernight" → { "action": "generate", "prompt": "a wolf in evernight" }
- "draw a futuristic city" → { "action": "generate", "prompt": "a futuristic city" }
- "hello" → { "action": "chat", "response": "Hi! I can generate images for you. Just describe what you want." }`;
  }

  async run(context) {
    const start = Date.now();
    try {
      const lower = (context.message || '').toLowerCase();
      let action = 'chat';
      let prompt = '';
      let width = 768;
      let height = 1344;
      let steps = 4;
      let seed = 1;

      const imageTriggers = [
        /generate an image of\s*(.+)/i,
        /create an image of\s*(.+)/i,
        /draw an image of\s*(.+)/i,
        /make an image of\s*(.+)/i,
        /image of\s*(.+)/i,
        /draw\s*(.+)/i,
        /generate\s*(an?\s*)?image\s*(of\s*)?(.+)/i,
      ];

      for (const regex of imageTriggers) {
        const match = context.message.match(regex);
        if (match) {
          action = 'generate';
          prompt = (match[match.length - 1] || '').trim().replace(/[.!?]$/, '');
          break;
        }
      }

      if (context.parameters?.prompt) {
        action = 'generate';
        prompt = context.parameters.prompt;
      }
      if (context.parameters?.width) width = Number(context.parameters.width);
      if (context.parameters?.height) height = Number(context.parameters.height);
      if (context.parameters?.steps) steps = Number(context.parameters.steps);
      if (context.parameters?.seed) seed = Number(context.parameters.seed);

      if (action === 'generate' && prompt) {
        const result = await tools.generateImage(context, { prompt, width, height, steps, seed });
        await logAgentCall({ agentName: 'image', latency: Date.now() - start, success: true, context });

        if (result.image) {
          return {
            success: true,
            content: prefixWithSourceCheck(`Image generated: "${prompt}" (${width}×${height}, ${steps} steps).`, context, ['image generation service']),
            metadata: { agent: 'image', width, height, steps, seed },
            image: result.image,
          };
        }

        return {
          success: false,
          error: 'Image generation completed but no image was returned.',
          metadata: { agent: 'image' },
        };
      }

      await logAgentCall({ agentName: 'image', latency: Date.now() - start, success: true, context });
      return {
        success: true,
        content: prefixWithSourceCheck('I can generate images for you. Try "generate an image of a futuristic city".', context, ['image agent reasoning']),
        metadata: { agent: 'image' },
      };
    } catch (error) {
      await logAgentCall({ agentName: 'image', latency: Date.now() - start, success: false, error: error.message, context });
      return { success: false, error: error.message };
    }
  }
}

module.exports = new ImageAgent();
