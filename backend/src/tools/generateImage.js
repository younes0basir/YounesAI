const { generateImage } = require('../services/imageGenerator');

async function generateImageTool(context, options = {}) {
  const result = await generateImage({
    prompt: options.prompt,
    width: options.width,
    height: options.height,
    steps: options.steps,
    seed: options.seed,
  });
  return { success: true, ...result };
}

module.exports = generateImageTool;
