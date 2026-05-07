const {
  COW_CAT_ID,
  CHAOS_DEVON_REX_ID,
  CHINESE_VILLAGE_DOG_ID,
  LOBSTER_ID,
  BUILT_IN_PET_IDS,
  normalizeAppearanceConfig,
  createBuiltInCowCatManifest,
  createBuiltInChaosDevonRexManifest,
  createBuiltInChineseVillageDogManifest,
  createBuiltInLobsterManifest,
  createBuiltInPetManifests,
  createBuiltInPetRecord,
  isBuiltInPetId,
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
const fs = require('fs')
const path = require('path')

function frameRects(svg, row, column) {
  const start = `<g clip-path="url(#clip-${row}-${column})"><g transform="translate(${column * 192} ${row * 208})">`
  const startIndex = svg.indexOf(start)
  if (startIndex === -1) return []
  const contentStart = startIndex + start.length
  const endIndex = svg.indexOf('</g></g>', contentStart)
  if (endIndex === -1) return []
  return [...svg.slice(contentStart, endIndex).matchAll(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" fill="([^"]+)"\/>/g)]
    .map((rect) => ({
      x: Number(rect[1]),
      y: Number(rect[2]),
      width: Number(rect[3]),
      height: Number(rect[4]),
      fill: rect[5],
    }))
}

function firstFrameRects(svg) {
  return frameRects(svg, 0, 0)
}

function lowerHalfBalance(rects, centerX = 96, minY = 140) {
  let left = 0
  let right = 0
  let minX = Infinity
  let maxX = -Infinity
  for (const rect of rects) {
    if (rect.y + rect.height < minY) continue
    minX = Math.min(minX, rect.x)
    maxX = Math.max(maxX, rect.x + rect.width)
    for (let x = Math.floor(rect.x); x < rect.x + rect.width; x += 1) {
      if (x < centerX) left += rect.height
      else right += rect.height
    }
  }
  return {
    left,
    right,
    ratio: right / Math.max(1, left),
    leftExtent: centerX - minX,
    rightExtent: maxX - centerX,
  }
}

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

  test('normalizeAppearanceConfig migrates retired shanks default to Chinese village dog', () => {
    expect(normalizeAppearanceConfig({
      mode: 'shanks',
      activePetId: 'shanks',
      customPets: [],
    })).toMatchObject({
      mode: CHINESE_VILLAGE_DOG_ID,
      activePetId: CHINESE_VILLAGE_DOG_ID,
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
      motion: { roam: true },
      states: expect.objectContaining({
        idle: { row: 0, frames: 8, duration: 140 },
        happy: { row: 1, frames: 8, duration: 120 },
        talking: { row: 2, frames: 8, duration: 100 },
        thinking: { row: 3, frames: 8, duration: 160 },
        walking: { row: 9, frames: 8, duration: 90 },
      }),
    })
  })

  test('createBuiltInChaosDevonRexManifest declares the second locked default pet', () => {
    expect(createBuiltInChaosDevonRexManifest()).toMatchObject({
      id: CHAOS_DEVON_REX_ID,
      name: 'Chaos Devon Rex',
      source: 'built-in',
      renderer: 'spritesheet',
      spritesheet: 'spritesheet.svg',
      cell: { width: 192, height: 208 },
      layout: { columns: 8, rows: 10 },
      motion: { roam: true },
      states: expect.objectContaining({
        idle: { row: 0, frames: 8, duration: 130 },
        happy: { row: 1, frames: 8, duration: 105 },
        surprised: { row: 5, frames: 8, duration: 95 },
        walking: { row: 9, frames: 8, duration: 85 },
      }),
    })
  })

  test('createBuiltInChineseVillageDogManifest declares the third locked default pet', () => {
    expect(createBuiltInChineseVillageDogManifest()).toMatchObject({
      id: CHINESE_VILLAGE_DOG_ID,
      name: 'Chinese Village Dog',
      source: 'built-in',
      renderer: 'spritesheet',
      spritesheet: 'spritesheet.svg',
      cell: { width: 192, height: 208 },
      layout: { columns: 8, rows: 10 },
      motion: { roam: true },
      states: expect.objectContaining({
        idle: { row: 0, frames: 8, duration: 125 },
        happy: { row: 1, frames: 8, duration: 95 },
        focused: { row: 6, frames: 8, duration: 120 },
        walking: { row: 9, frames: 8, duration: 80 },
      }),
    })
  })

  test('createBuiltInLobsterManifest declares the fourth locked default pet', () => {
    expect(createBuiltInLobsterManifest()).toMatchObject({
      id: LOBSTER_ID,
      name: 'Lobster',
      source: 'built-in',
      renderer: 'spritesheet',
      spritesheet: 'spritesheet.svg',
      cell: { width: 192, height: 208 },
      layout: { columns: 8, rows: 10 },
      motion: { roam: true },
      states: expect.objectContaining({
        idle: { row: 0, frames: 8, duration: 118 },
        happy: { row: 1, frames: 8, duration: 88 },
        surprised: { row: 5, frames: 8, duration: 78 },
        walking: { row: 9, frames: 8, duration: 76 },
      }),
    })
  })

  test('built-in Chinese village dog spritesheet keeps a compact dog silhouette', () => {
    const svg = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'pets', CHINESE_VILLAGE_DOG_ID, 'spritesheet.svg'), 'utf8')
    const tailFills = new Set(['#8f5a2f', '#c98543', '#f0b463'])
    const largeDogRects = [...svg.matchAll(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" fill="([^"]+)"\/>/g)]
      .map((match) => ({
        width: Number(match[3]),
        height: Number(match[4]),
        fill: match[5],
      }))
      .filter((rect) => tailFills.has(rect.fill))

    expect((svg.match(/<g clip-path=/g) || []).length).toBe(80)
    expect(largeDogRects.some((rect) => rect.width > 82 || rect.height > 70)).toBe(false)
  })

  test('built-in lobster spritesheet keeps a compact clawed silhouette', () => {
    const svg = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'pets', LOBSTER_ID, 'spritesheet.svg'), 'utf8')
    const clawRects = [...svg.matchAll(/<rect x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)" fill="([^"]+)"\/>/g)]
      .map((match) => ({
        width: Number(match[3]),
        height: Number(match[4]),
        fill: match[5],
      }))
      .filter((rect) => ['#b82020', '#e63d2e', '#ff6b4a'].includes(rect.fill))

    expect((svg.match(/<g clip-path=/g) || []).length).toBe(80)
    expect(clawRects.some((rect) => rect.width >= 22 && rect.height >= 16)).toBe(true)
  })

  test('built-in lobster idle pose has balanced lower legs', () => {
    const svg = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'pets', LOBSTER_ID, 'spritesheet.svg'), 'utf8')
    const balance = lowerHalfBalance(firstFrameRects(svg))

    expect(balance.ratio).toBeGreaterThan(0.82)
    expect(balance.ratio).toBeLessThan(1.22)
    expect(balance.rightExtent).toBeLessThanOrEqual(balance.leftExtent + 12)
  })

  test('built-in lobster idle face avoids oversized dark lip bars', () => {
    const svg = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'pets', LOBSTER_ID, 'spritesheet.svg'), 'utf8')
    const darkBars = firstFrameRects(svg)
      .filter((rect) => ['#111111', '#6f1114'].includes(rect.fill))
      .filter((rect) => rect.y >= 118 && rect.y <= 150 && rect.height <= 5 && rect.width > 22)

    expect(darkBars).toEqual([])
  })

  test('built-in lobster walking keeps both eyes open', () => {
    const svg = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'pets', LOBSTER_ID, 'spritesheet.svg'), 'utf8')
    const walkingRects = frameRects(svg, 9, 0)
    const openEyeHighlights = walkingRects
      .filter((rect) => rect.fill === '#fff4df')
      .filter((rect) => rect.y >= 60 && rect.y <= 82 && rect.width >= 14 && rect.height >= 12)
    const closedEyeBars = walkingRects
      .filter((rect) => rect.fill === '#111111')
      .filter((rect) => rect.y >= 72 && rect.y <= 82 && rect.width >= 14 && rect.height <= 5)

    expect(openEyeHighlights).toHaveLength(2)
    expect(closedEyeBars).toEqual([])
  })

  test('built-in lobster thinking pose shows a visible thought cue', () => {
    const svg = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'pets', LOBSTER_ID, 'spritesheet.svg'), 'utf8')
    const thinkingRects = frameRects(svg, 3, 0)
    const thoughtCueRects = thinkingRects
      .filter((rect) => rect.fill === '#fff4df')
      .filter((rect) => rect.x >= 136 && rect.y >= 38 && rect.y <= 70 && rect.width <= 12)

    expect(thoughtCueRects.length).toBeGreaterThanOrEqual(4)
  })

  test('built-in pet helpers expose all default pets as locked records', () => {
    expect(BUILT_IN_PET_IDS).toEqual([COW_CAT_ID, CHAOS_DEVON_REX_ID, CHINESE_VILLAGE_DOG_ID, LOBSTER_ID])
    expect(createBuiltInPetManifests().map(pet => pet.id)).toEqual(BUILT_IN_PET_IDS)
    expect(isBuiltInPetId(COW_CAT_ID)).toBe(true)
    expect(isBuiltInPetId(CHAOS_DEVON_REX_ID)).toBe(true)
    expect(isBuiltInPetId(CHINESE_VILLAGE_DOG_ID)).toBe(true)
    expect(isBuiltInPetId(LOBSTER_ID)).toBe(true)
    expect(isBuiltInPetId('custom-1')).toBe(false)
    expect(createBuiltInPetRecord(createBuiltInChaosDevonRexManifest())).toMatchObject({
      id: CHAOS_DEVON_REX_ID,
      source: 'built-in',
      renderer: 'spritesheet',
      assetDir: 'assets/pets/chaos-devon-rex',
      manifestPath: 'assets/pets/chaos-devon-rex/pet.json',
      locked: true,
    })
    expect(createBuiltInPetRecord(createBuiltInChineseVillageDogManifest())).toMatchObject({
      id: CHINESE_VILLAGE_DOG_ID,
      source: 'built-in',
      renderer: 'spritesheet',
      assetDir: 'assets/pets/chinese-village-dog',
      manifestPath: 'assets/pets/chinese-village-dog/pet.json',
      locked: true,
    })
    expect(createBuiltInPetRecord(createBuiltInLobsterManifest())).toMatchObject({
      id: LOBSTER_ID,
      source: 'built-in',
      renderer: 'spritesheet',
      assetDir: 'assets/pets/lobster',
      manifestPath: 'assets/pets/lobster/pet.json',
      locked: true,
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
      motion: { roam: false },
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
    expect(request.prompt).toContain('full-body virtual pet')
    expect(request.prompt).toContain('headshot, avatar, or face-only')
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
    expect(jobs[0].prompt).toContain('full-body character reference')
    expect(jobs[1].prompt).toContain('full body visible')
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

  test('removeCustomPet never removes built-in default pets', () => {
    const custom = createCustomPetRecord({ id: 'custom-1', name: 'New', source: 'package', renderer: 'spritesheet' })
    const appearance = normalizeAppearanceConfig({ customPets: [custom] })

    expect(removeCustomPet(appearance, COW_CAT_ID)).toEqual(appearance)
    expect(removeCustomPet(appearance, CHAOS_DEVON_REX_ID)).toEqual(appearance)
    expect(removeCustomPet(appearance, CHINESE_VILLAGE_DOG_ID)).toEqual(appearance)
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
    expect(setActivePet(appearance, CHAOS_DEVON_REX_ID)).toMatchObject({
      activePetId: CHAOS_DEVON_REX_ID,
      mode: CHAOS_DEVON_REX_ID,
    })
    expect(setActivePet(appearance, CHINESE_VILLAGE_DOG_ID)).toMatchObject({
      activePetId: CHINESE_VILLAGE_DOG_ID,
      mode: CHINESE_VILLAGE_DOG_ID,
    })
  })
})
