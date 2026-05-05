const {
  COW_CAT_ID,
  normalizeAppearanceConfig,
  createBuiltInCowCatManifest,
  validatePetManifest,
  createCustomPetRecord,
  createImagePetManifest,
  createImagegenPetRequest,
  createHatchPetJobs,
  upsertCustomPet,
  removeCustomPet,
  setActivePet,
  inferRendererFromFiles,
} = require('../../pet-appearance')

describe('Pet appearance helpers', () => {
  test('normalizeAppearanceConfig fills safe cow-cat defaults', () => {
    expect(normalizeAppearanceConfig()).toEqual({
      mode: 'cow-cat',
      activePetId: COW_CAT_ID,
      customPets: [],
    })
  })

  test('normalizeAppearanceConfig preserves valid custom pets', () => {
    const customPets = [
      {
        id: 'custom-1',
        name: 'Sketch',
        source: 'local-image',
        renderer: 'image',
        assetDir: 'assets/pets/custom/custom-1',
        manifestPath: 'assets/pets/custom/custom-1/pet.json',
        createdAt: '2026-05-03T12:00:00.000Z',
      },
    ]

    expect(normalizeAppearanceConfig({
      mode: 'custom-image',
      activePetId: 'custom-1',
      customPets,
    })).toEqual({
      mode: 'custom-image',
      activePetId: 'custom-1',
      customPets,
    })
  })

  test('createBuiltInCowCatManifest declares animated cow-cat spritesheet renderer', () => {
    expect(createBuiltInCowCatManifest()).toMatchObject({
      id: COW_CAT_ID,
      name: 'Cow Cat',
      source: 'built-in',
      renderer: 'spritesheet',
      spritesheet: 'spritesheet.svg',
      cell: { width: 192, height: 208 },
      layout: { columns: 8, rows: 10 },
      states: expect.objectContaining({
        idle: { row: 0, frames: 8, duration: 140 },
        happy: { row: 1, frames: 8, duration: 120 },
        talking: { row: 2, frames: 8, duration: 100 },
        thinking: { row: 3, frames: 8, duration: 160 },
        walking: { row: 9, frames: 8, duration: 90 },
      }),
    })
  })

  test('validatePetManifest rejects missing renderer', () => {
    expect(validatePetManifest({ id: 'bad', name: 'Bad Pet' })).toEqual({
      ok: false,
      error: 'pet.json renderer must be one of: dom-cow-cat, image, spritesheet, frames',
    })
  })

  test('validatePetManifest accepts image pets with a default state', () => {
    expect(validatePetManifest({
      id: 'custom-1',
      name: 'Sketch',
      source: 'local-image',
      renderer: 'image',
      states: {
        idle: { image: 'generated.png', duration: 180 },
      },
    })).toEqual({ ok: true })
  })

  test('createCustomPetRecord uses stable manifest and asset paths', () => {
    expect(createCustomPetRecord({
      id: 'custom-20260503-120000',
      name: 'Sketch',
      source: 'local-image',
      renderer: 'image',
      createdAt: '2026-05-03T12:00:00.000Z',
    })).toEqual({
      id: 'custom-20260503-120000',
      name: 'Sketch',
      source: 'local-image',
      renderer: 'image',
      assetDir: 'assets/pets/custom/custom-20260503-120000',
      manifestPath: 'assets/pets/custom/custom-20260503-120000/pet.json',
      createdAt: '2026-05-03T12:00:00.000Z',
    })
  })

  test('inferRendererFromFiles prefers spritesheet over generated image', () => {
    expect(inferRendererFromFiles(['pet.json', 'spritesheet.webp', 'generated.png'])).toBe('spritesheet')
    expect(inferRendererFromFiles(['pet.json', 'generated.png'])).toBe('image')
    expect(inferRendererFromFiles(['pet.json', 'idle.png', 'happy.png'])).toBe('frames')
  })

  test('createImagePetManifest creates a valid single-image pet', () => {
    const manifest = createImagePetManifest({
      id: 'custom-1',
      name: 'Sketch',
      image: 'generated.png',
      source: 'local-image',
    })

    expect(manifest).toMatchObject({
      id: 'custom-1',
      name: 'Sketch',
      source: 'local-image',
      renderer: 'image',
      states: {
        idle: { image: 'generated.png', duration: 180 },
        happy: { image: 'generated.png', duration: 150 },
        talking: { image: 'generated.png', duration: 120 },
        thinking: { image: 'generated.png', duration: 220 },
      },
    })
    expect(validatePetManifest(manifest)).toEqual({ ok: true })
  })

  test('createImagegenPetRequest creates a hatch-style generation package request', () => {
    const request = createImagegenPetRequest({
      id: 'imagegen-1',
      name: 'Moon Cat',
      description: 'a sleepy black cat with a moon collar',
      referenceImage: 'reference.png',
      createdAt: '2026-05-03T12:00:00.000Z',
    })

    expect(request.record).toEqual({
      id: 'imagegen-1',
      name: 'Moon Cat',
      source: 'imagegen',
      renderer: 'spritesheet',
      assetDir: 'assets/pets/custom/imagegen-1',
      manifestPath: 'assets/pets/custom/imagegen-1/pet.json',
      createdAt: '2026-05-03T12:00:00.000Z',
    })
    expect(request.manifest).toMatchObject({
      id: 'imagegen-1',
      name: 'Moon Cat',
      source: 'imagegen',
      renderer: 'spritesheet',
      spritesheet: 'spritesheet.webp',
      cell: { width: 192, height: 208 },
      layout: { columns: 8, rows: 10 },
    })
    expect(Object.keys(request.manifest.states)).toEqual([
      'idle',
      'happy',
      'talking',
      'thinking',
      'sleepy',
      'surprised',
      'focused',
      'offline',
      'sad',
      'walking',
    ])
    expect(request.prompt).toContain('$imagegen')
    expect(request.prompt).toContain('a sleepy black cat with a moon collar')
    expect(request.prompt).toContain('reference.png')
    expect(request.readme).toContain('spritesheet.webp')
    expect(validatePetManifest(request.manifest)).toEqual({ ok: true })
  })

  test('createHatchPetJobs creates base plus ten grounded row jobs', () => {
    const jobs = createHatchPetJobs({
      petName: 'Moon Cat',
      description: 'a sleepy black cat with a moon collar',
      referenceImage: 'reference.png',
    })

    expect(jobs).toHaveLength(11)
    expect(jobs[0]).toMatchObject({
      id: 'base',
      kind: 'base',
      output: 'base-reference.png',
    })
    expect(jobs[0].prompt).toContain('a sleepy black cat with a moon collar')
    expect(jobs[1]).toMatchObject({
      id: 'row-idle',
      kind: 'row',
      state: 'idle',
      row: 0,
      output: 'rows/idle.png',
      inputs: ['base-reference.png', 'reference.png'],
    })
    expect(jobs[10]).toMatchObject({
      id: 'row-walking',
      kind: 'row',
      state: 'walking',
      row: 9,
      output: 'rows/walking.png',
      inputs: ['base-reference.png', 'reference.png'],
    })
    expect(jobs[1].prompt).toContain('8-frame horizontal strip')
    expect(jobs[1].prompt).toContain('idle')
  })

  test('upsertCustomPet replaces existing pet records by id', () => {
    const appearance = normalizeAppearanceConfig({
      customPets: [
        createCustomPetRecord({ id: 'custom-1', name: 'Old', source: 'local-image', renderer: 'image' }),
      ],
    })
    const nextRecord = createCustomPetRecord({ id: 'custom-1', name: 'New', source: 'package', renderer: 'spritesheet' })

    expect(upsertCustomPet(appearance, nextRecord).customPets).toEqual([nextRecord])
  })

  test('removeCustomPet removes custom pets and falls back to cow-cat when active', () => {
    const custom = createCustomPetRecord({ id: 'custom-1', name: 'New', source: 'package', renderer: 'spritesheet' })
    const appearance = setActivePet(normalizeAppearanceConfig({ customPets: [custom] }), 'custom-1')

    expect(removeCustomPet(appearance, 'custom-1')).toEqual({
      mode: 'cow-cat',
      activePetId: COW_CAT_ID,
      customPets: [],
    })
  })

  test('removeCustomPet never removes the built-in cow-cat', () => {
    const custom = createCustomPetRecord({ id: 'custom-1', name: 'New', source: 'package', renderer: 'spritesheet' })
    const appearance = normalizeAppearanceConfig({ customPets: [custom] })

    expect(removeCustomPet(appearance, COW_CAT_ID)).toEqual(appearance)
  })

  test('setActivePet switches built-in and custom modes', () => {
    const custom = createCustomPetRecord({ id: 'custom-1', name: 'New', source: 'package', renderer: 'spritesheet' })
    const appearance = normalizeAppearanceConfig({ customPets: [custom] })

    expect(setActivePet(appearance, 'custom-1')).toMatchObject({
      activePetId: 'custom-1',
      mode: 'custom',
    })
    expect(setActivePet(appearance, COW_CAT_ID)).toMatchObject({
      activePetId: COW_CAT_ID,
      mode: 'cow-cat',
    })
  })
})
