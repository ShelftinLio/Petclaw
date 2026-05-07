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
      const points = [];
      queue.length = 0;
      queue.push(start);

      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const p = queue[cursor];
        const px = p % cellWidth;
        const py = Math.floor(p / cellWidth);
        count += 1;
        points.push(p);
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
        best = { count, minX, maxX, minY, maxY, points };
      }
    }
  }

  return best;
}

function opaqueComponents(image, x0, y0, cellWidth, cellHeight) {
  const visited = new Uint8Array(cellWidth * cellHeight);
  const components = [];
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
      const points = [];
      queue.length = 0;
      queue.push(start);

      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const p = queue[cursor];
        const px = p % cellWidth;
        const py = Math.floor(p / cellWidth);
        count += 1;
        points.push(p);
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

      components.push({ count, minX, maxX, minY, maxY, points });
    }
  }

  return components.sort((a, b) => b.count - a.count);
}

function touchesCellEdge(component, cellWidth, cellHeight, margin = 1) {
  return component.minX <= margin ||
    component.minY <= margin ||
    component.maxX >= cellWidth - 1 - margin ||
    component.maxY >= cellHeight - 1 - margin;
}

function shouldRemoveCellComponent(component, main, cellWidth, cellHeight) {
  if (!main || component === main) return false;
  const smallComparedWithMain = component.count <= Math.max(24, Math.floor(main.count * 0.22));
  const tinyComparedWithMain = component.count <= Math.max(4, Math.floor(main.count * 0.05)) &&
    component.count / Math.max(1, main.count) <= 0.08;
  const componentCenterX = (component.minX + component.maxX) / 2;
  const componentCenterY = (component.minY + component.maxY) / 2;
  const mainCenterX = (main.minX + main.maxX) / 2;
  const mainCenterY = (main.minY + main.maxY) / 2;
  const farFromMain = Math.abs(componentCenterX - mainCenterX) > cellWidth * 0.28 ||
    Math.abs(componentCenterY - mainCenterY) > cellHeight * 0.28;
  if (touchesCellEdge(component, cellWidth, cellHeight, 1)) {
    return smallComparedWithMain || farFromMain;
  }
  if (tinyComparedWithMain && farFromMain) return true;

  const softEdgeMargin = Math.max(1, Math.round(Math.min(cellWidth, cellHeight) * 0.03));
  if (touchesCellEdge(component, cellWidth, cellHeight, softEdgeMargin)) {
    return smallComparedWithMain && farFromMain;
  }
  return false;
}

function resizeNearestRgba(image, targetWidth, targetHeight) {
  if (image.width === targetWidth && image.height === targetHeight) return image;
  const pixels = Buffer.alloc(targetWidth * targetHeight * 4);
  for (let y = 0; y < targetHeight; y += 1) {
    const sourceY = Math.min(image.height - 1, Math.floor((y * image.height) / targetHeight));
    for (let x = 0; x < targetWidth; x += 1) {
      const sourceX = Math.min(image.width - 1, Math.floor((x * image.width) / targetWidth));
      const sourceIndex = (sourceY * image.width + sourceX) * 4;
      const targetIndex = (y * targetWidth + x) * 4;
      image.pixels.copy(pixels, targetIndex, sourceIndex, sourceIndex + 4);
    }
  }
  return { width: targetWidth, height: targetHeight, pixels };
}

function normalizeSpritesheetGrid(image, columns, rows) {
  const safeColumns = Number(columns) || 8;
  const safeRows = Number(rows) || 10;
  const cellWidth = Math.max(1, Math.round(image.width / safeColumns));
  const cellHeight = Math.max(1, Math.round(image.height / safeRows));
  const targetWidth = cellWidth * safeColumns;
  const targetHeight = cellHeight * safeRows;
  if (targetWidth === image.width && targetHeight === image.height) {
    return { image, normalized: false };
  }
  return {
    image: resizeNearestRgba(image, targetWidth, targetHeight),
    normalized: true,
  };
}

function repairInteriorTransparentHoles(image, columns, rows) {
  const cellWidth = Math.floor(image.width / columns);
  const cellHeight = Math.floor(image.height / rows);
  if (cellWidth <= 0 || cellHeight <= 0) return 0;

  let repaired = 0;
  const neighborOffsets = [
    [-1, -1], [0, -1], [1, -1],
    [-1, 0], [1, 0],
    [-1, 1], [0, 1], [1, 1],
  ];

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x0 = column * cellWidth;
      const y0 = row * cellHeight;
      const outside = new Uint8Array(cellWidth * cellHeight);
      const queue = [];
      const enqueue = (x, y) => {
        if (x < 0 || y < 0 || x >= cellWidth || y >= cellHeight) return;
        const p = y * cellWidth + x;
        if (outside[p]) return;
        const i = ((y0 + y) * image.width + x0 + x) * 4;
        if (image.pixels[i + 3] > 40) return;
        outside[p] = 1;
        queue.push(p);
      };

      for (let x = 0; x < cellWidth; x += 1) {
        enqueue(x, 0);
        enqueue(x, cellHeight - 1);
      }
      for (let y = 1; y < cellHeight - 1; y += 1) {
        enqueue(0, y);
        enqueue(cellWidth - 1, y);
      }
      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const p = queue[cursor];
        const x = p % cellWidth;
        const y = Math.floor(p / cellWidth);
        enqueue(x - 1, y);
        enqueue(x + 1, y);
        enqueue(x, y - 1);
        enqueue(x, y + 1);
      }

      let holes = [];
      for (let y = 0; y < cellHeight; y += 1) {
        for (let x = 0; x < cellWidth; x += 1) {
          const p = y * cellWidth + x;
          const i = ((y0 + y) * image.width + x0 + x) * 4;
          if (image.pixels[i + 3] <= 40 && !outside[p]) holes.push(p);
        }
      }

      let guard = cellWidth + cellHeight;
      while (holes.length && guard > 0) {
        const remaining = [];
        for (const p of holes) {
          const x = p % cellWidth;
          const y = Math.floor(p / cellWidth);
          let r = 0;
          let g = 0;
          let b = 0;
          let a = 0;
          let samples = 0;
          for (const [dx, dy] of neighborOffsets) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= cellWidth || ny >= cellHeight) continue;
            const ni = ((y0 + ny) * image.width + x0 + nx) * 4;
            if (image.pixels[ni + 3] <= 40) continue;
            r += image.pixels[ni];
            g += image.pixels[ni + 1];
            b += image.pixels[ni + 2];
            a += image.pixels[ni + 3];
            samples += 1;
          }
          if (!samples) {
            remaining.push(p);
            continue;
          }
          const i = ((y0 + y) * image.width + x0 + x) * 4;
          image.pixels[i] = Math.round(r / samples);
          image.pixels[i + 1] = Math.round(g / samples);
          image.pixels[i + 2] = Math.round(b / samples);
          image.pixels[i + 3] = Math.round(a / samples);
          repaired += 1;
        }
        if (remaining.length === holes.length) break;
        holes = remaining;
        guard -= 1;
      }
    }
  }

  return repaired;
}

function opaqueSampleInDirection(image, x0, y0, cellWidth, cellHeight, x, y, dx, dy, maxDistance) {
  for (let distance = 1; distance <= maxDistance; distance += 1) {
    const nx = x + dx * distance;
    const ny = y + dy * distance;
    if (nx < 0 || ny < 0 || nx >= cellWidth || ny >= cellHeight) return null;
    const i = ((y0 + ny) * image.width + x0 + nx) * 4;
    if (image.pixels[i + 3] <= 40) continue;
    return {
      r: image.pixels[i],
      g: image.pixels[i + 1],
      b: image.pixels[i + 2],
      a: image.pixels[i + 3],
      distance,
    };
  }
  return null;
}

function sameMaterialSamples(a, b) {
  if (!a || !b) return false;
  return colorDistanceSquared([a.r, a.g, a.b], [b.r, b.g, b.b]) <= 95 * 95;
}

function averageOpaqueSamples(samples) {
  let r = 0;
  let g = 0;
  let b = 0;
  let a = 0;
  let totalWeight = 0;
  for (const sample of samples) {
    const weight = 1 / Math.max(1, sample.distance || 1);
    r += sample.r * weight;
    g += sample.g * weight;
    b += sample.b * weight;
    a += sample.a * weight;
    totalWeight += weight;
  }
  return [
    Math.round(r / totalWeight),
    Math.round(g / totalWeight),
    Math.round(b / totalWeight),
    Math.round(a / totalWeight),
  ];
}

function repairCutoutMarksNearForeground(image, columns, rows) {
  const cellWidth = Math.floor(image.width / columns);
  const cellHeight = Math.floor(image.height / rows);
  if (cellWidth <= 0 || cellHeight <= 0) return 0;

  const maxBridgeDistance = Math.max(4, Math.min(6, Math.round(Math.min(cellWidth, cellHeight) * 0.05)));
  let repaired = 0;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x0 = column * cellWidth;
      const y0 = row * cellHeight;
      let bounds = null;
      for (let y = 0; y < cellHeight; y += 1) {
        for (let x = 0; x < cellWidth; x += 1) {
          const i = ((y0 + y) * image.width + x0 + x) * 4;
          if (image.pixels[i + 3] <= 40) continue;
          if (!bounds) bounds = { minX: x, minY: y, maxX: x, maxY: y };
          bounds.minX = Math.min(bounds.minX, x);
          bounds.minY = Math.min(bounds.minY, y);
          bounds.maxX = Math.max(bounds.maxX, x);
          bounds.maxY = Math.max(bounds.maxY, y);
        }
      }
      if (!bounds) continue;

      bounds = {
        minX: Math.max(0, bounds.minX - 1),
        minY: Math.max(0, bounds.minY - 1),
        maxX: Math.min(cellWidth - 1, bounds.maxX + 1),
        maxY: Math.min(cellHeight - 1, bounds.maxY + 1),
      };

      for (let pass = 0; pass < 6; pass += 1) {
        const repairs = [];
        for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
          for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
            const i = ((y0 + y) * image.width + x0 + x) * 4;
            if (image.pixels[i + 3] > 40) continue;

            const left = opaqueSampleInDirection(image, x0, y0, cellWidth, cellHeight, x, y, -1, 0, maxBridgeDistance);
            const right = opaqueSampleInDirection(image, x0, y0, cellWidth, cellHeight, x, y, 1, 0, maxBridgeDistance);
            const up = opaqueSampleInDirection(image, x0, y0, cellWidth, cellHeight, x, y, 0, -1, maxBridgeDistance);
            const down = opaqueSampleInDirection(image, x0, y0, cellWidth, cellHeight, x, y, 0, 1, maxBridgeDistance);
            const samples = [];
            if (sameMaterialSamples(left, right)) samples.push(left, right);
            if (sameMaterialSamples(up, down)) samples.push(up, down);
            if (!samples.length) continue;

            repairs.push({
              index: i,
              color: averageOpaqueSamples(samples),
            });
          }
        }

        if (!repairs.length) break;
        for (const repair of repairs) {
          image.pixels[repair.index] = repair.color[0];
          image.pixels[repair.index + 1] = repair.color[1];
          image.pixels[repair.index + 2] = repair.color[2];
          image.pixels[repair.index + 3] = repair.color[3];
          repaired += 1;
        }
      }
    }
  }

  return repaired;
}

function componentCoreAnchorX(component) {
  if (!component || !component.points?.length) return null;
  const height = component.maxY - component.minY + 1;
  const coreMaxY = component.minY + Math.max(2, Math.floor(height * 0.38));
  let minX = Infinity;
  let maxX = -Infinity;
  let samples = 0;
  for (const point of component.points) {
    const x = point % component.cellWidth;
    const y = Math.floor(point / component.cellWidth);
    if (y > coreMaxY) continue;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    samples += 1;
  }
  if (samples < Math.max(4, Math.floor(component.count * 0.08))) {
    return null;
  }
  return (minX + maxX) / 2;
}

function clampOffset(offset, minX, maxX, size) {
  return Math.max(-minX, Math.min(size - 1 - maxX, offset));
}

function recenterCells(image, columns, rows) {
  const cellWidth = Math.floor(image.width / columns);
  const cellHeight = Math.floor(image.height / rows);
  if (cellWidth <= 0 || cellHeight <= 0) {
    return { recenteredFrames: 0, removedCellSlivers: 0 };
  }

  let recentered = 0;
  let removedCellSlivers = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x0 = column * cellWidth;
      const y0 = row * cellHeight;
      const components = opaqueComponents(image, x0, y0, cellWidth, cellHeight);
      const main = components[0];
      if (!main || main.count < 4) continue;
      const kept = components.filter(component => !shouldRemoveCellComponent(component, main, cellWidth, cellHeight));
      if (!kept.length) kept.push(main);

      let opaqueCount = 0;
      let keptCount = 0;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      const original = Buffer.alloc(cellWidth * cellHeight * 4);
      for (let y = 0; y < cellHeight; y += 1) {
        const sourceStart = ((y0 + y) * image.width + x0) * 4;
        image.pixels.copy(original, y * cellWidth * 4, sourceStart, sourceStart + cellWidth * 4);
        for (let x = 0; x < cellWidth; x += 1) {
          if (original[(y * cellWidth + x) * 4 + 3] > 0) opaqueCount += 1;
        }
        image.pixels.fill(0, sourceStart, sourceStart + cellWidth * 4);
      }

      for (const component of kept) {
        keptCount += component.count;
        minX = Math.min(minX, component.minX);
        minY = Math.min(minY, component.minY);
        maxX = Math.max(maxX, component.maxX);
        maxY = Math.max(maxY, component.maxY);
      }

      const anchorSource = kept.includes(main) ? main : kept[0];
      const coreAnchorX = componentCoreAnchorX({
        ...anchorSource,
        cellWidth,
      });
      const componentCenterX = Number.isFinite(coreAnchorX) ? coreAnchorX : (minX + maxX) / 2;
      const componentCenterY = (minY + maxY) / 2;
      const targetCenterX = (cellWidth - 1) / 2;
      const targetCenterY = (cellHeight - 1) / 2;
      const dx = clampOffset(Math.round(targetCenterX - componentCenterX), minX, maxX, cellWidth);
      const dy = clampOffset(Math.round(targetCenterY - componentCenterY), minY, maxY, cellHeight);

      for (const component of kept) {
        for (const point of component.points || []) {
          const x = point % cellWidth;
          const y = Math.floor(point / cellWidth);
          const sourceIndex = (y * cellWidth + x) * 4;
          if (original[sourceIndex + 3] === 0) continue;
          const nextX = x + dx;
          const nextY = y + dy;
          if (nextX < 0 || nextY < 0 || nextX >= cellWidth || nextY >= cellHeight) continue;
          const targetIndex = ((y0 + nextY) * image.width + x0 + nextX) * 4;
          original.copy(image.pixels, targetIndex, sourceIndex, sourceIndex + 4);
        }
      }

      const removedInCell = Math.max(0, opaqueCount - keptCount);
      removedCellSlivers += removedInCell;
      if (dx !== 0 || dy !== 0 || removedInCell > 0) recentered += 1;
    }
  }
  return { recenteredFrames: recentered, removedCellSlivers };
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
      normalizedGrid: false,
      repairedInteriorHoles: 0,
      repairedCutoutMarks: 0,
      recenteredFrames: 0,
      removedCellSlivers: 0,
    };
  }

  try {
    let image = decodePngToRgba(buffer);
    const grid = normalizeSpritesheetGrid(image, Number(columns) || 8, Number(rows) || 10);
    image = grid.image;
    const palette = collectBackgroundPalette(image);
    const cleanedPixels = removeConnectedBackground(image, palette);
    const recentered = recenterCells(image, Number(columns) || 8, Number(rows) || 10);
    let repairedInteriorHoles = repairInteriorTransparentHoles(image, Number(columns) || 8, Number(rows) || 10);
    const repairedCutoutMarks = repairCutoutMarksNearForeground(image, Number(columns) || 8, Number(rows) || 10);
    repairedInteriorHoles += repairInteriorTransparentHoles(image, Number(columns) || 8, Number(rows) || 10);
    return {
      buffer: encodeRgbaPng(image),
      extension: 'png',
      mime: 'image/png',
      width: image.width,
      height: image.height,
      cleanedBackground: cleanedPixels > 0,
      normalizedGrid: grid.normalized,
      repairedInteriorHoles,
      repairedCutoutMarks,
      recenteredFrames: recentered.recenteredFrames,
      removedCellSlivers: recentered.removedCellSlivers,
    };
  } catch (err) {
    return {
      buffer,
      extension: normalizedExtension || extension,
      mime: normalizedExtension === 'webp' ? 'image/webp' : 'image/png',
      cleanedBackground: false,
      normalizedGrid: false,
      repairedInteriorHoles: 0,
      repairedCutoutMarks: 0,
      recenteredFrames: 0,
      removedCellSlivers: 0,
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

    const outputSize = prepared.width && prepared.height
      ? `${prepared.width}x${prepared.height}`
      : config.size;

    return {
      success: true,
      configured: true,
      model: config.model,
      size: outputSize,
      requestedSize: config.size,
      prompt,
      mime: prepared.mime || image.mime,
      extension: prepared.extension || extension,
      buffer: prepared.buffer,
      postprocess: {
        cleanedBackground: prepared.cleanedBackground,
        normalizedGrid: prepared.normalizedGrid,
        repairedInteriorHoles: prepared.repairedInteriorHoles,
        repairedCutoutMarks: prepared.repairedCutoutMarks,
        recenteredFrames: prepared.recenteredFrames,
        removedCellSlivers: prepared.removedCellSlivers,
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
