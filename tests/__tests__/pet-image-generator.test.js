const {
  buildPetSpritesheetPrompt,
  getImageGenerationConfig,
  parseImageApiResponse,
  imageMimeToExtension,
  cellFromImageSize,
  prepareGeneratedPetSpritesheet,
} = require('../../pet-image-generator')

const zlib = require('zlib')

function crc32(buffer) {
  let crc = 0xffffffff
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii')
  const chunk = Buffer.alloc(12 + data.length)
  chunk.writeUInt32BE(data.length, 0)
  typeBuffer.copy(chunk, 4)
  data.copy(chunk, 8)
  chunk.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 8 + data.length)
  return chunk
}

function createRgbPng(width, height, pixelAt) {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 2
  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y += 1) {
    const row = y * (stride + 1)
    raw[row] = 0
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = pixelAt(x, y)
      const i = row + 1 + x * 3
      raw[i] = r
      raw[i + 1] = g
      raw[i + 2] = b
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function decodeRgbaPng(buffer) {
  let offset = 8
  let width = 0
  let height = 0
  const idats = []
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      expect(data[9]).toBe(6)
    } else if (type === 'IDAT') {
      idats.push(data)
    } else if (type === 'IEND') {
      break
    }
    offset += length + 12
  }
  const inflated = zlib.inflateSync(Buffer.concat(idats))
  const stride = width * 4
  const pixels = Buffer.alloc(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    expect(inflated[y * (stride + 1)]).toBe(0)
    inflated.copy(pixels, y * stride, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride)
  }
  return { width, height, pixels }
}

function bboxForColor(decoded, [r, g, b]) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let y = 0; y < decoded.height; y += 1) {
    for (let x = 0; x < decoded.width; x += 1) {
      const i = (y * decoded.width + x) * 4
      if (
        decoded.pixels[i] === r &&
        decoded.pixels[i + 1] === g &&
        decoded.pixels[i + 2] === b &&
        decoded.pixels[i + 3] > 0
      ) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }
  return { minX, minY, maxX, maxY }
}

describe('pet image generator', () => {
  test('reads OpenAI-compatible image generation config from env', () => {
    const config = getImageGenerationConfig({
      OPENAI_API_KEY: 'sk-test',
      PETCLAW_IMAGE_MODEL: 'gpt-image-2',
      PETCLAW_IMAGE_API_URL: 'https://example.test/v1/images/edits',
      PETCLAW_IMAGE_GENERATION_API_URL: 'https://example.test/v1/images/generations',
      PETCLAW_IMAGE_SIZE: '1536x2080',
      PETCLAW_IMAGE_QUALITY: 'high',
    })

    expect(config).toEqual({
      configured: true,
      provider: 'openai-compatible',
      apiKey: 'sk-test',
      endpoint: 'https://example.test/v1/images/edits',
      generationEndpoint: 'https://example.test/v1/images/generations',
      model: 'gpt-image-2',
      size: '1536x2080',
      quality: 'high',
    })
  })

  test('derives image endpoints from an OpenAI-compatible base URL', () => {
    const config = getImageGenerationConfig({
      PETCLAW_IMAGE_API_KEY: 'sk-test',
      PETCLAW_IMAGE_BASE_URL: 'https://example.test/api',
    })

    expect(config.endpoint).toBe('https://example.test/api/v1/images/edits')
    expect(config.generationEndpoint).toBe('https://example.test/api/v1/images/generations')
  })

  test('does not duplicate v1 when base URL already includes it', () => {
    const config = getImageGenerationConfig({
      PETCLAW_IMAGE_API_KEY: 'sk-test',
      PETCLAW_IMAGE_BASE_URL: 'https://example.test/api/v1',
    })

    expect(config.endpoint).toBe('https://example.test/api/v1/images/edits')
    expect(config.generationEndpoint).toBe('https://example.test/api/v1/images/generations')
  })

  test('reports unconfigured status when no API key is present', () => {
    expect(getImageGenerationConfig({}).configured).toBe(false)
  })

  test('buildPetSpritesheetPrompt asks for the full hatch animation sheet', () => {
    const prompt = buildPetSpritesheetPrompt({
      name: 'Moo Pixel',
      description: 'a cute cow cat with black ears',
      hasReference: true,
    })

    expect(prompt).toContain('Moo Pixel')
    expect(prompt).toContain('8 columns x 10 rows')
    expect(prompt).toContain('8 columns x 10 rows')
    expect(prompt).toContain('idle, happy, talking, thinking, sleepy, surprised, focused, offline, sad, walking')
    expect(prompt).toContain('transparent background')
    expect(prompt).toContain('Do not draw a checkerboard transparency preview')
    expect(prompt).toContain('walking-in-place')
    expect(prompt).toContain('full-body chibi virtual character')
    expect(prompt).toContain('headshot, avatar, or face-only')
  })

  test('buildPetSpritesheetPrompt supports text-only generation', () => {
    const prompt = buildPetSpritesheetPrompt({
      name: 'Space Pet',
      description: 'a tiny astronaut cat',
      hasReference: false,
    })

    expect(prompt).toContain('Character request: a tiny astronaut cat')
    expect(prompt).not.toContain('uploaded reference image')
  })

  test('parseImageApiResponse accepts base64 image output', () => {
    const parsed = parseImageApiResponse({
      data: [{ b64_json: Buffer.from('image').toString('base64') }],
    })

    expect(parsed.mime).toBe('image/png')
    expect(parsed.buffer.toString()).toBe('image')
  })

  test('imageMimeToExtension maps supported mime types', () => {
    expect(imageMimeToExtension('image/png')).toBe('png')
    expect(imageMimeToExtension('image/webp')).toBe('webp')
    expect(imageMimeToExtension('image/jpeg')).toBe('jpg')
  })

  test('cellFromImageSize derives manifest cells from generated image size', () => {
    expect(cellFromImageSize('1024x1536')).toEqual({ width: 128, height: 154 })
    expect(cellFromImageSize('auto')).toEqual({ width: 192, height: 208 })
  })

  test('prepareGeneratedPetSpritesheet removes checkerboard preview backgrounds', () => {
    const png = createRgbPng(8, 8, (x, y) => {
      if (x >= 3 && x <= 4 && y >= 3 && y <= 4) return [220, 20, 40]
      return (x + y) % 2 === 0 ? [255, 255, 255] : [238, 238, 238]
    })

    const prepared = prepareGeneratedPetSpritesheet(png, { extension: 'png', columns: 1, rows: 1 })
    const decoded = decodeRgbaPng(prepared.buffer)
    const cornerAlpha = decoded.pixels[3]
    const red = bboxForColor(decoded, [220, 20, 40])

    expect(prepared.cleanedBackground).toBe(true)
    expect(cornerAlpha).toBe(0)
    expect(red).toEqual({ minX: 3, minY: 3, maxX: 4, maxY: 4 })
  })

  test('prepareGeneratedPetSpritesheet recenters the main component inside each cell', () => {
    const png = createRgbPng(10, 10, (x, y) => {
      if (x >= 1 && x <= 2 && y >= 4 && y <= 5) return [40, 90, 220]
      return (x + y) % 2 === 0 ? [255, 255, 255] : [238, 238, 238]
    })

    const prepared = prepareGeneratedPetSpritesheet(png, { extension: 'png', columns: 1, rows: 1 })
    const decoded = decodeRgbaPng(prepared.buffer)
    const blue = bboxForColor(decoded, [40, 90, 220])

    expect(prepared.recenteredFrames).toBe(1)
    expect(blue).toEqual({ minX: 4, minY: 4, maxX: 5, maxY: 5 })
  })

  test('generatePetSpritesheet uses text generation endpoint without a reference image', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify({
        data: [{ b64_json: Buffer.from('image').toString('base64') }],
      }),
    })
    const { generatePetSpritesheet } = require('../../pet-image-generator')

    const result = await generatePetSpritesheet({
      name: 'Text Pet',
      description: 'a tiny text-only pet',
      fetchImpl,
      env: {
        OPENAI_API_KEY: 'sk-test',
        PETCLAW_IMAGE_GENERATION_API_URL: 'https://example.test/v1/images/generations',
      },
    })

    expect(result.success).toBe(true)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.test/v1/images/generations',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer sk-test',
          'Content-Type': 'application/json',
        }),
      }),
    )
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toMatchObject({
      prompt: expect.stringContaining('a tiny text-only pet'),
    })
  })

  test('generatePetSpritesheet returns API errors instead of throwing', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({
        error: { message: 'Unsupported image size' },
      }),
    })
    const { generatePetSpritesheet } = require('../../pet-image-generator')

    const result = await generatePetSpritesheet({
      name: 'Bad Pet',
      description: 'a tiny pet',
      fetchImpl,
      env: { OPENAI_API_KEY: 'sk-test' },
    })

    expect(result).toMatchObject({
      success: false,
      configured: true,
      error: 'Image API generation failed: Unsupported image size',
    })
  })
})
