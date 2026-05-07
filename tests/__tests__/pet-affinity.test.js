const {
  AFFINITY_EVENT_TYPES,
  AFFINITY_LEVELS,
  BOND_ITEMS,
  applyAffinityEvent,
  calculateAffinityLevel,
  getAffinityTier,
  normalizeAffinity,
} = require('../../pet-affinity')

describe('pet affinity rules', () => {
  const now = new Date('2026-05-07T09:30:00.000Z')

  test('calculates affinity levels from configured thresholds', () => {
    expect(AFFINITY_LEVELS.map(level => level.id)).toEqual([
      'first-meeting',
      'familiar',
      'close',
      'trusted',
      'bonded',
    ])
    expect(calculateAffinityLevel(0)).toBe(1)
    expect(calculateAffinityLevel(39)).toBe(1)
    expect(calculateAffinityLevel(40)).toBe(2)
    expect(calculateAffinityLevel(120)).toBe(3)
    expect(calculateAffinityLevel(260)).toBe(4)
    expect(calculateAffinityLevel(480)).toBe(5)
    expect(getAffinityTier(120)).toMatchObject({ level: 3, id: 'close', nextXp: 260 })
  })

  test('normalizes old progress with affinity defaults and derived bond items', () => {
    const progress = normalizeAffinity({
      affinityXp: 260,
      affinityLevel: 1,
      bondItems: [{ id: 'small-toy', levelRequired: 2, unlockedAt: '2026-05-06T01:00:00.000Z' }],
    }, { now })

    expect(progress).toMatchObject({
      affinityXp: 260,
      affinityLevel: 4,
    })
    expect(progress.interactionStats.dailyAffinity).toMatchObject({
      date: '2026-05-07',
      clickXp: 0,
      chatXp: 0,
      voiceXp: 0,
    })
    expect(progress.bondItems.map(item => item.id)).toEqual(['small-toy', 'bond-sticker', 'cozy-nest'])
    expect(progress.bondItems.find(item => item.id === 'small-toy').unlockedAt).toBe('2026-05-06T01:00:00.000Z')
    expect(BOND_ITEMS.find(item => item.id === 'bond-badge')).toMatchObject({ levelRequired: 5 })
  })

  test('applies daily caps for click, text, and voice affinity', () => {
    let progress = normalizeAffinity({}, { now })
    for (let i = 0; i < 25; i += 1) {
      progress = applyAffinityEvent(progress, AFFINITY_EVENT_TYPES.PET_CLICK, { now }).progress
    }
    expect(progress.affinityXp).toBe(20)
    expect(progress.interactionStats.dailyAffinity.clickXp).toBe(20)

    const cappedClick = applyAffinityEvent(progress, AFFINITY_EVENT_TYPES.PET_CLICK, { now })
    expect(cappedClick).toMatchObject({ appliedXp: 0, capped: true, reaction: 'happy' })
    expect(cappedClick.progress.affinityXp).toBe(20)

    for (let i = 0; i < 12; i += 1) {
      progress = applyAffinityEvent(progress, AFFINITY_EVENT_TYPES.TEXT_MESSAGE, { now }).progress
    }
    expect(progress.interactionStats.dailyAffinity.chatXp).toBe(20)
    expect(progress.affinityXp).toBe(40)

    for (let i = 0; i < 7; i += 1) {
      progress = applyAffinityEvent(progress, AFFINITY_EVENT_TYPES.VOICE_MESSAGE, { now }).progress
    }
    expect(progress.interactionStats.dailyAffinity.voiceXp).toBe(15)
    expect(progress.affinityXp).toBe(55)
  })

  test('resets capped counters on the next local date', () => {
    const progress = normalizeAffinity({
      affinityXp: 20,
      interactionStats: {
        dailyAffinity: {
          date: '2026-05-06',
          clickXp: 20,
          chatXp: 20,
          voiceXp: 15,
        },
      },
    }, { now })

    const result = applyAffinityEvent(progress, AFFINITY_EVENT_TYPES.PET_CLICK, { now })

    expect(result).toMatchObject({ appliedXp: 1, capped: false })
    expect(result.progress.interactionStats.dailyAffinity).toMatchObject({
      date: '2026-05-07',
      clickXp: 1,
      chatXp: 0,
      voiceXp: 0,
    })
  })

  test('applies uncapped focus and memory rewards and reports unlocks once', () => {
    let result = applyAffinityEvent(normalizeAffinity({ affinityXp: 35 }, { now }), AFFINITY_EVENT_TYPES.FOCUS_FINISHED, { now })
    expect(result).toMatchObject({
      appliedXp: 8,
      levelChanged: true,
      reaction: 'surprised',
    })
    expect(result.unlockedBondItems.map(item => item.id)).toEqual(['small-toy'])

    result = applyAffinityEvent(result.progress, AFFINITY_EVENT_TYPES.FOCUS_SUMMARY, { now })
    expect(result.appliedXp).toBe(4)
    expect(result.unlockedBondItems).toEqual([])

    result = applyAffinityEvent(result.progress, AFFINITY_EVENT_TYPES.MEMORY_CREATED, { now })
    expect(result.appliedXp).toBe(5)
    expect(result.progress.affinityXp).toBe(52)
    expect(result.progress.bondItems.map(item => item.id)).toEqual(['small-toy'])
  })
})
