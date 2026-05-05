const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

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
    'Character framing: always create a full-body chibi virtual character. If the reference is a headshot, avatar, or face-only image, infer a matching torso, outfit, arms, hands, legs, and feet so every frame shows the complete body.',
    'Canvas: one complete portrait spritesheet with true alpha transparency and a transparent background. Do not draw a checkerboard transparency preview or simulated transparency background.',
    'Layout: 8 columns x 10 rows, equal-sized cells, no visible grid lines.',
    'Rows in order: idle, happy, talking, thinking, sleepy, surprised, focused, offline, sad, walking.',
    'Each row must contain 8 animation frames for that action. Keep the pet torso centered and the same scale in every cell.',
    'Walking row must be a walking-in-place loop: clear alternating paw steps, facing sideways, with no side-to-side drift inside the cell. Other rows should animate through pose and facial expression changes.',
    'Constraints: no text, no watermark, no scenery, no shadows, no floor, no frame numbers, no grid lines, no detached effects, no gradients, no realistic fur.',
    'The output must be directly usable as a game/desktop-pet spritesheet.',
  ].join('\n');
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length);
  return chunk;
}

function paethPredictor(left, up, upLeft) {
  const p = left + up - upLeft;
  const pa = Math.abs(p - left);
  const pb = Math.abs(p - up);
  const pc = Math.abs(p - upLeft);
  if (pa <= pb && pa <= pc) return left;
  if (pb <= pc) return up;
  return upLeft;
}

function decodePngToRgba(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!Buffer.isBuffer(buffer) || buffer.length < signature.length || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error('Not a PNG image');
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  const idats = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
    } else if (type === 'IDAT') {
      idats.push(data);
    } else if (type === 'IEND') {
      break;
    }
    offset += length + 12;
  }

  if (bitDepth !== 8 || ![2, 6].includes(colorType)) {
    throw new Error(`Unsupported PNG format: bitDepth=${bitDepth}, colorType=${colorType}`);
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const sourceStride = width * bytesPerPixel;
  const inflated = zlib.inflateSync(Buffer.concat(idats));
  const rgba = Buffer.alloc(width * height * 4);
  let sourceOffset = 0;
  let previousRow = Buffer.alloc(sourceStride);

  for (let y = 0; y < height; y += 1) {
    const filter = inflated[sourceOffset];
    sourceOffset += 1;
    const filtered = inflated.subarray(sourceOffset, sourceOffset + sourceStride);
    sourceOffset += sourceStride;
    const row = Buffer.alloc(sourceStride);

    for (let i = 0; i < sourceStride; i += 1) {
      const left = i >= bytesPerPixel ? row[i - bytesPerPixel] : 0;
      const up = previousRow[i] || 0;
      const upLeft = i >= bytesPerPixel ? previousRow[i - bytesPerPixel] : 0;
      let value = filtered[i];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += Math.floor((left + up) / 2);
      else if (filter === 4) value += paethPredictor(left, up, upLeft);
      else if (filter !== 0) throw new Error(`Unsupported PNG filter: ${filter}`);
      row[i] = value & 0xff;
    }

    for (let x = 0; x < width; x += 1) {
      const src = x * bytesPerPixel;
      const dst = (y * width + x) * 4;
      rgba[dst] = row[src];
      rgba[dst + 1] = row[src + 1];
      rgba[dst + 2] = row[src + 2];
      rgba[dst + 3] = colorType === 6 ? row[src + 3] : 255;
    }
    previousRow = row;
  }

  return { width, height, pixels: rgba };
}

function encodeRgbaPng({ width, height, pixels }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0;
    pixels.copy(raw, rowStart + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function colorDistanceSquared(a, b) {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}

function collectBackgroundPalette(image) {
  const counts = new Map();
  const add = (x, y) => {
    const i = (y * image.width + x) * 4;
    const r = image.pixels[i];
    const g = image.pixels[i + 1];
    const b = image.pixels[i + 2];
    const key = `${Math.round(r / 4) * 4},${Math.round(g / 4) * 4},${Math.round(b / 4) * 4}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  };

  for (let x = 0; x < image.width; x += 1) {
    add(x, 0);
    add(x, image.height - 1);
  }
  for (let y = 1; y < image.height - 1; y += 1) {
    add(0, y);
    add(image.width - 1, y);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key]) => key.split(',').map(Number));
}

function looksLikeBackground(pixel, palette) {
  const [r, g, b, a] = pixel;
  if (a <= 20) return true;
  if (g >= 220 && r <= 90 && b <= 90) return true;
  return palette.some(color => colorDistanceSquared([r, g, b], color) <= 28 * 28);
}

function removeConnectedBackground(image, palette) {
  const { width, height, pixels } = image;
  const seen = new Uint8Array(width * height);
  const queue = [];
  const enqueue = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (seen[p]) return;
    const i = p * 4;
    if (!looksLikeBackground([pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]], palette)) return;
    seen[p] = 1;
    queue.push(p);
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x, 0);
    enqueue(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(0, y);
    enqueue(width - 1, y);
  }

  let cleaned = 0;
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const p = queue[cursor];
    const x = p % width;
    const y = Math.floor(p / width);
    const i = p * 4;
    if (pixels[i + 3] !== 0) {
      pixels[i + 3] = 0;
      cleaned += 1;
    }
    enqueue(x - 1, y);
    enqueue(x + 1, y);
    enqueue(x, y - 1);
    enqueue(x, y + 1);
  }
  return cleaned;
}

function largestOpaqueComponent(image, x0, y0, cellWidth, cellHeight) {
  const visited = new Uint8Array(cellWidth * cellHeight);
  let best = null;
  const queue = [];

  for (let localY = 0; localY < cellHeight; localY += 1) {
    for (let localX = 0; localX < cellWidth; localX += 1) {
      const start = localY * cellWidth + localX;
      if (visited[start]) continue;
      visited[start] = 1;
      const alpha = image.pixels[((y0 + localY) * image.width + x0 + localX) * 4 + 3];
      if (alpha <= 40) continue;

      let count = 0;
      let minX = localX;
      let maxX = localX;
      let minY = localY;
      let maxY = localY;
      queue.length = 0;
      queue.push(start);

      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const p = queue[cursor];
        const px = p % cellWidth;
        const py = Math.floor(p / cellWidth);
        count += 1;
        minX = Math.min(minX, px);
        maxX = Math.max(maxX, px);
        minY = Math.min(minY, py);
        maxY = Math.max(maxY, py);

        const neighbors = [
          [px - 1, py],
          [px + 1, py],
          [px, py - 1],
          [px, py + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || ny < 0 || nx >= cellWidth || ny >= cellHeight) continue;
          const np = ny * cellWidth + nx;
          if (visited[np]) continue;
          visited[np] = 1;
          const ni = ((y0 + ny) * image.width + x0 + nx) * 4 + 3;
          if (image.pixels[ni] > 40) queue.push(np);
        }
      }

      if (!best || count > best.count) {
        best = { count, minX, maxX, minY, maxY };
      }
    }
  }

  return best;
}

function recenterCells(image, columns, rows) {
  const cellWidth = Math.floor(image.width / columns);
  const cellHeight = Math.floor(image.height / rows);
  if (cellWidth <= 0 || cellHeight <= 0) return 0;

  let recentered = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x0 = column * cellWidth;
      const y0 = row * cellHeight;
      const component = largestOpaqueComponent(image, x0, y0, cellWidth, cellHeight);
      if (!component || component.count < 4) continue;

      const componentCenterX = (component.minX + component.maxX) / 2;
      const componentCenterY = (component.minY + component.maxY) / 2;
      const targetCenterX = (cellWidth - 1) / 2;
      const targetCenterY = (cellHeight - 1) / 2;
      const dx = Math.round(targetCenterX - componentCenterX);
      const dy = Math.round(targetCenterY - componentCenterY);
      if (dx === 0 && dy === 0) continue;

      const original = Buffer.alloc(cellWidth * cellHeight * 4);
      for (let y = 0; y < cellHeight; y += 1) {
        const sourceStart = ((y0 + y) * image.width + x0) * 4;
        image.pixels.copy(original, y * cellWidth * 4, sourceStart, sourceStart + cellWidth * 4);
        image.pixels.fill(0, sourceStart, sourceStart + cellWidth * 4);
      }

      for (let y = 0; y < cellHeight; y += 1) {
        for (let x = 0; x < cellWidth; x += 1) {
          const sourceIndex = (y * cellWidth + x) * 4;
          if (original[sourceIndex + 3] === 0) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX < 0 || nextY < 0 || nextX >= cellWidth || nextY >= cellHeight) continue;
          const targetIndex = ((y0 + nextY) * image.width + x0 + nextX) * 4;
          original.copy(image.pixels, targetIndex, sourceIndex, sourceIndex + 4);
        }
      }
      recentered += 1;
    }
  }
  return recentered;
}

function prepareGeneratedPetSpritesheet(buffer, { extension = 'png', columns = 8, rows = 10 } = {}) {
  const normalizedExtension = String(extension || '').toLowerCase();
  const isPng = normalizedExtension === 'png' || (
    Buffer.isBuffer(buffer) &&
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  );
  if (!isPng) {
    return {
      buffer,
      extension: normalizedExtension || extension,
      mime: normalizedExtension === 'webp' ? 'image/webp' : 'image/png',
      cleanedBackground: false,
      recenteredFrames: 0,
    };
  }

  try {
    const image = decodePngToRgba(buffer);
    const palette = collectBackgroundPalette(image);
    const cleanedPixels = removeConnectedBackground(image, palette);
    const recenteredFrames = recenterCells(image, Number(columns) || 8, Number(rows) || 10);
    return {
      buffer: encodeRgbaPng(image),
      extension: 'png',
      mime: 'image/png',
      cleanedBackground: cleanedPixels > 0,
      recenteredFrames,
    };
  } catch (err) {
    return {
      buffer,
      extension: normalizedExtension || extension,
      mime: normalizedExtension === 'webp' ? 'image/webp' : 'image/png',
      cleanedBackground: false,
      recenteredFrames: 0,
      error: err.message,
    };
  }
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

function reportProgress(onProgress, payload) {
  if (typeof onProgress !== 'function') return;
  try {
    onProgress(payload);
  } catch (_) {
    // Progress callbacks are UI-only; generation should continue if the renderer is gone.
  }
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
  onProgress,
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
    reportProgress(onProgress, {
      step: 'prompt',
      title: 'Preparing Full-Body Design',
      message: hasReference
        ? 'Reading the reference as identity; headshots and avatars will be expanded into a complete body.'
        : 'Writing the full-body virtual pet prompt from your description.',
    });
    let response;
    if (hasReference) {
      const form = new FormData();
      form.set('model', config.model);
      form.set('prompt', prompt);
      form.set('size', config.size);
      form.set('quality', config.quality);
      form.append('image[]', fileToBlob(referenceImagePath), path.basename(referenceImagePath));

      reportProgress(onProgress, {
        step: 'generate',
        title: 'Generating Animation Sheet',
        message: 'Creating the full-body pet spritesheet. This can take a little while.',
      });
      response = await fetchImpl(config.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: form,
      });
    } else {
      reportProgress(onProgress, {
        step: 'generate',
        title: 'Generating Animation Sheet',
        message: 'Creating the full-body pet spritesheet. This can take a little while.',
      });
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

    reportProgress(onProgress, {
      step: 'receive',
      title: 'Receiving Image',
      message: 'The image model returned artwork. Preparing it for desktop pet use.',
    });
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

    const extension = imageMimeToExtension(image.mime);
    reportProgress(onProgress, {
      step: 'postprocess',
      title: 'Cleaning Sprite Sheet',
      message: 'Removing preview backgrounds, preserving transparency, and centering every animation frame.',
    });
    const prepared = prepareGeneratedPetSpritesheet(image.buffer, {
      extension,
      columns: 8,
      rows: 10,
    });

    reportProgress(onProgress, {
      step: 'finalize',
      title: 'Finalizing Pet',
      message: 'Saving the pet package and activating the new virtual character.',
    });

    return {
      success: true,
      configured: true,
      model: config.model,
      size: config.size,
      prompt,
      mime: prepared.mime || image.mime,
      extension: prepared.extension || extension,
      buffer: prepared.buffer,
      postprocess: {
        cleanedBackground: prepared.cleanedBackground,
        recenteredFrames: prepared.recenteredFrames,
        error: prepared.error,
      },
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
  prepareGeneratedPetSpritesheet,
  generatePetSpritesheet,
};
