const {
  ABILITY_IDS,
  calculatePetLevel,
  getAbilityById,
  getAbilityTree,
  canUnlockAbility,
  unlockAbility,
} = require('../../pet-abilities')

describe('pet ability progression', () => {
  test('calculates visible pet level from focus xp', () => {
    expect(calculatePetLevel(0)).toBe(1)
    expect(calculatePetLevel(59)).toBe(1)
    expect(calculatePetLevel(60)).toBe(2)
    expect(calculatePetLevel(160)).toBe(3)
    expect(calculatePetLevel(320)).toBe(4)
    expect(calculatePetLevel(520)).toBe(5)
  })

  test('looks up ability metadata by id', () => {
    expect(getAbilityById(ABILITY_IDS.OPENCLAW_HANDS)).toMatchObject({
      id: 'openclaw-hands',
      name: 'OpenClaw Hands',
      tier: 'Operator',
      levelRequired: 4,
    })
  })

  test('starts with basic conversation before OpenClaw execution skills', () => {
    expect(ABILITY_IDS.BASIC_CONVERSATION).toBe('warm-chat')
    expect(getAbilityById(ABILITY_IDS.BASIC_CONVERSATION)).toMatchObject({
      id: 'warm-chat',
      name: 'Basic Conversation',
      tier: 'Companion',
      levelRequired: 1,
      cost: 0,
    })
  })

  test('builds ability tree with locked and unlocked states', () => {
    const tree = getAbilityTree({
      focusXp: 170,
      abilityFragments: 4,
      unlockedAbilities: ['warm-chat', 'task-echo'],
    })

    expect(tree.petLevel).toBe(3)
    expect(tree.abilities.find(a => a.id === 'task-echo')).toMatchObject({
      unlocked: true,
      canUnlock: false,
    })
    expect(tree.abilities.find(a => a.id === 'workflow-lens')).toMatchObject({
      unlocked: false,
      canUnlock: true,
    })
    expect(tree.abilities.find(a => a.id === 'openclaw-hands')).toMatchObject({
      unlocked: false,
      canUnlock: false,
      lockedReason: 'Requires pet level 4',
    })
  })

  test('prevents unlocking without enough fragments or required level', () => {
    expect(canUnlockAbility({
      focusXp: 159,
      abilityFragments: 10,
      unlockedAbilities: ['warm-chat'],
    }, 'workflow-lens')).toMatchObject({
      ok: false,
      reason: 'Requires pet level 3',
    })

    expect(canUnlockAbility({
      focusXp: 170,
      abilityFragments: 1,
      unlockedAbilities: ['warm-chat'],
    }, 'workflow-lens')).toMatchObject({
      ok: false,
      reason: 'Requires 3 ability fragments',
    })
  })

  test('unlocks an ability and spends fragments immutably', () => {
    const progress = {
      focusXp: 170,
      abilityFragments: 4,
      unlockedAbilities: ['warm-chat'],
    }

    const next = unlockAbility(progress, 'workflow-lens')

    expect(next).toMatchObject({
      abilityFragments: 1,
      unlockedAbilities: ['warm-chat', 'workflow-lens'],
    })
    expect(progress.unlockedAbilities).toEqual(['warm-chat'])
  })
})
