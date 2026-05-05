const fs = require('fs')
const fsp = require('fs').promises
const path = require('path')

const { calculatePetLevel, unlockAbility: unlockAbilityCore } = require('./pet-abilities')
const {
  createMemoryCrystal,
  createSkillSeed,
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
  return {
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
  }
}

function applyFinishedSession(progress = {}, session = {}, { now = new Date() } = {}) {
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
  return normalizeProgress(next)
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

module.exports = {
  createDefaultProgress,
  normalizeProgress,
  applyFinishedSession,
  unlockAbility,
  listSkillCards,
  PetProgressStore,
}
