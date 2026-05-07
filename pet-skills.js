const REUSABLE_MARKERS = [
  /make this reusable/i,
  /turn this into a skill/i,
  /skill seed/i,
  /封装/,
  /复用/,
  /技能/,
]

const WORKFLOW_VERBS = [
  'inspect',
  'compare',
  'add',
  'run',
  'collect',
  'summarize',
  'extract',
  'generate',
  'write',
  'fix',
  'review',
  '检查',
  '对比',
  '添加',
  '运行',
  '总结',
  '提取',
  '生成',
  '修复',
]

function hasWorkflowLens(progress = {}) {
  return Array.isArray(progress.unlockedAbilities) && progress.unlockedAbilities.includes('workflow-lens')
}

function createMemoryCrystal(session = {}) {
  const id = session.id || `focus-${Date.now()}`
  return {
    id: `memory-${id}`,
    title: session.taskTitle || 'Untitled focus',
    intentType: session.intentType || 'Planning',
    status: session.status || 'completed',
    summary: String(session.summary || '').trim(),
    rewards: session.rewards || {},
    sourceSessionId: id,
    createdAt: session.endedAt || new Date().toISOString(),
  }
}

function isSkillSeedEligible(session = {}, progress = {}) {
  const summary = String(session.summary || '').trim()
  if (!summary) {
    return { eligible: false, reason: 'summary is empty' }
  }

  if (REUSABLE_MARKERS.some(pattern => pattern.test(summary))) {
    return { eligible: true, reason: 'user marked workflow reusable' }
  }

  const lowerSummary = summary.toLowerCase()
  const verbCount = WORKFLOW_VERBS.filter(verb => lowerSummary.includes(verb.toLowerCase())).length
  const hasListPunctuation = /[,，;；>\-]/.test(summary)
  const repeatableIntent = ['Code', 'Research', 'Writing', 'Planning'].includes(session.intentType)

  if (hasWorkflowLens(progress) && repeatableIntent && verbCount >= 2 && hasListPunctuation) {
    return { eligible: true, reason: 'repeatable workflow detected' }
  }

  return { eligible: false, reason: 'summary does not describe a reusable workflow' }
}

function createSkillSeed(session = {}, { now = new Date() } = {}) {
  const id = session.id || `focus-${now.getTime()}`
  return {
    id: `seed-${id}`,
    title: session.taskTitle || 'Untitled Workflow',
    sourceSessionId: id,
    workflowSummary: String(session.summary || '').trim(),
    status: 'candidate',
    createdAt: now.toISOString(),
  }
}

function inferRarity(seed = {}) {
  const words = String(seed.workflowSummary || '').split(/\s+/).filter(Boolean).length
  if (words >= 30) return 'epic'
  return 'rare'
}

function createSkillCardFromSeed(seed = {}) {
  return {
    id: `skill-${seed.id}`,
    name: seed.title || 'Untitled Skill',
    type: 'Workflow',
    rarity: inferRarity(seed),
    status: seed.status || 'candidate',
    level: 1,
    xp: 0,
    description: seed.workflowSummary || '',
    source: 'Created from a completed focus workflow',
    inputs: ['user-approved workflow context'],
    outputs: ['repeatable workflow result'],
    requires: ['OpenClaw Hands'],
    sourceSeedId: seed.id,
    sourceSessionId: seed.sourceSessionId,
    lastUsedAt: '',
  }
}

function createBasicConversationSkillCard() {
  return {
    id: 'skill-basic-conversation',
    name: 'Basic Conversation',
    type: 'Conversation',
    rarity: 'starter',
    status: 'learned',
    level: 1,
    xp: 0,
    description: 'The pet can answer with basic AI conversation before OpenClaw execution abilities are unlocked.',
    source: 'Initial companion ability',
    inputs: ['user message'],
    outputs: ['pet reply'],
    requires: [],
    sourceSeedId: '',
    sourceSessionId: '',
    lastUsedAt: '',
  }
}

function listSkillCards(progress = {}) {
  const learned = Array.isArray(progress.skills) ? progress.skills : []
  const seeds = Array.isArray(progress.skillSeeds) ? progress.skillSeeds : []
  const hasBasicConversation = (
    (Array.isArray(progress.unlockedAbilities) && progress.unlockedAbilities.includes('warm-chat')) ||
    !Array.isArray(progress.unlockedAbilities)
  )
  const learnedWithBase = hasBasicConversation && !learned.some(skill => skill.id === 'skill-basic-conversation')
    ? [createBasicConversationSkillCard(), ...learned]
    : learned
  return [...learnedWithBase, ...seeds.map(seed => createSkillCardFromSeed(seed))]
}

module.exports = {
  createMemoryCrystal,
  isSkillSeedEligible,
  createSkillSeed,
  createSkillCardFromSeed,
  createBasicConversationSkillCard,
  listSkillCards,
}
