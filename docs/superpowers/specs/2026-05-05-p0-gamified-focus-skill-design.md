# P0 Gamified Focus And Skill Growth Design

Date: 2026-05-05

## Goal

Petclaw P0 should turn focus time into pet growth that has real utility. The player promise is:

> The more you focus with the pet, the more the pet learns how to help you.

This P0 is not a general game layer and not a decorative reward system. It introduces one tight loop:

```text
Start a focus adventure
-> work in the real world
-> finish or check in
-> receive useful rewards
-> unlock pet AI capabilities
-> capture repeated workflows as visible skill cards
```

The system should make focus rewards valuable by connecting them to AI capability, workflow memory, and future automation rather than only coins or cosmetics.

## Existing Context

Petclaw is currently an Electron desktop companion with:

- An always-on-top desktop pet window.
- A pixel cow-cat appearance system with mood states such as `idle`, `happy`, `talking`, `thinking`, `sleepy`, `surprised`, `focused`, `offline`, `sad`, and `walking`.
- Click, drag, hover, roam, voice, message, screenshot, model switch, setup wizard, and Gateway/OpenClaw/Hermes integration surfaces.
- Pet appearance customization and a Pet Studio design already in progress.

P0 should build on the current pet state machine instead of replacing it. The pet already knows how to look idle, focused, happy, sleepy, talking, and walking; focus adventures can reuse those states immediately.

## Non-Goals

P0 does not need:

- Multiplayer, visits, leaderboards, seasons, or social sharing.
- A full pet habitat, furniture economy, or long-form evolution art pipeline.
- Fully automatic skill authoring from arbitrary user behavior.
- Background file manipulation without explicit confirmation.
- A punitive streak system that makes the pet suffer when the user misses a day.

Those can come later. P0 should prove the core motivation loop first.

## Core Loop

### 1. Start Adventure

The user opens a small `Focus Adventure` panel from the existing pet toolbar or settings panel.

The panel asks for:

- Task title: short free text, for example `fix failing tests` or `write product plan`.
- Duration: preset buttons for 15, 25, 45, and 90 minutes.
- Intent type: `Code`, `Writing`, `Research`, `Learning`, `Planning`, `Admin`, or `Rest`.

When the adventure starts:

- The pet switches to `walking` briefly, then `focused`.
- The panel shows the timer, task title, expected reward types, and a stop/finish action.
- The app records a focus session in progress.

### 2. Work Phase

During the focus window, Petclaw stays lightweight:

- The pet remains in `focused`, `thinking`, or `walking` micro-states.
- The user can still chat, but chat is framed as helping the current adventure.
- If Gateway/OpenClaw status changes, the pet can react through existing notification and voice systems.

P0 should not try to detect every real action automatically. It can use explicit check-ins plus known app events.

Useful P0 event sources:

- Focus timer duration.
- User's task title and intent type.
- Messages sent through Petclaw.
- Existing work log entries.
- Gateway health or command events where available.
- Manual completion summary entered at the end.

### 3. Finish And Check In

At the end, the pet asks for a short completion check:

- `Completed`
- `Partial`
- `Interrupted`

If completed or partial, the user can add a one-sentence result summary. This summary matters because it becomes memory and skill material.

Example:

```text
Task: Fix failing preload tests
Result: Added missing IPC channel whitelist tests and made the exposed API match main process handlers.
```

### 4. Reward Settlement

The result screen should feel like an adventure return, but every reward type has a functional purpose.

Rewards:

- `Focus XP`: levels the pet and unlocks ability tiers.
- `Ability Fragments`: spend on specific AI capabilities.
- `Memory Crystals`: save meaningful work sessions as searchable pet memories.
- `Skill Seeds`: appear when the session looks like a repeatable workflow.
- `Stardust`: light currency for cosmetics and future habitat rewards.

Reward value should depend on:

- Duration actually completed.
- Completion status.
- Intent type.
- Whether the user wrote a result summary.
- Whether the task produced a reusable workflow.

The system should never punish the user with negative progress. Interrupted sessions still give a small amount of Focus XP and can produce a memory like `tried but got interrupted`.

## Reward Value Design

The key question is why the user should care about loot.

### Focus XP

Focus XP raises the pet's general level. Levels are not only badges; they gate ability tiers.

Example thresholds:

| Level | Meaning | Unlock Direction |
| --- | --- | --- |
| 1 | Companion | Basic AI chat |
| 2 | Observer | Project/context awareness |
| 3 | Planner | Better planning and workflow summaries |
| 4 | Operator | Permission-gated OpenClaw actions |
| 5 | Skillbearer | Skill cards, skill invocation, skill drafting |

P0 can implement the first visible progression up to Level 5 even if the deepest behavior is initially guarded by availability checks.

### Ability Fragments

Ability Fragments unlock named abilities. This makes progress feel intentional: the user is not only filling a bar, they are choosing what the pet learns.

P0 abilities:

| Ability | Tier | Effect |
| --- | --- | --- |
| `Warm Chat` | Companion | Basic AI API conversation with pet personality. |
| `Task Echo` | Companion | Pet remembers current adventure title and refers to it in chat. |
| `Project Glance` | Observer | Pet can summarize project name, current status, and recent local signals exposed by the app. |
| `Adventure Journal` | Observer | Pet turns completed focus sessions into short memories. |
| `Next Step` | Planner | Pet suggests the next action after a focus session. |
| `Workflow Lens` | Planner | Pet identifies whether a completed task could become a repeatable skill. |
| `OpenClaw Hands` | Operator | Pet can request permission to hand work to OpenClaw/Gateway-capable execution. |
| `Skill Book` | Skillbearer | Pet displays learned and draft skills as cards. |
| `Skill Forge` | Skillbearer | Pet can convert a completed workflow summary into a draft skill card. |

`OpenClaw Hands` must be permission-gated. Unlocking it means the pet is allowed to ask for execution, not allowed to silently edit files.

### Memory Crystals

Memory Crystals make focus sessions emotionally and practically valuable. They are short records of meaningful work.

Each crystal stores:

- Title.
- Date.
- Intent type.
- Completion status.
- Summary.
- Rewards earned.
- Related skill seed, if any.

The pet can later use crystals to say things like:

```text
We have done this kind of debugging twice before. Last time, checking preload IPC first helped.
```

P0 can display a simple memory list and let the pet reference the latest few memories in chat context.

### Skill Seeds

Skill Seeds are the bridge from game reward to real automation.

A Skill Seed appears when a focus session has at least one of these signals:

- The user describes a multi-step process in the result summary.
- The task intent is `Code`, `Research`, `Writing`, or `Planning` and the completion summary contains action verbs.
- The user explicitly marks `make this reusable`.
- The pet's `Workflow Lens` ability is unlocked and it detects a repeatable pattern.

A seed is not yet a runnable skill. It is a candidate.

Skill Seed fields:

```json
{
  "id": "seed-20260505-001",
  "title": "Preload IPC Test Fix",
  "sourceSessionId": "focus-20260505-001",
  "workflowSummary": "Inspect exposed preload channels, compare them with main process IPC handlers, add whitelist tests, run Jest.",
  "status": "candidate",
  "createdAt": "2026-05-05T00:00:00.000Z"
}
```

The player-facing message is:

> Your pet noticed this could become a skill.

This creates strong motivation: focus can produce reusable capabilities.

## AI Capability Growth

The evolution system should be capability-first. Visual evolution can come later, but P0 must establish that growth changes what the pet can do.

### Stage 0: Companion

Default state. The pet can:

- Chat through the configured AI API.
- Use its personality and current mood.
- React to clicks, messages, and simple focus state.

It cannot inspect files or take actions.

### Stage 1: Observer

Unlocked through Focus XP and Ability Fragments.

The pet can:

- Read safe app-level state, such as current adventure, recent session summaries, active appearance, and Gateway status.
- Summarize the project from already exposed app metadata.
- Keep short adventure memories.

It still cannot modify files.

### Stage 2: Planner

The pet can:

- Suggest next steps after a session.
- Identify repeated workflows.
- Prepare a plan for the user to approve.
- Propose a Skill Seed.

It still cannot execute file changes.

### Stage 3: Operator

The pet gains `OpenClaw Hands`.

The pet can:

- Ask to invoke OpenClaw/Gateway-backed workflows.
- Explain what it wants to do before executing.
- Require explicit confirmation for file reads, file writes, command execution, or external calls.
- Report success, failure, and what changed.

The capability gate should be both gamified and technical:

- The card must be unlocked in the ability tree.
- The local backend must be available.
- The requested action must pass existing security and IPC constraints.
- The user must confirm the action.

### Stage 4: Skillbearer

The pet owns a visible `Skill Book`.

The pet can:

- Show learned skills as cards.
- Show candidate Skill Seeds.
- Convert an approved seed into a draft skill record.
- Track skill mastery by successful use.

P0 does not need to write full Codex/OpenClaw skill files automatically. It should define the interaction and data shape so the implementation can later export real skills cleanly.

## Skill Cards

Every skill should feel like a pet ability, not a hidden file.

Card fields:

```json
{
  "id": "skill-video-summary",
  "name": "Video Summary",
  "type": "Content",
  "rarity": "rare",
  "status": "learned",
  "level": 2,
  "xp": 45,
  "description": "Extract subtitles, summarize chapters, and produce action notes.",
  "source": "Created from a completed focus workflow",
  "inputs": ["video file"],
  "outputs": ["summary markdown", "transcript"],
  "requires": ["OpenClaw Hands"],
  "lastUsedAt": "2026-05-05T00:00:00.000Z"
}
```

Statuses:

- `locked`: visible silhouette, not usable.
- `candidate`: created from a Skill Seed, needs review.
- `draft`: user approved the seed and the pet has a structured skill draft.
- `learned`: usable by the pet.
- `mastered`: used successfully enough times to gain a visual upgrade.

Rarity should be based on usefulness and complexity, not random loot:

- `common`: simple prompt or single-step helper.
- `rare`: repeatable multi-step workflow.
- `epic`: workflow that uses files, tools, or multiple stages.
- `legendary`: user-defined high-value workflow used repeatedly.

## P0 User Interface

### Focus Adventure Panel

Small panel near the pet:

- Task title input.
- Duration presets.
- Intent type segmented control.
- Start button.
- Current timer.
- Finish/interrupt button.

During focus, the pet body should visibly enter `focused` mode. If a spritesheet pet is active, use existing `focused` and `walking` rows.

### Adventure Result Panel

Shown when the timer ends or the user finishes:

- Completion status.
- One-line result summary.
- Reward reveal.
- `Save Memory` automatic if summary exists.
- `Forge Skill Seed` action if eligible.

### Ability Tree Panel

Simple vertical progression for P0:

```text
Companion
Observer
Planner
Operator
Skillbearer
```

Each tier expands into ability cards. Locked abilities show requirements.

### Skill Book Panel

Grid/list of skill cards:

- Learned skills.
- Candidate seeds.
- Draft skills.
- Mastery progress.
- Required capability badges.

P0 can keep this panel text-forward and compact. It should match the current utility HUD style rather than becoming a large game menu.

## Data Model

Store progress separately from visual appearance.

Recommended file:

```text
pet-progress.json
```

Initial shape:

```json
{
  "version": 1,
  "petLevel": 1,
  "focusXp": 0,
  "stardust": 0,
  "abilityFragments": 0,
  "unlockedAbilities": ["warm-chat"],
  "focusSessions": [],
  "memories": [],
  "skillSeeds": [],
  "skills": []
}
```

Focus session shape:

```json
{
  "id": "focus-20260505-001",
  "taskTitle": "Fix failing tests",
  "intentType": "Code",
  "plannedMinutes": 25,
  "actualMinutes": 23,
  "status": "completed",
  "summary": "Fixed preload IPC mismatch and added a regression test.",
  "rewards": {
    "focusXp": 42,
    "abilityFragments": 2,
    "stardust": 8,
    "memoryCrystal": true,
    "skillSeedId": "seed-20260505-001"
  },
  "startedAt": "2026-05-05T00:00:00.000Z",
  "endedAt": "2026-05-05T00:25:00.000Z"
}
```

## Architecture

P0 should introduce a small bounded game layer rather than spreading reward logic across the renderer.

Recommended modules:

- `pet-progress.js`: load, save, validate, and migrate progress.
- `focus-adventure.js`: focus session lifecycle and reward calculation.
- `pet-abilities.js`: level thresholds, ability definitions, unlock checks.
- `pet-skills.js`: skill seed and skill card data helpers.

Renderer responsibilities:

- Draw panels.
- Send user actions through IPC.
- Render progress and reward state.
- Reflect pet mood changes.

Main process responsibilities:

- Persist progress.
- Own timer/session state.
- Calculate rewards.
- Validate ability unlocks.
- Gate any OpenClaw/Gateway-backed action.

IPC examples:

- `focus-adventure-start`
- `focus-adventure-get`
- `focus-adventure-finish`
- `pet-progress-get`
- `pet-ability-unlock`
- `pet-skill-seed-create`
- `pet-skill-card-list`

## Error Handling And Safety

- If progress file is missing, create default progress.
- If progress file is corrupt, keep a backup and reset to default with a visible warning.
- If the app quits during a focus session, restore the active session on next launch and ask whether to resume, finish, or discard.
- If OpenClaw/Gateway is unavailable, Operator abilities remain visible but show `backend unavailable`.
- Unlocking an Operator ability never bypasses confirmation.
- Skill Seeds are drafts until the user explicitly approves them.
- No reward path should require external network access.
- Private file paths and task summaries should remain local unless the user explicitly sends them to the AI backend.

## Testing

Unit tests:

- Default progress creation.
- Reward calculation for completed, partial, and interrupted sessions.
- Level threshold behavior.
- Ability unlock requirements.
- Skill Seed eligibility rules.
- Corrupt progress backup/reset behavior.

IPC/preload tests:

- New channels are exposed only through the whitelist.
- Renderer cannot call arbitrary backend actions.

Manual verification:

- Start a 15-minute focus adventure.
- Finish early as completed and receive rewards.
- Finish as interrupted and receive small non-punitive rewards.
- Unlock an ability with fragments.
- Create a memory from a result summary.
- Create a Skill Seed from a reusable workflow summary.
- Open Skill Book and see the candidate card.
- With backend unavailable, Operator card is visible but blocked.

## Acceptance Criteria

P0 is successful when a user can:

- Start and finish a focus adventure from the pet UI.
- See the pet enter a focused/adventure state.
- Receive rewards that explain what they are useful for.
- Unlock at least one visible ability.
- Save at least one Memory Crystal.
- Generate at least one candidate Skill Seed.
- Open a Skill Book panel and see the seed as a skill-like card.

The emotional test is simple: after one real work session, the user should feel that the pet has learned something from working together.
