const fs = require('fs')
const os = require('os')
const path = require('path')

const {
  createDefaultProgress,
  normalizeProgress,
  applyFinishedSession,
  PetProgressStore,
} = require('../../pet-progress')

describe('pet progress persistence', () => {
  test('creates default progress with warm chat unlocked', () => {
    expect(createDefaultProgress()).toMatchObject({
      version: 1,
      petLevel: 1,
      focusXp: 0,
      stardust: 0,
      abilityFragments: 0,
      unlockedAbilities: ['warm-chat'],
      activeFocusSession: null,
      focusSessions: [],
      memories: [],
      skillSeeds: [],
      skills: [],
    })
  })

  test('normalizes malformed progress safely', () => {
    expect(normalizeProgress({ focusXp: 160, unlockedAbilities: ['task-echo'] })).toMatchObject({
      petLevel: 3,
      focusXp: 160,
      unlockedAbilities: ['warm-chat', 'task-echo'],
      focusSessions: [],
    })
  })

  test('applies a finished session to xp, currency, memory, and skill seed', () => {
    const progress = normalizeProgress({
      unlockedAbilities: ['warm-chat', 'workflow-lens'],
    })
    const session = {
      id: 'focus-1',
      taskTitle: 'Fix IPC tests',
      intentType: 'Code',
      status: 'completed',
      summary: 'Inspect channels, compare handlers, add tests, run Jest.',
      rewards: {
        focusXp: 60,
        abilityFragments: 2,
        stardust: 7,
        memoryCrystal: true,
        skillSeed: true,
      },
      endedAt: '2026-05-05T10:25:00.000Z',
    }

    const next = applyFinishedSession(progress, session, {
      now: new Date('2026-05-05T10:26:00.000Z'),
    })

    expect(next).toMatchObject({
      petLevel: 2,
      focusXp: 60,
      abilityFragments: 2,
      stardust: 7,
      activeFocusSession: null,
    })
    expect(next.focusSessions).toHaveLength(1)
    expect(next.memories[0]).toMatchObject({ id: 'memory-focus-1' })
    expect(next.skillSeeds[0]).toMatchObject({ id: 'seed-focus-1' })
  })

  test('store loads defaults and saves progress file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-progress-'))
    const filePath = path.join(dir, 'pet-progress.json')
    const store = new PetProgressStore(filePath)

    const progress = await store.load()
    progress.focusXp = 60
    await store.save(progress)

    expect(JSON.parse(fs.readFileSync(filePath, 'utf8')).focusXp).toBe(60)
  })

  test('store backs up corrupt progress before resetting', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-progress-'))
    const filePath = path.join(dir, 'pet-progress.json')
    fs.writeFileSync(filePath, '{ broken json', 'utf8')

    const store = new PetProgressStore(filePath)
    const progress = await store.load()

    expect(progress.focusXp).toBe(0)
    expect(fs.readdirSync(dir).some(name => name.startsWith('pet-progress.json.corrupt-'))).toBe(true)
  })
})
