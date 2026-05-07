const {
  createMemoryCrystal,
  isSkillSeedEligible,
  createSkillSeed,
  createSkillCardFromSeed,
  listSkillCards,
} = require('../../pet-skills')

describe('pet skill and memory helpers', () => {
  const completedSession = {
    id: 'focus-1',
    taskTitle: 'Fix preload IPC tests',
    intentType: 'Code',
    status: 'completed',
    summary: 'Inspect exposed preload channels, compare them with main IPC handlers, add whitelist tests, run Jest.',
    endedAt: '2026-05-05T10:30:00.000Z',
    rewards: { focusXp: 42, abilityFragments: 2, stardust: 8 },
  }

  test('creates a memory crystal from a finished focus session', () => {
    expect(createMemoryCrystal(completedSession)).toEqual({
      id: 'memory-focus-1',
      title: 'Fix preload IPC tests',
      intentType: 'Code',
      status: 'completed',
      summary: completedSession.summary,
      rewards: completedSession.rewards,
      sourceSessionId: 'focus-1',
      createdAt: '2026-05-05T10:30:00.000Z',
    })
  })

  test('detects multi-step summaries as skill seed candidates', () => {
    expect(isSkillSeedEligible(completedSession, {
      unlockedAbilities: ['warm-chat', 'workflow-lens'],
    })).toEqual({ eligible: true, reason: 'repeatable workflow detected' })
  })

  test('does not create seeds for vague summaries without workflow lens', () => {
    expect(isSkillSeedEligible({
      ...completedSession,
      summary: 'Worked on tests.',
    }, { unlockedAbilities: ['warm-chat'] })).toEqual({
      eligible: false,
      reason: 'summary does not describe a reusable workflow',
    })
  })

  test('explicit reusable marker can create a seed before workflow lens', () => {
    expect(isSkillSeedEligible({
      ...completedSession,
      summary: 'Make this reusable: collect screenshots, compare layout, write notes.',
    }, { unlockedAbilities: ['warm-chat'] })).toMatchObject({
      eligible: true,
      reason: 'user marked workflow reusable',
    })
  })

  test('creates deterministic skill seed and card data', () => {
    const seed = createSkillSeed(completedSession, {
      now: new Date('2026-05-05T11:00:00.000Z'),
    })

    expect(seed).toEqual({
      id: 'seed-focus-1',
      title: 'Fix preload IPC tests',
      sourceSessionId: 'focus-1',
      workflowSummary: completedSession.summary,
      status: 'candidate',
      createdAt: '2026-05-05T11:00:00.000Z',
    })

    expect(createSkillCardFromSeed(seed)).toMatchObject({
      id: 'skill-seed-focus-1',
      name: 'Fix preload IPC tests',
      type: 'Workflow',
      rarity: 'rare',
      status: 'candidate',
      level: 1,
      xp: 0,
      requires: ['OpenClaw Hands'],
    })
  })

  test('lists learned skills and candidate seeds as cards', () => {
    const seed = createSkillSeed(completedSession, {
      now: new Date('2026-05-05T11:00:00.000Z'),
    })
    const progress = {
      skills: [{ id: 'skill-existing', name: 'Existing Skill', status: 'learned' }],
      skillSeeds: [seed],
    }

    expect(listSkillCards(progress).map(card => card.id)).toEqual([
      'skill-basic-conversation',
      'skill-existing',
      'skill-seed-focus-1',
    ])
  })

  test('shows basic conversation as the initial learned skill card', () => {
    expect(listSkillCards({ unlockedAbilities: ['warm-chat'] })[0]).toMatchObject({
      id: 'skill-basic-conversation',
      name: 'Basic Conversation',
      type: 'Conversation',
      rarity: 'starter',
      status: 'learned',
      level: 1,
      requires: [],
    })
  })
})
