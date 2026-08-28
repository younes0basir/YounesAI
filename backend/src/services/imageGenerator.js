const NVIDIA_IMAGE_API_URL =
  process.env.NVIDIA_IMAGE_API_URL ||
  'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.2-klein-4b';

function buildNvidiaAuthError(detail) {
  return new Error(
    'NVIDIA image generation authorization failed. Check NVIDIA_IMAGE_API_KEY, NVIDIA_API_KEY, or NVIDIA_SAFETY_API_KEY in backend/.env and regenerate if expired or invalid.' +
      (detail ? ` Details: ${detail}` : '')
  );
}

function extractImagePayload(payload) {
  const candidates = [
    payload?.artifacts?.[0],
    payload?.artifacts,
    payload?.images?.[0],
    payload?.image,
    payload?.result,
    payload?.data?.[0],
    payload,
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;

    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        if (!item || typeof item !== 'object') continue;
        const value =
          item.base64 || item.b64 || item.image_base64 || item.image || item.url || item.image_url;
        if (value) return value;
      }
      continue;
    }

    if (typeof candidate !== 'object') continue;

    const value =
      candidate.base64 ||
      candidate.b64 ||
      candidate.image_base64 ||
      candidate.image ||
      candidate.url ||
      candidate.image_url;
    if (value) return value;
  }

  return null;
}

function resolveNvidiaImageKey() {
  return (
    process.env.NVIDIA_IMAGE_API_KEY ||
    process.env.NVIDIA_API_KEY ||
    process.env.NVIDIA_SAFETY_API_KEY ||
    process.env.NVIDIA_safetY_API_KEY
  );
}

async function generateImage({ prompt, width = 768, height = 1344, steps = 4, seed = 1 }) {
  const apiKey = resolveNvidiaImageKey();
  if (!apiKey) {
    throw new Error(
      'NVIDIA_IMAGE_API_KEY is not configured. Add it to your backend .env file (or set NVIDIA_SAFETY_API_KEY as fallback).'
    );
  }

  const response = await fetch(NVIDIA_IMAGE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      prompt: String(prompt || '').trim(),
      width: Number(width) || 768,
      height: Number(height) || 1344,
      steps: Number(steps) || 4,
      seed: Number(seed) || 1,
    }),
  });

  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  if (!response.ok) {
    const detail = typeof body === 'string' ? body : JSON.stringify(body);
    if (response.status === 401 || response.status === 403) {
      throw buildNvidiaAuthError(detail);
    }
    throw new Error(`Image generation failed (${response.status}): ${detail}`);
  }

  const imageSource = extractImagePayload(body);
  if (!imageSource) {
    return {
      raw: body,
      prompt,
      width: Number(width) || 768,
      height: Number(height) || 1344,
      steps: Number(steps) || 4,
      seed: Number(seed) || 1,
    };
  }

  const formattedImage = imageSource.startsWith('data:')
    ? imageSource
    : /^https?:\/\//i.test(imageSource)
      ? imageSource
      : `data:image/png;base64,${imageSource}`;

  return {
    image: formattedImage,
    prompt,
    width: Number(width) || 768,
    height: Number(height) || 1344,
    steps: Number(steps) || 4,
    seed: Number(seed) || 1,
    raw: body,
  };
}

module.exports = { generateImage };
