const ABILITY_IDS = {
  BASIC_CONVERSATION: 'warm-chat',
  WARM_CHAT: 'warm-chat',
  TASK_ECHO: 'task-echo',
  PROJECT_GLANCE: 'project-glance',
  ADVENTURE_JOURNAL: 'adventure-journal',
  NEXT_STEP: 'next-step',
  WORKFLOW_LENS: 'workflow-lens',
  OPENCLAW_HANDS: 'openclaw-hands',
  SKILL_BOOK: 'skill-book',
  SKILL_FORGE: 'skill-forge',
}

const LEVEL_THRESHOLDS = [
  { level: 1, xp: 0, tier: 'Companion' },
  { level: 2, xp: 60, tier: 'Observer' },
  { level: 3, xp: 160, tier: 'Planner' },
  { level: 4, xp: 320, tier: 'Operator' },
  { level: 5, xp: 520, tier: 'Skillbearer' },
]

const ABILITIES = [
  {
    id: ABILITY_IDS.WARM_CHAT,
    name: 'Basic Conversation',
    tier: 'Companion',
    levelRequired: 1,
    cost: 0,
    description: 'Initial AI conversation with pet personality. OpenClaw execution skills unlock later.',
  },
  {
    id: ABILITY_IDS.TASK_ECHO,
    name: 'Task Echo',
    tier: 'Companion',
    levelRequired: 1,
    cost: 1,
    description: 'The pet remembers the current focus adventure title in chat.',
  },
  {
    id: ABILITY_IDS.PROJECT_GLANCE,
    name: 'Project Glance',
    tier: 'Observer',
    levelRequired: 2,
    cost: 2,
    description: 'The pet can summarize safe app-level project signals.',
  },
  {
    id: ABILITY_IDS.ADVENTURE_JOURNAL,
    name: 'Adventure Journal',
    tier: 'Observer',
    levelRequired: 2,
    cost: 2,
    description: 'Completed focus sessions become short Memory Crystals.',
  },
  {
    id: ABILITY_IDS.NEXT_STEP,
    name: 'Next Step',
    tier: 'Planner',
    levelRequired: 3,
    cost: 3,
    description: 'The pet suggests a next action after a focus session.',
  },
  {
    id: ABILITY_IDS.WORKFLOW_LENS,
    name: 'Workflow Lens',
    tier: 'Planner',
    levelRequired: 3,
    cost: 3,
    description: 'The pet detects repeatable workflows that could become skills.',
  },
  {
    id: ABILITY_IDS.OPENCLAW_HANDS,
    name: 'OpenClaw Hands',
    tier: 'Operator',
    levelRequired: 4,
    cost: 5,
    description: 'The pet can request permission to hand work to OpenClaw-capable execution.',
  },
  {
    id: ABILITY_IDS.SKILL_BOOK,
    name: 'Skill Book',
    tier: 'Skillbearer',
    levelRequired: 5,
    cost: 4,
    description: 'Learned and draft skills are visible as pet skill cards.',
  },
  {
    id: ABILITY_IDS.SKILL_FORGE,
    name: 'Skill Forge',
    tier: 'Skillbearer',
    levelRequired: 5,
    cost: 6,
    description: 'A completed workflow summary can become a draft skill card.',
  },
]

function calculatePetLevel(focusXp = 0) {
  const xp = Number.isFinite(Number(focusXp)) ? Number(focusXp) : 0
  return LEVEL_THRESHOLDS.reduce((level, threshold) => (
    xp >= threshold.xp ? threshold.level : level
  ), 1)
}

function getAbilityById(id) {
  return ABILITIES.find(ability => ability.id === id) || null
}

function normalizeUnlocked(progress = {}) {
  const unlocked = Array.isArray(progress.unlockedAbilities) ? progress.unlockedAbilities : []
  return Array.from(new Set([ABILITY_IDS.WARM_CHAT, ...unlocked]))
}

function canUnlockAbility(progress = {}, abilityId) {
  const ability = getAbilityById(abilityId)
  if (!ability) return { ok: false, reason: 'Unknown ability' }

  const unlocked = normalizeUnlocked(progress)
  if (unlocked.includes(ability.id)) return { ok: false, reason: 'Already unlocked' }

  const petLevel = calculatePetLevel(progress.focusXp)
  if (petLevel < ability.levelRequired) {
    return { ok: false, reason: `Requires pet level ${ability.levelRequired}` }
  }

  const fragments = Number(progress.abilityFragments || 0)
  if (fragments < ability.cost) {
    return { ok: false, reason: `Requires ${ability.cost} ability fragments` }
  }

  return { ok: true, ability }
}

function getAbilityTree(progress = {}) {
  const petLevel = calculatePetLevel(progress.focusXp)
  const unlocked = normalizeUnlocked(progress)
  const abilities = ABILITIES.map((ability) => {
    const isUnlocked = unlocked.includes(ability.id)
    const check = canUnlockAbility(progress, ability.id)
    return {
      ...ability,
      unlocked: isUnlocked,
      canUnlock: !isUnlocked && check.ok,
      lockedReason: isUnlocked ? '' : check.ok ? '' : check.reason,
    }
  })

  return { petLevel, abilities, tiers: LEVEL_THRESHOLDS }
}

function unlockAbility(progress = {}, abilityId) {
  const check = canUnlockAbility(progress, abilityId)
  if (!check.ok) {
    const error = new Error(check.reason)
    error.code = 'ABILITY_LOCKED'
    throw error
  }

  return {
    ...progress,
    abilityFragments: Number(progress.abilityFragments || 0) - check.ability.cost,
    unlockedAbilities: [...normalizeUnlocked(progress), abilityId],
  }
}

module.exports = {
  ABILITY_IDS,
  LEVEL_THRESHOLDS,
  ABILITIES,
  calculatePetLevel,
  getAbilityById,
  getAbilityTree,
  canUnlockAbility,
  unlockAbility,
}
