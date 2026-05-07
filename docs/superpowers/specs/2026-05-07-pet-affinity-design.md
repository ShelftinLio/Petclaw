# Pet Affinity System Design

Date: 2026-05-07

## Goal

Add a first-version intimacy system for Petclaw that makes the desktop pet feel more personally bonded to the user through repeated interaction and visible collection rewards.

The approved direction is:

```text
Pet interaction events
-> affinity XP
-> existing pet reaction feedback
-> affinity level thresholds
-> unlocked bond collection items
```

This system should make the user feel that the pet is becoming "my pet" over time, while keeping the implementation small enough to fit the current architecture.

## Product Positioning

Petclaw already has a work-growth line:

- `focusXp`
- `petLevel`
- `abilityFragments`
- `unlockedAbilities`
- Focus Adventure memories and skill seeds

Affinity should not replace that line. The distinction is:

| System | Meaning | Unlocks |
| --- | --- | --- |
| Pet level | Work growth and capability | Abilities and workflow-related powers |
| Affinity level | Relationship warmth and ownership | Reactions, desktop collection items, bond presentation |

The first version focuses on collection and visible expression, not functional privilege.

## First-Version Scope

Build a combined B + C approach:

1. Click, chat, voice, focus completion, and memory creation raise affinity.
2. Affinity events trigger lightweight feedback using existing pet actions.
3. Affinity levels unlock bond collection items.
4. Recent bond items can be shown near the desktop pet.
5. The pet game or progress window can show full affinity progress and the collection list.

This version intentionally avoids:

- New spritesheet animation rows.
- Affinity decay, punishment, sickness, or guilt.
- A shop, gacha, inventory economy, or item upgrade system.
- Affinity-gated AI abilities.
- Large behavior-director changes beyond calling existing reactions from interaction events.

## Design Principles

1. Keep it non-punitive. Affinity only grows; absence should not reduce it.
2. Make clicking feel good without making clicking the best way to progress.
3. Reward shared experiences more than repetitive input.
4. Reuse existing moods and object overlay concepts before adding asset complexity.
5. Keep affinity data in the existing progress save path so it travels with the pet.

## Affinity Levels

| Level | Name | XP Threshold | Reaction Expression | Bond Item |
| --- | --- | ---: | --- | --- |
| 1 | First Meeting | 0 | Normal `happy` click feedback | None |
| 2 | Familiar | 40 | Click can play `walking -> happy` | Small Toy |
| 3 | Close | 120 | Focus completion can play `thinking -> happy` | Bond Sticker |
| 4 | Trusted | 260 | Idle can occasionally lean into `sleepy` or calm `idle` | Cozy Nest |
| 5 | Bonded | 480 | Level-up can play `surprised -> happy` celebration | Bond Badge |

Names can be localized in UI. The stored values should use stable IDs such as:

```json
[
  "first-meeting",
  "familiar",
  "close",
  "trusted",
  "bonded"
]
```

## Affinity Sources

| Event Type | XP | Limit |
| --- | ---: | --- |
| Pet click | 1 | Daily click XP cap: 20 |
| Text message sent | 2 | Daily chat XP cap: 20 |
| Voice interaction | 3 | Daily voice XP cap: 15 |
| Focus Adventure completed or partial | 8 | No separate daily cap |
| Focus summary provided | +4 | Only during focus finish |
| Memory Crystal created | +5 | Only when a memory is created |

Interrupted focus sessions should not grant the focus completion affinity reward. They may still create a Memory Crystal if the user provided a summary, and that memory can still grant the memory bonus. This avoids blame while keeping completion meaningful.

Clicking should be satisfying but rate-limited. A user can click for warmth every day, but the strongest progress should come from chatting and completing shared work.

## Daily Caps

Track daily capped categories separately:

```json
{
  "date": "2026-05-07",
  "clickXp": 12,
  "chatXp": 8,
  "voiceXp": 0
}
```

When the local date changes, reset these counters. Focus and memory rewards are not part of these category caps because they already require larger app workflows.

Use local app date rather than UTC for the daily cap. This matches the user's lived day and avoids surprising resets during normal use.

## Data Model

Extend `pet-progress.json` through `createDefaultProgress()` and `normalizeProgress()`:

```json
{
  "affinityXp": 0,
  "affinityLevel": 1,
  "bondItems": [],
  "interactionStats": {
    "dailyAffinity": {
      "date": "2026-05-07",
      "clickXp": 0,
      "chatXp": 0,
      "voiceXp": 0
    },
    "totalClicks": 0,
    "totalTextMessages": 0,
    "totalVoiceInteractions": 0,
    "totalAffinityEvents": 0,
    "lastInteractionAt": ""
  }
}
```

`affinityLevel` should be derived from `affinityXp` during normalization, like `petLevel` is derived from `focusXp`. This keeps corrupted or manually edited saves from drifting.

`bondItems` should be normalized from the current affinity level. Items are unlocked once and persist:

```json
[
  {
    "id": "small-toy",
    "levelRequired": 2,
    "unlockedAt": "2026-05-07T09:30:00.000Z"
  }
]
```

## New Module

Create a focused module, likely `pet-affinity.js`, instead of expanding `pet-progress.js` with all reward rules.

Responsibilities:

- Define affinity thresholds.
- Define bond item unlocks.
- Normalize affinity state.
- Calculate level from XP.
- Apply an affinity event with caps.
- Return a compact result for UI feedback.

Suggested API:

```js
calculateAffinityLevel(affinityXp)
getAffinityTier(affinityXp)
getBondItemsForLevel(affinityLevel)
normalizeAffinity(progress, options)
applyAffinityEvent(progress, eventType, options)
```

Example event result:

```json
{
  "progress": {
    "affinityXp": 41,
    "affinityLevel": 2
  },
  "appliedXp": 1,
  "capped": false,
  "levelChanged": false,
  "unlockedBondItems": [],
  "reaction": "happy"
}
```

## Event Types

Use stable internal event IDs:

| ID | Source |
| --- | --- |
| `pet-click` | Desktop pet click |
| `text-message` | User sends a text message |
| `voice-message` | User completes a voice interaction |
| `focus-finished` | Focus Adventure finishes as completed or partial |
| `focus-summary` | Focus Adventure finish includes a non-empty summary |
| `memory-created` | `applyFinishedSession()` creates a Memory Crystal |

The focus finish path can apply multiple events in sequence:

```text
focus-finished
+ optional focus-summary
+ optional memory-created
```

This makes the reward breakdown easy to display and test.

## Reaction Mapping

Reuse existing pet moods and short scripts:

| Event | Reaction |
| --- | --- |
| Pet click, level 1 | `happy` |
| Pet click, level 2+ | sometimes `walking -> happy`, otherwise `happy` |
| Text or voice interaction | `talking` or `happy` |
| Focus finished, level 3+ | `thinking -> happy` |
| Bond item unlocked | `surprised -> happy` |
| Level 4 idle flavor | occasional `sleepy` or calm `idle` |

If a custom pet lacks a requested mood, the renderer should fall back to `idle` or `happy`, following existing action fallback behavior.

## Bond Collection Items

First-version items should be small, symbolic, and reusable across all pets:

| Item ID | Level | Display Name | Desktop Role |
| --- | ---: | --- | --- |
| `small-toy` | 2 | Small Toy | A tiny prop near the pet |
| `bond-sticker` | 3 | Bond Sticker | A small sticker/card in the recent object row |
| `cozy-nest` | 4 | Cozy Nest | A soft base or blanket-like marker near the pet |
| `bond-badge` | 5 | Bond Badge | A stronger badge or glow-capable marker |

The desktop pet view should show only the most recent or highest-priority 1-3 items, so the pet area does not become cluttered. The full collection belongs in the pet game window.

Item rendering can begin with CSS/HTML badges or small bundled images. New bitmap assets are optional for the first implementation.

## UI

Desktop pet view:

- Clicking the pet can produce a small `+1` or subtle heart/spark feedback if not capped.
- When capped, still play a friendly reaction but avoid showing XP gain.
- Show 1-3 unlocked bond items near the pet without blocking dragging, toolbar buttons, or chat UI.

Pet game window:

- Add an Affinity section near existing progress.
- Show current affinity level, name, XP progress to next level, and unlocked collection items.
- Show locked item silhouettes or simple locked cards for upcoming items.

Copy should stay light. The UI does not need explanatory tutorial text.

## Integration Points

### `pet-progress.js`

- Include default affinity fields.
- Normalize affinity state through `pet-affinity.js`.
- Recalculate `affinityLevel` from `affinityXp`.
- Preserve old saves that lack affinity data.

### `main.js`

- Add a central interaction recording handler, for example `pet-affinity-record`.
- Update progress store through `applyAffinityEvent()`.
- Broadcast progress changes through the existing `pet-progress-changed` path.
- On focus finish, apply focus and memory affinity rewards after existing focus rewards.

### `preload.js`

- Expose the new IPC channel through the existing allowlist.

### `index.html`

- On desktop pet click, call the affinity record channel.
- Play or request the returned reaction.
- Render small desktop bond items derived from progress.

### `pet-game-window.html`

- Render affinity level, next-level progress, and bond item collection.

### Tests

Add focused tests for:

- Level calculation at thresholds.
- Daily cap behavior for click/chat/voice events.
- Focus and memory rewards applying without daily caps.
- Bond items unlocking once.
- Old progress normalization.
- IPC channel allowlist inclusion.

## Error Handling

- Unknown affinity event IDs should return a structured error or no-op result, not corrupt progress.
- Invalid XP values should normalize to 0.
- Missing `interactionStats` should be recreated.
- Invalid daily cap dates should reset to the current local date.
- Bond items should be de-duplicated by ID.

## Technical Complexity

This B + C version is medium-low complexity:

| Area | Complexity | Reason |
| --- | --- | --- |
| Data model | Low | Extends existing progress JSON |
| Reward math | Low | Simple thresholds and caps |
| IPC integration | Medium | Needs renderer-to-main event recording |
| Focus integration | Medium | Needs careful sequencing with existing rewards |
| Desktop item rendering | Medium | Must avoid overlap and drag interference |
| New animation support | None | Existing moods are reused |
| Custom pet compatibility | Low risk | No new spritesheet states required |

The highest implementation risk is UI clutter around the desktop pet, not the reward math.

## Acceptance Criteria

The first version is successful when:

- Clicking the pet can increase affinity, up to the daily click cap.
- Chat and voice interactions can increase affinity, up to their daily caps.
- Completing or partially completing a Focus Adventure increases affinity.
- Focus summaries and Memory Crystals grant additional affinity.
- Affinity level is derived from affinity XP and persists in `pet-progress.json`.
- Reaching levels 2-5 unlocks the expected bond collection items.
- At least one bond item can appear near the desktop pet.
- The pet game window shows affinity progress and collection state.
- Existing pet level, ability unlocks, memories, and skills continue to work.

The emotional acceptance test:

> After interacting for a while, the user should see small relationship traces around the pet and feel that the pet has become more personally theirs.

## Future Extensions

Later versions can add:

- Dedicated bond animations such as nuzzle, carry, stretch, or celebrate.
- Higher-level bond item art.
- A habitat or room view.
- Personality-specific bond item variants.
- Optional affinity-based idle initiative.
- Seasonal or milestone memories.

These should wait until the first version proves that the basic loop feels good.
