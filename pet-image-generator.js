const fs = require('fs');
const path = require('path');

const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/images/edits';
const DEFAULT_GENERATION_ENDPOINT = 'https://api.openai.com/v1/images/generations';
const DEFAULT_MODEL = 'gpt-image-1.5';
const DEFAULT_SIZE = '1024x1536';
const DEFAULT_QUALITY = 'high';

function joinUrl(base, suffix) {
  const cleanBase = String(base || '').replace(/\/+$/, '');
  const cleanSuffix = String(suffix || '').replace(/^\/+/, '');
  return `${cleanBase}/${cleanSuffix}`;
}

function deriveImageEndpoint(baseUrl, kind) {
  if (!baseUrl) return kind === 'edits' ? DEFAULT_ENDPOINT : DEFAULT_GENERATION_ENDPOINT;
  const cleanBase = String(baseUrl).replace(/\/+$/, '');
  const versionedBase = /\/v1$/i.test(cleanBase) ? cleanBase : joinUrl(cleanBase, 'v1');
  return joinUrl(versionedBase, `images/${kind}`);
}

function getImageGenerationConfig(env = process.env) {
  const apiKey = env.PETCLAW_IMAGE_API_KEY || env.OPENAI_API_KEY || '';
  const baseUrl = env.PETCLAW_IMAGE_BASE_URL || '';
  return {
    configured: Boolean(apiKey),
    provider: 'openai-compatible',
    apiKey,
    endpoint: env.PETCLAW_IMAGE_API_URL || deriveImageEndpoint(baseUrl, 'edits'),
    generationEndpoint: env.PETCLAW_IMAGE_GENERATION_API_URL || deriveImageEndpoint(baseUrl, 'generations'),
    model: env.PETCLAW_IMAGE_MODEL || DEFAULT_MODEL,
    size: env.PETCLAW_IMAGE_SIZE || DEFAULT_SIZE,
    quality: env.PETCLAW_IMAGE_QUALITY || DEFAULT_QUALITY,
  };
}

function buildPetSpritesheetPrompt({ name, description, hasReference = false } = {}) {
  const petName = name || 'Generated Pet';
  const subject = description || 'a friendly custom desktop pet';
  const referenceLine = hasReference
    ? 'Use the uploaded reference image as the identity reference. Simplify it into a cute pixel-art mascot.'
    : 'Create the character directly from the written description as a cute pixel-art mascot.';
  return [
    'Create a production-ready animated desktop pet spritesheet.',
    '',
    `Pet name: ${petName}`,
    `Character request: ${subject}`,
    '',
    referenceLine,
    'Style: compact chibi pixel art, black 1-2 px outline, strong readable silhouette, flat cel shading, limited black/white/accent palette, vertical i-like glowing eyes.',
    'Canvas: one complete portrait spritesheet, transparent background.',
    'Layout: 8 columns x 10 rows, equal-sized cells, no visible grid lines.',
    'Rows in order: idle, happy, talking, thinking, sleepy, surprised, focused, offline, sad, walking.',
    'Each row must contain 8 animation frames for that action. Keep the pet centered and the same scale in every cell.',
    'Walking row must show clear alternating paw steps and sideways motion. Other rows should animate through pose and facial expression changes.',
    'Constraints: no text, no watermark, no scenery, no shadows, no floor, no frame numbers, no grid lines, no detached effects, no gradients, no realistic fur.',
    'The output must be directly usable as a game/desktop-pet spritesheet.',
  ].join('\n');
}

function cellFromImageSize(size, columns = 8, rows = 10) {
  const match = /^(\d+)x(\d+)$/i.exec(String(size || ''));
  if (!match) return { width: 192, height: 208 };
  return {
    width: Math.round(Number(match[1]) / columns),
    height: Math.round(Number(match[2]) / rows),
  };
}

function imageMimeToExtension(mime) {
  const normalized = String(mime || '').toLowerCase();
  if (normalized.includes('webp')) return 'webp';
  if (normalized.includes('jpeg') || normalized.includes('jpg')) return 'jpg';
  return 'png';
}

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(String(dataUrl || ''));
  if (!match) return null;
  return {
    mime: match[1].toLowerCase(),
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function parseImageApiResponse(json) {
  const first = json && Array.isArray(json.data) ? json.data[0] : null;
  if (!first) {
    throw new Error('Image API response did not include data[0]');
  }

  if (first.b64_json) {
    return {
      mime: first.mime_type || 'image/png',
      buffer: Buffer.from(first.b64_json, 'base64'),
    };
  }

  if (first.image_base64) {
    return {
      mime: first.mime_type || 'image/png',
      buffer: Buffer.from(first.image_base64, 'base64'),
    };
  }

  if (first.url) {
    return {
      mime: first.mime_type || 'image/png',
      url: first.url,
    };
  }

  const dataUrl = first.image_url || first.data_url;
  const parsedDataUrl = parseDataUrl(dataUrl);
  if (parsedDataUrl) return parsedDataUrl;

  throw new Error('Image API response did not include a supported image payload');
}

function fileToBlob(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = ext === '.webp'
    ? 'image/webp'
    : ext === '.jpg' || ext === '.jpeg'
      ? 'image/jpeg'
      : 'image/png';
  return new Blob([fs.readFileSync(filePath)], { type: mime });
}

async function fetchImageUrl(url, fetchImpl = fetch) {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`Could not download generated image: HTTP ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  return {
    mime: response.headers.get('content-type') || 'image/png',
    buffer: Buffer.from(arrayBuffer),
  };
}

async function generatePetSpritesheet({
  referenceImagePath,
  name,
  description,
  fetchImpl = fetch,
  env = process.env,
} = {}) {
  const config = getImageGenerationConfig(env);
  if (!config.configured) {
    return {
      success: false,
      configured: false,
      error: 'OPENAI_API_KEY or PETCLAW_IMAGE_API_KEY is required for automatic pet generation.',
      config: { ...config, apiKey: '' },
    };
  }

  const hasReference = Boolean(referenceImagePath);
  if (referenceImagePath && !fs.existsSync(referenceImagePath)) {
    throw new Error('Reference image does not exist');
  }

  const prompt = buildPetSpritesheetPrompt({ name, description, hasReference });
  try {
    let response;
    if (hasReference) {
      const form = new FormData();
      form.set('model', config.model);
      form.set('prompt', prompt);
      form.set('size', config.size);
      form.set('quality', config.quality);
      form.append('image[]', fileToBlob(referenceImagePath), path.basename(referenceImagePath));

      response = await fetchImpl(config.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: form,
      });
    } else {
      response = await fetchImpl(config.generationEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          prompt,
          size: config.size,
          quality: config.quality,
        }),
      });
    }

    const text = await response.text();
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch (err) {
      return {
        success: false,
        configured: true,
        error: `Image API returned non-JSON response: ${text.slice(0, 160)}`,
        prompt,
      };
    }

    if (!response.ok) {
      const message = json.error?.message || json.message || `HTTP ${response.status}`;
      return {
        success: false,
        configured: true,
        error: `Image API generation failed: ${message}`,
        prompt,
      };
    }

    let image = parseImageApiResponse(json);
    if (image.url) {
      image = await fetchImageUrl(image.url, fetchImpl);
    }

    return {
      success: true,
      configured: true,
      model: config.model,
      size: config.size,
      prompt,
      mime: image.mime,
      extension: imageMimeToExtension(image.mime),
      buffer: image.buffer,
    };
  } catch (err) {
    return {
      success: false,
      configured: true,
      error: err.message || 'Image API generation failed',
      prompt,
    };
  }
}

module.exports = {
  DEFAULT_ENDPOINT,
  DEFAULT_GENERATION_ENDPOINT,
  DEFAULT_MODEL,
  DEFAULT_SIZE,
  DEFAULT_QUALITY,
  getImageGenerationConfig,
  deriveImageEndpoint,
  buildPetSpritesheetPrompt,
  parseImageApiResponse,
  imageMimeToExtension,
  cellFromImageSize,
  generatePetSpritesheet,
};
