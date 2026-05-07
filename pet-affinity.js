const AFFINITY_EVENT_TYPES = {
  PET_CLICK: 'pet-click',
  TEXT_MESSAGE: 'text-message',
  VOICE_MESSAGE: 'voice-message',
  FOCUS_FINISHED: 'focus-finished',
  FOCUS_SUMMARY: 'focus-summary',
  MEMORY_CREATED: 'memory-created',
}

const AFFINITY_LEVELS = [
  { level: 1, id: 'first-meeting', name: 'First Meeting', xp: 0 },
  { level: 2, id: 'familiar', name: 'Familiar', xp: 40 },
  { level: 3, id: 'close', name: 'Close', xp: 120 },
  { level: 4, id: 'trusted', name: 'Trusted', xp: 260 },
  { level: 5, id: 'bonded', name: 'Bonded', xp: 480 },
]

const BOND_ITEMS = [
  { id: 'small-toy', name: 'Small Toy', levelRequired: 2 },
  { id: 'bond-sticker', name: 'Bond Sticker', levelRequired: 3 },
  { id: 'cozy-nest', name: 'Cozy Nest', levelRequired: 4 },
  { id: 'bond-badge', name: 'Bond Badge', levelRequired: 5 },
]

const EVENT_REWARDS = {
  [AFFINITY_EVENT_TYPES.PET_CLICK]: {
    xp: 1,
    capField: 'clickXp',
    cap: 20,
    statField: 'totalClicks',
    reaction: 'happy',
  },
  [AFFINITY_EVENT_TYPES.TEXT_MESSAGE]: {
    xp: 2,
    capField: 'chatXp',
    cap: 20,
    statField: 'totalTextMessages',
    reaction: 'talking',
  },
  [AFFINITY_EVENT_TYPES.VOICE_MESSAGE]: {
    xp: 3,
    capField: 'voiceXp',
    cap: 15,
    statField: 'totalVoiceInteractions',
    reaction: 'talking',
  },
  [AFFINITY_EVENT_TYPES.FOCUS_FINISHED]: {
    xp: 8,
    reaction: 'thinking',
  },
  [AFFINITY_EVENT_TYPES.FOCUS_SUMMARY]: {
    xp: 4,
    reaction: 'happy',
  },
  [AFFINITY_EVENT_TYPES.MEMORY_CREATED]: {
    xp: 5,
    reaction: 'happy',
  },
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function formatLocalDate(now = new Date()) {
  const date = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(date.getTime())) return formatLocalDate(new Date())
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

function calculateAffinityLevel(affinityXp = 0) {
  const xp = Math.max(0, toNumber(affinityXp))
  return AFFINITY_LEVELS.reduce((level, threshold) => (
    xp >= threshold.xp ? threshold.level : level
  ), 1)
}

function getAffinityTier(affinityXp = 0) {
  const level = calculateAffinityLevel(affinityXp)
  const tier = AFFINITY_LEVELS.find(item => item.level === level) || AFFINITY_LEVELS[0]
  const next = AFFINITY_LEVELS.find(item => item.level === level + 1) || null
  return {
    ...tier,
    currentXp: Math.max(0, toNumber(affinityXp)),
    nextXp: next ? next.xp : null,
  }
}

function getBondItemsForLevel(affinityLevel = 1) {
  const level = Math.max(1, toNumber(affinityLevel, 1))
  return BOND_ITEMS.filter(item => level >= item.levelRequired)
}

function normalizeDailyAffinity(rawDaily = {}, { now = new Date() } = {}) {
  const today = formatLocalDate(now)
  if (rawDaily.date !== today) {
    return {
      date: today,
      clickXp: 0,
      chatXp: 0,
      voiceXp: 0,
    }
  }

  return {
    date: today,
    clickXp: Math.max(0, toNumber(rawDaily.clickXp)),
    chatXp: Math.max(0, toNumber(rawDaily.chatXp)),
    voiceXp: Math.max(0, toNumber(rawDaily.voiceXp)),
  }
}

function normalizeInteractionStats(rawStats = {}, options = {}) {
  return {
    dailyAffinity: normalizeDailyAffinity(rawStats.dailyAffinity, options),
    totalClicks: Math.max(0, toNumber(rawStats.totalClicks)),
    totalTextMessages: Math.max(0, toNumber(rawStats.totalTextMessages)),
    totalVoiceInteractions: Math.max(0, toNumber(rawStats.totalVoiceInteractions)),
    totalAffinityEvents: Math.max(0, toNumber(rawStats.totalAffinityEvents)),
    lastInteractionAt: String(rawStats.lastInteractionAt || ''),
  }
}

function normalizeBondItems(rawItems = [], affinityLevel = 1, { now = new Date() } = {}) {
  const existingById = new Map()
  if (Array.isArray(rawItems)) {
    for (const item of rawItems) {
      if (!item || !item.id || existingById.has(item.id)) continue
      existingById.set(item.id, {
        id: String(item.id),
        levelRequired: Math.max(1, toNumber(item.levelRequired, 1)),
        unlockedAt: String(item.unlockedAt || ''),
      })
    }
  }

  const unlockedAt = (now instanceof Date ? now : new Date(now)).toISOString()
  const items = []
  for (const item of getBondItemsForLevel(affinityLevel)) {
    const existing = existingById.get(item.id)
    items.push({
      id: item.id,
      levelRequired: item.levelRequired,
      unlockedAt: existing?.unlockedAt || unlockedAt,
    })
  }
  return items
}

function normalizeAffinity(progress = {}, options = {}) {
  const affinityXp = Math.max(0, toNumber(progress.affinityXp))
  const affinityLevel = calculateAffinityLevel(affinityXp)
  return {
    ...progress,
    affinityXp,
    affinityLevel,
    bondItems: normalizeBondItems(progress.bondItems, affinityLevel, options),
    interactionStats: normalizeInteractionStats(progress.interactionStats, options),
  }
}

function applyDailyCap(dailyAffinity, reward) {
  if (!reward.capField || !reward.cap) {
    return { appliedXp: reward.xp, capped: false, dailyAffinity }
  }

  const used = Math.max(0, toNumber(dailyAffinity[reward.capField]))
  const remaining = Math.max(0, reward.cap - used)
  const appliedXp = Math.min(reward.xp, remaining)
  return {
    appliedXp,
    capped: appliedXp < reward.xp,
    dailyAffinity: {
      ...dailyAffinity,
      [reward.capField]: used + appliedXp,
    },
  }
}

function applyAffinityEvent(progress = {}, eventType, options = {}) {
  const reward = EVENT_REWARDS[eventType]
  const now = options.now || new Date()
  const normalized = normalizeAffinity(progress, { now })
  if (!reward) {
    return {
      progress: normalized,
      appliedXp: 0,
      capped: false,
      levelChanged: false,
      unlockedBondItems: [],
      reaction: 'idle',
      error: 'Unknown affinity event',
    }
  }

  const oldLevel = normalized.affinityLevel
  const oldItemIds = new Set((normalized.bondItems || []).map(item => item.id))
  const capped = applyDailyCap(normalized.interactionStats.dailyAffinity, reward)
  const nextXp = normalized.affinityXp + capped.appliedXp
  const nextStats = {
    ...normalized.interactionStats,
    dailyAffinity: capped.dailyAffinity,
    totalAffinityEvents: normalized.interactionStats.totalAffinityEvents + 1,
    lastInteractionAt: (now instanceof Date ? now : new Date(now)).toISOString(),
  }

  if (reward.statField) {
    nextStats[reward.statField] = Math.max(0, toNumber(nextStats[reward.statField])) + 1
  }

  const next = normalizeAffinity({
    ...normalized,
    affinityXp: nextXp,
    interactionStats: nextStats,
  }, { now })

  const unlockedBondItems = (next.bondItems || []).filter(item => !oldItemIds.has(item.id))
  const levelChanged = next.affinityLevel !== oldLevel
  return {
    progress: next,
    appliedXp: capped.appliedXp,
    capped: capped.capped,
    levelChanged,
    unlockedBondItems,
    reaction: levelChanged || unlockedBondItems.length ? 'surprised' : reward.reaction,
  }
}

module.exports = {
  AFFINITY_EVENT_TYPES,
  AFFINITY_LEVELS,
  BOND_ITEMS,
  EVENT_REWARDS,
  applyAffinityEvent,
  calculateAffinityLevel,
  getAffinityTier,
  getBondItemsForLevel,
  normalizeAffinity,
}
