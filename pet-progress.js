const fs = require('fs')
const fsp = require('fs').promises
const path = require('path')

const { calculatePetLevel, unlockAbility: unlockAbilityCore } = require('./pet-abilities')
const {
  AFFINITY_EVENT_TYPES,
  applyAffinityEvent,
  normalizeAffinity,
} = require('./pet-affinity')
const {
  createMemoryCrystal,
  createSkillSeed,
  createSkillCardFromSeed,
  isSkillSeedEligible,
  listSkillCards,
} = require('./pet-skills')

function createDefaultProgress() {
  return {
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
    affinityXp: 0,
    affinityLevel: 1,
    bondItems: [],
    interactionStats: {
      dailyAffinity: {
        date: '',
        clickXp: 0,
        chatXp: 0,
        voiceXp: 0,
      },
      totalClicks: 0,
      totalTextMessages: 0,
      totalVoiceInteractions: 0,
      totalAffinityEvents: 0,
      lastInteractionAt: '',
    },
  }
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)))
}

function normalizeProgress(raw = {}) {
  const base = createDefaultProgress()
  const focusXp = Math.max(0, Number(raw.focusXp || 0))
  const unlockedAbilities = unique([
    ...base.unlockedAbilities,
    ...(Array.isArray(raw.unlockedAbilities) ? raw.unlockedAbilities : []),
  ])
  return normalizeAffinity({
    ...base,
    ...raw,
    version: 1,
    petLevel: calculatePetLevel(focusXp),
    focusXp,
    stardust: Math.max(0, Number(raw.stardust || 0)),
    abilityFragments: Math.max(0, Number(raw.abilityFragments || 0)),
    unlockedAbilities,
    activeFocusSession: raw.activeFocusSession && raw.activeFocusSession.status === 'active'
      ? raw.activeFocusSession
      : null,
    focusSessions: Array.isArray(raw.focusSessions) ? raw.focusSessions : [],
    memories: Array.isArray(raw.memories) ? raw.memories : [],
    skillSeeds: Array.isArray(raw.skillSeeds) ? raw.skillSeeds : [],
    skills: Array.isArray(raw.skills) ? raw.skills : [],
  })
}

function applyFocusAffinityRewards(progress = {}, session = {}, options = {}) {
  let next = normalizeProgress(progress)
  const now = options.now || new Date()
  const appliedEvents = []

  function apply(eventType) {
    const result = applyAffinityEvent(next, eventType, { now })
    next = result.progress
    appliedEvents.push({
      eventType,
      appliedXp: result.appliedXp,
      capped: result.capped,
      levelChanged: result.levelChanged,
      unlockedBondItems: result.unlockedBondItems,
      reaction: result.reaction,
    })
  }

  const finishedWithProgress = ['completed', 'partial'].includes(session.status)

  if (finishedWithProgress) {
    apply(AFFINITY_EVENT_TYPES.FOCUS_FINISHED)
  }

  if (finishedWithProgress && String(session.summary || '').trim()) {
    apply(AFFINITY_EVENT_TYPES.FOCUS_SUMMARY)
  }

  if (session.rewards?.memoryCrystal) {
    apply(AFFINITY_EVENT_TYPES.MEMORY_CREATED)
  }

  return {
    progress: next,
    affinityEvents: appliedEvents,
  }
}

function settleFinishedSession(progress = {}, session = {}, { now = new Date() } = {}) {
  const normalized = normalizeProgress(progress)
  const rewards = session.rewards || {}
  let next = {
    ...normalized,
    focusXp: normalized.focusXp + Number(rewards.focusXp || 0),
    abilityFragments: normalized.abilityFragments + Number(rewards.abilityFragments || 0),
    stardust: normalized.stardust + Number(rewards.stardust || 0),
    activeFocusSession: null,
    focusSessions: [...normalized.focusSessions, session],
  }

  if (rewards.memoryCrystal) {
    next.memories = [...next.memories, createMemoryCrystal(session)]
  }

  const seedCheck = isSkillSeedEligible(session, normalized)
  if (rewards.skillSeed && seedCheck.eligible) {
    next.skillSeeds = [...next.skillSeeds, createSkillSeed(session, { now })]
  }

  next.petLevel = calculatePetLevel(next.focusXp)
  const affinity = applyFocusAffinityRewards(next, session, { now })
  return {
    progress: normalizeProgress(affinity.progress),
    affinityEvents: affinity.affinityEvents,
  }
}

function applyFinishedSession(progress = {}, session = {}, options = {}) {
  return settleFinishedSession(progress, session, options).progress
}

class PetProgressStore {
  constructor(filePath) {
    this.filePath = filePath || path.join(__dirname, 'pet-progress.json')
    this.progress = createDefaultProgress()
  }

  async load() {
    try {
      const raw = JSON.parse(await fsp.readFile(this.filePath, 'utf8'))
      this.progress = normalizeProgress(raw)
      return this.progress
    } catch (err) {
      if (err.code !== 'ENOENT') {
        await this.backupCorruptFile()
      }
      this.progress = createDefaultProgress()
      await this.save(this.progress)
      return this.progress
    }
  }

  async backupCorruptFile() {
    if (!fs.existsSync(this.filePath)) return
    const backupPath = `${this.filePath}.corrupt-${Date.now()}`
    await fsp.copyFile(this.filePath, backupPath)
  }

  async save(progress = this.progress) {
    this.progress = normalizeProgress(progress)
    await fsp.mkdir(path.dirname(this.filePath), { recursive: true })
    await fsp.writeFile(this.filePath, JSON.stringify(this.progress, null, 2), 'utf8')
    return this.progress
  }

  async update(mutator) {
    const current = this.progress || await this.load()
    const next = normalizeProgress(mutator(current))
    return this.save(next)
  }

  get() {
    return normalizeProgress(this.progress)
  }
}

function unlockAbility(progress, abilityId) {
  return normalizeProgress(unlockAbilityCore(progress, abilityId))
}

function learnSkillFromSeed(progress = {}, seedId, { now = new Date() } = {}) {
  const normalized = normalizeProgress(progress)
  const seed = normalized.skillSeeds.find(item => item.id === seedId)
  if (!seed) {
    const error = new Error('Skill seed not found')
    error.code = 'SKILL_SEED_NOT_FOUND'
    throw error
  }

  const skillId = `skill-${seed.id}`
  if (normalized.skills.some(skill => skill.id === skillId || skill.sourceSeedId === seed.id)) {
    const error = new Error('Skill already learned')
    error.code = 'SKILL_ALREADY_LEARNED'
    throw error
  }

  const learnedAt = (now instanceof Date ? now : new Date(now)).toISOString()
  const skill = {
    ...createSkillCardFromSeed(seed),
    status: 'learned',
    learnedAt,
  }

  return normalizeProgress({
    ...normalized,
    skillSeeds: normalized.skillSeeds.filter(item => item.id !== seed.id),
    skills: [...normalized.skills, skill],
  })
}

module.exports = {
  createDefaultProgress,
  normalizeProgress,
  applyFinishedSession,
  settleFinishedSession,
  applyFocusAffinityRewards,
  unlockAbility,
  learnSkillFromSeed,
  listSkillCards,
  PetProgressStore,
}
