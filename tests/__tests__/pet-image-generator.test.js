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
      PETCLAW_IMAGE_SIZE: '1536x2080',
      PETCLAW_IMAGE_QUALITY: 'high',
    })

    expect(config).toEqual({
      configured: true,
      provider: 'openai-compatible',
      apiKey: 'sk-test',
      endpoint: 'https://example.test/v1/images/edits',
      model: 'gpt-image-2',
      size: '1536x2080',
      quality: 'high',
    })
  })

  test('reports unconfigured status when no API key is present', () => {
    expect(getImageGenerationConfig({}).configured).toBe(false)
  })

  test('buildPetSpritesheetPrompt asks for the full hatch animation sheet', () => {
    const prompt = buildPetSpritesheetPrompt({
      name: 'Moo Pixel',
      description: 'a cute cow cat with black ears',
    })

    expect(prompt).toContain('Moo Pixel')
    expect(prompt).toContain('8 columns x 10 rows')
    expect(prompt).toContain('8 columns x 10 rows')
    expect(prompt).toContain('idle, happy, talking, thinking, sleepy, surprised, focused, offline, sad, walking')
    expect(prompt).toContain('transparent background')
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
})
