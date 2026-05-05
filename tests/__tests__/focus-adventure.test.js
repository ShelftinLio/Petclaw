const {
  INTENT_TYPES,
  startFocusAdventure,
  finishFocusAdventure,
  calculateRewards,
} = require('../../focus-adventure')

describe('focus adventure lifecycle', () => {
  const startedAt = new Date('2026-05-05T10:00:00.000Z')
  const endedAt = new Date('2026-05-05T10:25:00.000Z')

  test('starts a normalized focus adventure session', () => {
    expect(startFocusAdventure({
      taskTitle: '  Fix failing tests  ',
      plannedMinutes: 25,
      intentType: 'Code',
      now: startedAt,
    })).toMatchObject({
      id: 'focus-20260505-100000',
      taskTitle: 'Fix failing tests',
      plannedMinutes: 25,
      actualMinutes: 0,
      intentType: 'Code',
      status: 'active',
      startedAt: '2026-05-05T10:00:00.000Z',
    })
  })

  test('falls back to safe title, duration, and intent', () => {
    expect(startFocusAdventure({
      taskTitle: '',
      plannedMinutes: 999,
      intentType: 'Unknown',
      now: startedAt,
    })).toMatchObject({
      taskTitle: 'Focus Adventure',
      plannedMinutes: 25,
      intentType: 'Planning',
    })
    expect(INTENT_TYPES).toContain('Rest')
  })

  test('calculates useful completed rewards with memory and skill seed', () => {
    const rewards = calculateRewards({
      actualMinutes: 25,
      plannedMinutes: 25,
      status: 'completed',
      summary: 'Inspect logs, compare errors, add test, run Jest.',
      skillSeedEligible: true,
    })

    expect(rewards).toEqual({
      focusXp: 60,
      abilityFragments: 2,
      stardust: 7,
      memoryCrystal: true,
      skillSeed: true,
    })
  })

  test('interrupted sessions still receive small non-punitive rewards', () => {
    expect(calculateRewards({
      actualMinutes: 4,
      plannedMinutes: 25,
      status: 'interrupted',
      summary: '',
      skillSeedEligible: false,
    })).toEqual({
      focusXp: 3,
      abilityFragments: 0,
      stardust: 1,
      memoryCrystal: false,
      skillSeed: false,
    })
  })

  test('finishes a session with actual minutes and rewards', () => {
    const active = startFocusAdventure({
      taskTitle: 'Fix failing tests',
      plannedMinutes: 25,
      intentType: 'Code',
      now: startedAt,
    })

    const finished = finishFocusAdventure(active, {
      status: 'completed',
      summary: 'Inspect logs, compare errors, add test, run Jest.',
      now: endedAt,
      skillSeedEligible: true,
    })

    expect(finished).toMatchObject({
      id: active.id,
      actualMinutes: 25,
      status: 'completed',
      summary: 'Inspect logs, compare errors, add test, run Jest.',
      endedAt: '2026-05-05T10:25:00.000Z',
      rewards: {
        focusXp: 60,
        abilityFragments: 2,
        stardust: 7,
        memoryCrystal: true,
        skillSeed: true,
      },
    })
  })
})
