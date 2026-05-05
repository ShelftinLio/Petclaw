# P0 Gamified Focus And Skill Growth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the P0 loop where focus adventures produce useful pet progression, ability unlocks, memories, and visible skill cards.

**Architecture:** Add a small bounded game layer in focused CommonJS modules, then expose it through Electron IPC and a compact renderer panel. Keep reward math, ability gates, and skill-card creation outside `index.html` so the renderer only draws state and sends user actions.

**Tech Stack:** Electron 28, CommonJS modules, Jest 30, existing `preload.js` IPC whitelist, existing `index.html` renderer.

---

## File Structure

- Create `pet-abilities.js`: ability definitions, level thresholds, unlock checks, and ability tree state.
- Create `pet-skills.js`: Memory Crystal, Skill Seed, and Skill Card helpers.
- Create `focus-adventure.js`: focus session lifecycle, reward calculation, and finished-session settlement.
- Create `pet-progress.js`: progress defaults, normalization, persistence, corrupt-file backup, session/ability/skill mutations.
- Modify `main.js`: instantiate `PetProgressStore`, add focus/progress/skill IPC handlers, and broadcast `pet-progress-changed`.
- Modify `preload.js`: whitelist new invoke/on channels.
- Modify `index.html`: add Focus Adventure, Ability Tree, and Skill Book panels in the existing compact pet HUD.
- Create tests:
  - `tests/__tests__/pet-abilities.test.js`
  - `tests/__tests__/pet-skills.test.js`
  - `tests/__tests__/focus-adventure.test.js`
  - `tests/__tests__/pet-progress.test.js`
- Modify `tests/__tests__/preload-channels.test.js`: assert the new IPC channels are exposed.

The implementation must avoid staging unrelated files from the parallel Pet Studio task.

---

### Task 1: Ability Definitions And Unlock Rules

**Files:**
- Create: `pet-abilities.js`
- Test: `tests/__tests__/pet-abilities.test.js`

- [ ] **Step 1: Write the failing ability tests**

Create `tests/__tests__/pet-abilities.test.js`:

```js
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
```

- [ ] **Step 2: Run the ability tests to verify RED**

Run: `npm test -- tests/__tests__/pet-abilities.test.js --runInBand`

Expected: FAIL because `../../pet-abilities` does not exist.

- [ ] **Step 3: Implement ability helpers**

Create `pet-abilities.js`:

```js
const ABILITY_IDS = {
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
    name: 'Warm Chat',
    tier: 'Companion',
    levelRequired: 1,
    cost: 0,
    description: 'Basic AI API conversation with pet personality.',
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
  return LEVEL_THRESHOLDS.reduce((level, threshold) => {
    return xp >= threshold.xp ? threshold.level : level
  }, 1)
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
```

- [ ] **Step 4: Run the ability tests to verify GREEN**

Run: `npm test -- tests/__tests__/pet-abilities.test.js --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add pet-abilities.js tests/__tests__/pet-abilities.test.js
git commit -m "feat: add pet ability progression rules"
```

---

### Task 2: Skill Seeds, Memories, And Skill Cards

**Files:**
- Create: `pet-skills.js`
- Test: `tests/__tests__/pet-skills.test.js`

- [ ] **Step 1: Write the failing skill helper tests**

Create `tests/__tests__/pet-skills.test.js`:

```js
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
      'skill-existing',
      'skill-seed-focus-1',
    ])
  })
})
```

- [ ] **Step 2: Run the skill tests to verify RED**

Run: `npm test -- tests/__tests__/pet-skills.test.js --runInBand`

Expected: FAIL because `../../pet-skills` does not exist.

- [ ] **Step 3: Implement skill helpers**

Create `pet-skills.js`:

```js
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

  const verbCount = WORKFLOW_VERBS.filter(verb => summary.toLowerCase().includes(verb.toLowerCase())).length
  const hasListPunctuation = /[,，;；->]/.test(summary)
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

function listSkillCards(progress = {}) {
  const learned = Array.isArray(progress.skills) ? progress.skills : []
  const seeds = Array.isArray(progress.skillSeeds) ? progress.skillSeeds : []
  return [...learned, ...seeds.map(seed => createSkillCardFromSeed(seed))]
}

module.exports = {
  createMemoryCrystal,
  isSkillSeedEligible,
  createSkillSeed,
  createSkillCardFromSeed,
  listSkillCards,
}
```

- [ ] **Step 4: Run the skill tests to verify GREEN**

Run: `npm test -- tests/__tests__/pet-skills.test.js --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit Task 2**

```bash
git add pet-skills.js tests/__tests__/pet-skills.test.js
git commit -m "feat: add pet skill seed helpers"
```

---

### Task 3: Focus Adventure Lifecycle And Reward Settlement

**Files:**
- Create: `focus-adventure.js`
- Test: `tests/__tests__/focus-adventure.test.js`

- [ ] **Step 1: Write the failing focus adventure tests**

Create `tests/__tests__/focus-adventure.test.js`:

```js
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
```

- [ ] **Step 2: Run focus tests to verify RED**

Run: `npm test -- tests/__tests__/focus-adventure.test.js --runInBand`

Expected: FAIL because `../../focus-adventure` does not exist.

- [ ] **Step 3: Implement focus adventure helpers**

Create `focus-adventure.js`:

```js
const INTENT_TYPES = ['Code', 'Writing', 'Research', 'Learning', 'Planning', 'Admin', 'Rest']
const STATUS_TYPES = ['completed', 'partial', 'interrupted']
const DURATION_PRESETS = [15, 25, 45, 90]

function pad(value) {
  return String(value).padStart(2, '0')
}

function createFocusId(now = new Date()) {
  return [
    'focus',
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
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

function calculateRewards({ actualMinutes = 0, plannedMinutes = 25, status = 'completed', summary = '', skillSeedEligible = false } = {}) {
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
    abilityFragments: Math.floor(focusXp / 30),
    stardust: Math.ceil(minutes / 5) + (hasSummary ? 2 : 0),
    memoryCrystal: hasSummary,
    skillSeed: Boolean(skillSeedEligible),
  }
}

function finishFocusAdventure(session = {}, { status = 'completed', summary = '', now = new Date(), skillSeedEligible = false } = {}) {
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
}
```

- [ ] **Step 4: Run focus tests to verify GREEN**

Run: `npm test -- tests/__tests__/focus-adventure.test.js --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit Task 3**

```bash
git add focus-adventure.js tests/__tests__/focus-adventure.test.js
git commit -m "feat: add focus adventure reward lifecycle"
```

---

### Task 4: Progress Persistence And Mutations

**Files:**
- Create: `pet-progress.js`
- Test: `tests/__tests__/pet-progress.test.js`

- [ ] **Step 1: Write the failing progress tests**

Create `tests/__tests__/pet-progress.test.js`:

```js
const fs = require('fs')
const os = require('os')
const path = require('path')

const {
  createDefaultProgress,
  normalizeProgress,
  applyFinishedSession,
  PetProgressStore,
} = require('../../pet-progress')

describe('pet progress persistence', () => {
  test('creates default progress with warm chat unlocked', () => {
    expect(createDefaultProgress()).toMatchObject({
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
    })
  })

  test('normalizes malformed progress safely', () => {
    expect(normalizeProgress({ focusXp: 160, unlockedAbilities: ['task-echo'] })).toMatchObject({
      petLevel: 3,
      focusXp: 160,
      unlockedAbilities: ['warm-chat', 'task-echo'],
      focusSessions: [],
    })
  })

  test('applies a finished session to xp, currency, memory, and skill seed', () => {
    const progress = normalizeProgress({
      unlockedAbilities: ['warm-chat', 'workflow-lens'],
    })
    const session = {
      id: 'focus-1',
      taskTitle: 'Fix IPC tests',
      intentType: 'Code',
      status: 'completed',
      summary: 'Inspect channels, compare handlers, add tests, run Jest.',
      rewards: {
        focusXp: 60,
        abilityFragments: 2,
        stardust: 7,
        memoryCrystal: true,
        skillSeed: true,
      },
      endedAt: '2026-05-05T10:25:00.000Z',
    }

    const next = applyFinishedSession(progress, session, {
      now: new Date('2026-05-05T10:26:00.000Z'),
    })

    expect(next).toMatchObject({
      petLevel: 2,
      focusXp: 60,
      abilityFragments: 2,
      stardust: 7,
      activeFocusSession: null,
    })
    expect(next.focusSessions).toHaveLength(1)
    expect(next.memories[0]).toMatchObject({ id: 'memory-focus-1' })
    expect(next.skillSeeds[0]).toMatchObject({ id: 'seed-focus-1' })
  })

  test('store loads defaults and saves progress file', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-progress-'))
    const filePath = path.join(dir, 'pet-progress.json')
    const store = new PetProgressStore(filePath)

    const progress = await store.load()
    progress.focusXp = 60
    await store.save(progress)

    expect(JSON.parse(fs.readFileSync(filePath, 'utf8')).focusXp).toBe(60)
  })

  test('store backs up corrupt progress before resetting', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-progress-'))
    const filePath = path.join(dir, 'pet-progress.json')
    fs.writeFileSync(filePath, '{ broken json', 'utf8')

    const store = new PetProgressStore(filePath)
    const progress = await store.load()

    expect(progress.focusXp).toBe(0)
    expect(fs.readdirSync(dir).some(name => name.startsWith('pet-progress.json.corrupt-'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run progress tests to verify RED**

Run: `npm test -- tests/__tests__/pet-progress.test.js --runInBand`

Expected: FAIL because `../../pet-progress` does not exist.

- [ ] **Step 3: Implement progress persistence**

Create `pet-progress.js`:

```js
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
  const unlockedAbilities = unique([...base.unlockedAbilities, ...(Array.isArray(raw.unlockedAbilities) ? raw.unlockedAbilities : [])])
  return {
    ...base,
    ...raw,
    version: 1,
    petLevel: calculatePetLevel(focusXp),
    focusXp,
    stardust: Math.max(0, Number(raw.stardust || 0)),
    abilityFragments: Math.max(0, Number(raw.abilityFragments || 0)),
    unlockedAbilities,
    activeFocusSession: raw.activeFocusSession && raw.activeFocusSession.status === 'active' ? raw.activeFocusSession : null,
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
```

- [ ] **Step 4: Run progress tests to verify GREEN**

Run: `npm test -- tests/__tests__/pet-progress.test.js --runInBand`

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add pet-progress.js tests/__tests__/pet-progress.test.js
git commit -m "feat: persist pet game progress"
```

---

### Task 5: Main Process IPC And Preload Whitelist

**Files:**
- Modify: `main.js`
- Modify: `preload.js`
- Modify: `tests/__tests__/preload-channels.test.js`

- [ ] **Step 1: Write failing preload channel tests**

Modify `tests/__tests__/preload-channels.test.js` so it checks all P0 channels while preserving the current Pet Studio assertion:

```js
const fs = require('fs')
const path = require('path')

describe('preload channel whitelist', () => {
  test('exposes Pet Studio opener to renderers', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'preload.js'), 'utf8')

    expect(source).toContain("'pet-studio-open'")
  })

  test('exposes gamified focus and skill channels to renderers', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'preload.js'), 'utf8')
    const channels = [
      'focus-adventure-start',
      'focus-adventure-get',
      'focus-adventure-finish',
      'pet-progress-get',
      'pet-ability-unlock',
      'pet-skill-seed-create',
      'pet-skill-card-list',
    ]

    for (const channel of channels) {
      expect(source).toContain(`'${channel}'`)
    }
    expect(source).toContain("'pet-progress-changed'")
  })
})
```

- [ ] **Step 2: Run preload test to verify RED**

Run: `npm test -- tests/__tests__/preload-channels.test.js --runInBand`

Expected: FAIL because the new channels are not whitelisted.

- [ ] **Step 3: Add imports and progress store to `main.js`**

Near the existing `pet-appearance` import in `main.js`, add:

```js
const { getAbilityTree } = require('./pet-abilities');
const {
  startFocusAdventure,
  finishFocusAdventure
} = require('./focus-adventure');
const {
  PetProgressStore,
  normalizeProgress,
  applyFinishedSession,
  unlockAbility: unlockPetAbility,
  listSkillCards
} = require('./pet-progress');
const {
  isSkillSeedEligible,
  createSkillSeed
} = require('./pet-skills');
```

Near the existing top-level state variables, add:

```js
let petProgressStore;
```

In the existing initialization flow where `petConfig = new PetConfig()` is loaded, add after `await petConfig.load();`:

```js
petProgressStore = new PetProgressStore(path.join(__dirname, 'pet-progress.json'));
await petProgressStore.load();
```

- [ ] **Step 4: Add P0 progress helpers and IPC handlers to `main.js`**

Place these handlers near the appearance IPC block, before `show-history`:

```js
async function ensurePetProgress() {
  if (!petProgressStore) {
    petProgressStore = new PetProgressStore(path.join(__dirname, 'pet-progress.json'));
    await petProgressStore.load();
  }
  return petProgressStore.get();
}

function decorateProgress(progress) {
  const normalized = normalizeProgress(progress);
  return {
    ...normalized,
    abilityTree: getAbilityTree(normalized),
    skillCards: listSkillCards(normalized),
  };
}

function broadcastPetProgressChanged(progress) {
  const state = decorateProgress(progress);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pet-progress-changed', state);
  }
  return state;
}

ipcMain.handle('pet-progress-get', async () => {
  const progress = await ensurePetProgress();
  return decorateProgress(progress);
});

ipcMain.handle('focus-adventure-get', async () => {
  const progress = await ensurePetProgress();
  return {
    activeFocusSession: progress.activeFocusSession,
    progress: decorateProgress(progress),
  };
});

ipcMain.handle('focus-adventure-start', async (event, payload = {}) => {
  const progress = await ensurePetProgress();
  if (progress.activeFocusSession) {
    return {
      success: false,
      error: 'A focus adventure is already active',
      activeFocusSession: progress.activeFocusSession,
      progress: decorateProgress(progress),
    };
  }

  const activeFocusSession = startFocusAdventure(payload);
  const next = await petProgressStore.save({ ...progress, activeFocusSession });
  broadcastPetProgressChanged(next);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('status-update', { mood: 'focused' });
  }
  return { success: true, activeFocusSession, progress: decorateProgress(next) };
});

ipcMain.handle('focus-adventure-finish', async (event, payload = {}) => {
  const progress = await ensurePetProgress();
  if (!progress.activeFocusSession) {
    return {
      success: false,
      error: 'No focus adventure is active',
      progress: decorateProgress(progress),
    };
  }

  const seedCheck = isSkillSeedEligible({
    ...progress.activeFocusSession,
    status: payload.status,
    summary: payload.summary,
  }, progress);

  const finishedSession = finishFocusAdventure(progress.activeFocusSession, {
    status: payload.status,
    summary: payload.summary,
    skillSeedEligible: seedCheck.eligible,
  });
  const next = await petProgressStore.save(applyFinishedSession(progress, finishedSession));
  broadcastPetProgressChanged(next);
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('status-update', { mood: 'happy' });
  }
  return {
    success: true,
    session: finishedSession,
    seedCheck,
    progress: decorateProgress(next),
  };
});

ipcMain.handle('pet-ability-unlock', async (event, abilityId) => {
  try {
    const progress = await ensurePetProgress();
    const next = await petProgressStore.save(unlockPetAbility(progress, abilityId));
    return { success: true, progress: broadcastPetProgressChanged(next) };
  } catch (err) {
    const progress = await ensurePetProgress();
    return { success: false, error: err.message, progress: decorateProgress(progress) };
  }
});

ipcMain.handle('pet-skill-seed-create', async (event, payload = {}) => {
  const progress = await ensurePetProgress();
  const session = progress.focusSessions.find(item => item.id === payload.sessionId);
  if (!session) {
    return { success: false, error: 'Focus session not found', progress: decorateProgress(progress) };
  }
  const seedCheck = isSkillSeedEligible(session, progress);
  if (!seedCheck.eligible) {
    return { success: false, error: seedCheck.reason, progress: decorateProgress(progress) };
  }
  if (progress.skillSeeds.some(seed => seed.sourceSessionId === session.id)) {
    return { success: false, error: 'Skill seed already exists', progress: decorateProgress(progress) };
  }
  const seed = createSkillSeed(session);
  const next = await petProgressStore.save({
    ...progress,
    skillSeeds: [...progress.skillSeeds, seed],
  });
  return { success: true, seed, progress: broadcastPetProgressChanged(next) };
});

ipcMain.handle('pet-skill-card-list', async () => {
  const progress = await ensurePetProgress();
  return { success: true, skillCards: listSkillCards(progress), progress: decorateProgress(progress) };
});
```

- [ ] **Step 5: Add new IPC whitelist entries to `preload.js`**

In `VALID_INVOKE_CHANNELS`, add:

```js
  'focus-adventure-start',
  'focus-adventure-get',
  'focus-adventure-finish',
  'pet-progress-get',
  'pet-ability-unlock',
  'pet-skill-seed-create',
  'pet-skill-card-list',
```

In `VALID_ON_CHANNELS`, add:

```js
  'pet-progress-changed',
```

- [ ] **Step 6: Run targeted IPC/preload tests**

Run:

```bash
npm test -- tests/__tests__/preload-channels.test.js tests/__tests__/pet-abilities.test.js tests/__tests__/pet-skills.test.js tests/__tests__/focus-adventure.test.js tests/__tests__/pet-progress.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add main.js preload.js tests/__tests__/preload-channels.test.js
git commit -m "feat: expose pet focus progress ipc"
```

---

### Task 6: Renderer UI For Focus Adventure, Ability Tree, And Skill Book

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add static renderer smoke tests before UI implementation**

Because this app does not currently have DOM integration tests for `index.html`, extend `tests/__tests__/preload-channels.test.js` with static checks that fail until the renderer has visible P0 hooks:

```js
test('renderer includes gamified focus panel hooks', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')

  expect(source).toContain('id="focusAdventurePanel"')
  expect(source).toContain('startFocusAdventure')
  expect(source).toContain('renderPetProgress')
  expect(source).toContain('openSkillBook')
})
```

Run: `npm test -- tests/__tests__/preload-channels.test.js --runInBand`

Expected: FAIL because the renderer hooks do not exist yet.

- [ ] **Step 2: Add P0 controls to the existing settings panel**

In `index.html`, inside `<div class="settings-panel" id="settingsPanel">`, add these buttons after the `Tools` section:

```html
<div class="settings-section">Adventure</div>
<button onclick="openFocusAdventure()">Focus</button>
<button onclick="openAbilityTree()">Abilities</button>
<button onclick="openSkillBook()">Skills</button>
```

- [ ] **Step 3: Add compact P0 panels after the settings panel**

Still in `index.html`, after the settings panel and before the input bar, add:

```html
<div class="game-panel" id="focusAdventurePanel">
    <div class="settings-title">Focus Adventure</div>
    <input class="game-input" id="focusTaskTitle" placeholder="Task title">
    <div class="game-row" id="focusDurations">
        <button data-minutes="15" onclick="selectFocusDuration(15)">15</button>
        <button data-minutes="25" onclick="selectFocusDuration(25)">25</button>
        <button data-minutes="45" onclick="selectFocusDuration(45)">45</button>
        <button data-minutes="90" onclick="selectFocusDuration(90)">90</button>
    </div>
    <select class="game-input" id="focusIntentType">
        <option>Code</option>
        <option>Writing</option>
        <option>Research</option>
        <option>Learning</option>
        <option>Planning</option>
        <option>Admin</option>
        <option>Rest</option>
    </select>
    <div class="game-current" id="focusTimerText">No active adventure</div>
    <button class="wide" id="focusStartButton" onclick="startFocusAdventure()">Start</button>
    <button class="wide" id="focusFinishButton" onclick="finishFocusAdventure('completed')">Finish</button>
    <button class="wide" onclick="finishFocusAdventure('interrupted')">Interrupt</button>
    <div class="settings-note" id="focusRewardText"></div>
</div>

<div class="game-panel" id="abilityTreePanel">
    <div class="settings-title">Abilities</div>
    <div class="game-current" id="petLevelText">Level 1 Companion</div>
    <div id="abilityList"></div>
</div>

<div class="game-panel" id="skillBookPanel">
    <div class="settings-title">Skill Book</div>
    <div id="skillCardList"></div>
</div>
```

- [ ] **Step 4: Add compact P0 styles**

In the `<style>` block, near the existing `.settings-panel` styles, add:

```css
.game-panel {
    position: absolute;
    left: 82px;
    top: 16px;
    width: 220px;
    max-height: 320px;
    overflow: auto;
    background: rgba(255,255,255,0.96);
    color: #111;
    border: 2px solid #111;
    box-shadow: 4px 4px 0 rgba(0,0,0,0.22);
    padding: 8px;
    display: none;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
    font-size: 11px;
    z-index: 8;
}
.game-panel.show { display: grid; }
.game-input {
    grid-column: 1 / -1;
    border: 1px solid #111;
    background: #fff;
    color: #111;
    padding: 5px;
    font: inherit;
}
.game-row {
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
}
.game-current {
    grid-column: 1 / -1;
    border: 1px dashed #111;
    padding: 5px;
    min-height: 18px;
    background: #f7f7f7;
}
.ability-card,
.skill-card {
    grid-column: 1 / -1;
    border: 1px solid #111;
    padding: 6px;
    background: #fff;
    margin-bottom: 5px;
}
.ability-card.locked,
.skill-card.locked {
    opacity: 0.58;
}
.ability-card button {
    width: 100%;
    margin-top: 4px;
}
```

- [ ] **Step 5: Add renderer state and panel helpers**

In the `<script>` block, after the existing DOM constants for `settingsNote`, add:

```js
const focusAdventurePanel = document.getElementById('focusAdventurePanel');
const abilityTreePanel = document.getElementById('abilityTreePanel');
const skillBookPanel = document.getElementById('skillBookPanel');
const focusTaskTitle = document.getElementById('focusTaskTitle');
const focusIntentType = document.getElementById('focusIntentType');
const focusTimerText = document.getElementById('focusTimerText');
const focusRewardText = document.getElementById('focusRewardText');
const petLevelText = document.getElementById('petLevelText');
const abilityList = document.getElementById('abilityList');
const skillCardList = document.getElementById('skillCardList');

let selectedFocusDuration = 25;
let petProgressState = null;
let activeFocusSession = null;
let focusTimerInterval = null;

function hideGamePanels() {
    [focusAdventurePanel, abilityTreePanel, skillBookPanel].forEach(panel => panel?.classList.remove('show'));
}

function showGamePanel(panel) {
    hideGamePanels();
    settingsPanel.classList.remove('show');
    inputBar.classList.remove('show');
    panel.classList.add('show');
    pauseRoam(2500);
}
```

Update the existing document click handler to keep game panels open when clicked:

```js
if (
    pet.contains(e.target) ||
    toolbar.contains(e.target) ||
    settingsPanel.contains(e.target) ||
    inputBar.contains(e.target) ||
    focusAdventurePanel.contains(e.target) ||
    abilityTreePanel.contains(e.target) ||
    skillBookPanel.contains(e.target)
) return;
toolbar.classList.remove('show');
settingsPanel.classList.remove('show');
hideGamePanels();
```

- [ ] **Step 6: Add renderer progress rendering functions**

In the `<script>` block before `loadAppearance();`, add:

```js
function renderPetProgress(state) {
    if (!state) return;
    petProgressState = state;
    activeFocusSession = state.activeFocusSession || null;
    const tree = state.abilityTree || { abilities: [], petLevel: state.petLevel || 1 };
    const tier = (tree.tiers || []).find(item => item.level === tree.petLevel);
    petLevelText.textContent = `Level ${tree.petLevel} ${tier?.tier || 'Companion'} | XP ${state.focusXp || 0} | Fragments ${state.abilityFragments || 0}`;
    abilityList.innerHTML = (tree.abilities || []).map(ability => `
        <div class="ability-card ${ability.unlocked ? '' : 'locked'}">
            <strong>${ability.name}</strong><br>
            <span>${ability.tier} | Cost ${ability.cost}</span><br>
            <span>${ability.description}</span>
            ${ability.unlocked ? '<div>Unlocked</div>' : ability.canUnlock ? `<button onclick="unlockPetAbility('${ability.id}')">Unlock</button>` : `<div>${ability.lockedReason}</div>`}
        </div>
    `).join('');
    const skillCards = state.skillCards || [];
    skillCardList.innerHTML = skillCards.length ? skillCards.map(card => `
        <div class="skill-card ${card.status === 'locked' ? 'locked' : ''}">
            <strong>${card.name}</strong><br>
            <span>${card.rarity || 'common'} | ${card.status || 'candidate'} | Lv ${card.level || 1}</span><br>
            <span>${card.description || 'A pet skill card.'}</span>
        </div>
    `).join('') : '<div class="game-current">No skills yet. Finish reusable focus adventures to find Skill Seeds.</div>';
    updateFocusTimerText();
}

function updateFocusTimerText() {
    if (!focusTimerText) return;
    if (!activeFocusSession) {
        focusTimerText.textContent = 'No active adventure';
        return;
    }
    const started = new Date(activeFocusSession.startedAt).getTime();
    const elapsed = Math.max(0, Math.floor((Date.now() - started) / 60000));
    focusTimerText.textContent = `${activeFocusSession.taskTitle} | ${elapsed}/${activeFocusSession.plannedMinutes} min`;
}

function startFocusTimerLoop() {
    if (focusTimerInterval) clearInterval(focusTimerInterval);
    focusTimerInterval = setInterval(updateFocusTimerText, 15000);
}

async function loadPetProgress() {
    if (!window.electronAPI) return;
    try {
        renderPetProgress(await electronAPI.invoke('pet-progress-get'));
        startFocusTimerLoop();
    } catch (err) {
        if (focusRewardText) focusRewardText.textContent = err.message || 'Progress unavailable';
    }
}
```

- [ ] **Step 7: Add renderer actions**

Add these functions near other UI action functions:

```js
function selectFocusDuration(minutes) {
    selectedFocusDuration = minutes;
    document.querySelectorAll('#focusDurations button').forEach(button => {
        button.style.background = Number(button.dataset.minutes) === minutes ? '#111' : '#fff';
        button.style.color = Number(button.dataset.minutes) === minutes ? '#fff' : '#111';
    });
}

function openFocusAdventure() {
    showGamePanel(focusAdventurePanel);
    selectFocusDuration(selectedFocusDuration);
    loadPetProgress();
}

function openAbilityTree() {
    showGamePanel(abilityTreePanel);
    loadPetProgress();
}

function openSkillBook() {
    showGamePanel(skillBookPanel);
    loadPetProgress();
}

async function startFocusAdventure() {
    if (!window.electronAPI) return;
    const result = await electronAPI.invoke('focus-adventure-start', {
        taskTitle: focusTaskTitle.value,
        plannedMinutes: selectedFocusDuration,
        intentType: focusIntentType.value
    });
    if (!result.success) {
        focusRewardText.textContent = result.error || 'Could not start adventure';
        return;
    }
    activeFocusSession = result.activeFocusSession;
    renderPetProgress(result.progress);
    setMood('focused');
    focusRewardText.textContent = 'Adventure started. Your pet is learning from this focus run.';
}

async function finishFocusAdventure(status) {
    if (!window.electronAPI) return;
    const summary = status === 'interrupted'
        ? ''
        : prompt('What did this focus adventure produce?', '') || '';
    const result = await electronAPI.invoke('focus-adventure-finish', { status, summary });
    if (!result.success) {
        focusRewardText.textContent = result.error || 'Could not finish adventure';
        return;
    }
    renderPetProgress(result.progress);
    setMood(status === 'interrupted' ? 'sleepy' : 'happy');
    const rewards = result.session.rewards;
    focusRewardText.textContent = `+${rewards.focusXp} XP, +${rewards.abilityFragments} fragments, +${rewards.stardust} stardust${rewards.skillSeed ? ', Skill Seed found' : ''}`;
}

async function unlockPetAbility(abilityId) {
    if (!window.electronAPI) return;
    const result = await electronAPI.invoke('pet-ability-unlock', abilityId);
    renderPetProgress(result.progress);
    if (!result.success) {
        focusRewardText.textContent = result.error || 'Ability locked';
    }
}
```

After existing `loadAppearance();`, add:

```js
loadPetProgress();
if (window.electronAPI) {
    electronAPI.on('pet-progress-changed', renderPetProgress);
}
```

- [ ] **Step 8: Run renderer smoke test to verify GREEN**

Run: `npm test -- tests/__tests__/preload-channels.test.js --runInBand`

Expected: PASS.

- [ ] **Step 9: Commit Task 6**

```bash
git add index.html tests/__tests__/preload-channels.test.js
git commit -m "feat: add focus adventure pet ui"
```

---

### Task 7: Full Verification

**Files:**
- No new files unless verification reveals a defect.

- [ ] **Step 1: Run focused unit tests**

Run:

```bash
npm test -- tests/__tests__/pet-abilities.test.js tests/__tests__/pet-skills.test.js tests/__tests__/focus-adventure.test.js tests/__tests__/pet-progress.test.js tests/__tests__/preload-channels.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run the full Jest suite**

Run: `npm test -- --runInBand`

Expected: PASS. If unrelated tests fail because of the parallel task, capture the failing test names and do not change unrelated work without reading it carefully.

- [ ] **Step 3: Launch the app manually**

Run: `npm start`

Expected:

- App opens.
- Pet still appears and can be dragged.
- Settings panel still opens.
- `Focus`, `Abilities`, and `Skills` buttons open compact panels.
- Starting an adventure changes the pet to focused mode.
- Finishing an adventure shows XP/fragments/stardust and, with a reusable summary, a Skill Seed card.

- [ ] **Step 4: Stop the app before final response**

Close the Electron app or stop the terminal process.

- [ ] **Step 5: Final commit if verification fixes were needed**

Only if Task 7 required fixes:

```bash
git add <fixed-files>
git commit -m "fix: polish focus adventure verification"
```

---

## Self-Review

- Spec coverage: Tasks 1-4 implement rewards, ability tree, memory crystals, skill seeds/cards, data model, and persistence. Task 5 exposes the bounded game layer through safe IPC. Task 6 implements the compact P0 UI. Task 7 covers automated and manual verification.
- Placeholder scan: No TODO/TBD placeholders; each implementation step includes concrete code or exact commands.
- Type consistency: The same channel names, ability ids, reward keys, session fields, and card fields are used across tests, helpers, IPC, and renderer plan.
