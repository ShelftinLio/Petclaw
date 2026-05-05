const {
  buildPetSpritesheetPrompt,
  getImageGenerationConfig,
  parseImageApiResponse,
  imageMimeToExtension,
  cellFromImageSize,
} = require('../../pet-image-generator')

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
