const INTENT_TYPES = ['Code', 'Writing', 'Research', 'Learning', 'Planning', 'Admin', 'Rest']
const STATUS_TYPES = ['completed', 'partial', 'interrupted']
const DURATION_PRESETS = [5, 15, 25, 55]

function pad(value) {
  return String(value).padStart(2, '0')
}

function createFocusId(now = new Date()) {
  return [
    'focus-',
    now.getUTCFullYear(),
    pad(now.getUTCMonth() + 1),
    pad(now.getUTCDate()),
    '-',
    pad(now.getUTCHours()),
    pad(now.getUTCMinutes()),
    pad(now.getUTCSeconds()),
  ].join('')
}

function normalizeDuration(minutes) {
  const parsed = Number(minutes)
  return DURATION_PRESETS.includes(parsed) ? parsed : 25
}

function normalizeIntent(intentType) {
  return INTENT_TYPES.includes(intentType) ? intentType : 'Planning'
}

function startFocusAdventure({ taskTitle, plannedMinutes, intentType, now = new Date() } = {}) {
  const title = String(taskTitle || '').trim() || 'Focus Adventure'
  const startedAt = now instanceof Date ? now : new Date(now)
  return {
    id: createFocusId(startedAt),
    taskTitle: title.slice(0, 80),
    intentType: normalizeIntent(intentType),
    plannedMinutes: normalizeDuration(plannedMinutes),
    actualMinutes: 0,
    status: 'active',
    summary: '',
    rewards: null,
    startedAt: startedAt.toISOString(),
    endedAt: '',
  }
}

function calculateActualMinutes(session = {}, now = new Date()) {
  const started = new Date(session.startedAt)
  const ended = now instanceof Date ? now : new Date(now)
  if (Number.isNaN(started.getTime()) || Number.isNaN(ended.getTime())) return 0
  return Math.max(0, Math.ceil((ended.getTime() - started.getTime()) / 60000))
}

function formatTimerLabel(seconds, { overtime = false } = {}) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds || 0)))
  const minutes = Math.floor(safeSeconds / 60)
  const remainder = safeSeconds % 60
  const label = `${pad(minutes)}:${pad(remainder)}`
  return overtime ? `+${label}` : label
}

function getFocusTimerState(session = {}, { now = new Date() } = {}) {
  if (!session || session.status !== 'active') {
    return {
      active: false,
      elapsedSeconds: 0,
      elapsedMinutes: 0,
      remainingSeconds: 0,
      remainingMinutes: 0,
      totalSeconds: 0,
      progress: 0,
      isOvertime: false,
      label: '00:00',
    }
  }

  const started = new Date(session.startedAt)
  const current = now instanceof Date ? now : new Date(now)
  const plannedMinutes = normalizeDuration(session.plannedMinutes)
  const totalSeconds = plannedMinutes * 60

  if (Number.isNaN(started.getTime()) || Number.isNaN(current.getTime())) {
    return {
      active: true,
      elapsedSeconds: 0,
      elapsedMinutes: 0,
      remainingSeconds: totalSeconds,
      remainingMinutes: plannedMinutes,
      totalSeconds,
      progress: 0,
      isOvertime: false,
      label: formatTimerLabel(totalSeconds),
    }
  }

  const elapsedSeconds = Math.max(0, Math.floor((current.getTime() - started.getTime()) / 1000))
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds)
  const overtimeSeconds = Math.max(0, elapsedSeconds - totalSeconds)
  const progress = totalSeconds > 0
    ? Math.min(1, Number((elapsedSeconds / totalSeconds).toFixed(4)))
    : 1

  return {
    active: true,
    elapsedSeconds,
    elapsedMinutes: Math.floor(elapsedSeconds / 60),
    remainingSeconds,
    remainingMinutes: Math.ceil(remainingSeconds / 60),
    totalSeconds,
    progress,
    isOvertime: overtimeSeconds > 0,
    label: overtimeSeconds > 0
      ? formatTimerLabel(overtimeSeconds, { overtime: true })
      : formatTimerLabel(remainingSeconds),
  }
}

function calculateRewards({
  actualMinutes = 0,
  plannedMinutes = 25,
  status = 'completed',
  summary = '',
  skillSeedEligible = false,
} = {}) {
  const minutes = Math.max(0, Math.min(Number(actualMinutes || 0), Number(plannedMinutes || 25)))
  const cleanSummary = String(summary || '').trim()
  const hasSummary = cleanSummary.length > 0

  if (status === 'interrupted') {
    return {
      focusXp: Math.max(3, Math.floor(minutes * 0.5)),
      abilityFragments: 0,
      stardust: 1,
      memoryCrystal: hasSummary,
      skillSeed: false,
    }
  }

  if (status === 'partial') {
    const focusXp = Math.max(6, minutes + (hasSummary ? 5 : 0))
    return {
      focusXp,
      abilityFragments: Math.floor(focusXp / 40),
      stardust: Math.max(2, Math.ceil(minutes / 8)),
      memoryCrystal: hasSummary,
      skillSeed: Boolean(skillSeedEligible),
    }
  }

  const focusXp = Math.max(10, minutes * 2 + (hasSummary ? 10 : 0))
  return {
    focusXp,
    abilityFragments: hasSummary ? Math.max(1, Math.floor(focusXp / 30)) : Math.floor(focusXp / 30),
    stardust: Math.ceil(minutes / 5) + (hasSummary ? 2 : 0),
    memoryCrystal: hasSummary,
    skillSeed: Boolean(skillSeedEligible),
  }
}

function finishFocusAdventure(session = {}, {
  status = 'completed',
  summary = '',
  now = new Date(),
  skillSeedEligible = false,
} = {}) {
  if (session.status !== 'active') {
    throw new Error('Only active focus adventures can be finished')
  }
  const endedAt = now instanceof Date ? now : new Date(now)
  const finalStatus = STATUS_TYPES.includes(status) ? status : 'completed'
  const actualMinutes = calculateActualMinutes(session, endedAt)
  const cleanSummary = String(summary || '').trim()
  const rewards = calculateRewards({
    actualMinutes,
    plannedMinutes: session.plannedMinutes,
    status: finalStatus,
    summary: cleanSummary,
    skillSeedEligible,
  })

  return {
    ...session,
    actualMinutes,
    status: finalStatus,
    summary: cleanSummary,
    rewards,
    endedAt: endedAt.toISOString(),
  }
}

module.exports = {
  INTENT_TYPES,
  STATUS_TYPES,
  DURATION_PRESETS,
  startFocusAdventure,
  finishFocusAdventure,
  calculateRewards,
  getFocusTimerState,
}
