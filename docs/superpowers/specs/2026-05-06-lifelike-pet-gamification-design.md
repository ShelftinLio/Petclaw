# Lifelike Pet Gamification Design

Date: 2026-05-06

## Goal

Make Petclaw feel alive without turning the first version into a large animation-production project.

The approved direction is:

```text
Daily rhythm
+ Work reactions
+ Memory objects
+ Existing pet actions
+ Lightweight behavior director
```

The pet should feel like an emotionally valuable work partner: it keeps the companion-chat foundation, reacts to the user's work, and gradually leaves visible traces of shared experience around the pet.

## Product Promise

Petclaw is not only a chatbot with a pet skin and not only a focus timer. It is a desktop companion that seems to live beside the user, join focus sessions, remember shared work, and slowly learn the user's workflow.

The core feeling:

> The pet was here with me, noticed what happened, and brought something back from the work we did together.

## Existing Context

The current pet system already has enough action states for the first version:

- `idle`
- `happy`
- `talking`
- `thinking`
- `sleepy`
- `surprised`
- `focused`
- `offline`
- `sad`
- `walking`

The current custom pet spritesheet format uses those states across built-in and generated pets. The renderer already supports mood changes, sprite reactions, roaming, focus adventure start/finish states, and small UI panels.

Because of that, the first version should not require a new spritesheet layout or a large batch of new animation rows.

## Design Principle

Do not solve "alive" by adding many menus or many currencies.

Solve it by giving the pet:

- A daily rhythm.
- Small visible reactions to work.
- Objects that persist after shared experiences.
- A little initiative, without becoming noisy.

## Architecture Concept

Introduce a behavior director layer:

```text
Game or app event
-> Behavior director
-> Existing mood/action sequence
-> Optional overlay object, speech hint, or memory object update
```

The behavior director decides how to stage pet behavior. It does not own reward math, progress persistence, or AI responses. It translates events into animation scripts and visible pet-life moments.

Example:

```text
focus-adventure-finish(completed, memoryCrystal=true)
-> focused 300ms
-> walking 900ms
-> happy 1800ms
-> show memory crystal pop-in beside pet
-> return to rhythm state
```

## 1. Daily Rhythm

Daily rhythm gives the pet its own small life cycle. It should be driven by local time, recent interaction, current focus status, and idle duration.

First-version rhythm states:

| Rhythm State | Meaning | Existing Mood Mapping |
| --- | --- | --- |
| `fresh` | Awake, responsive, ready to work | `happy`, then `idle` |
| `curious` | Looking around, interested, lightly active | `thinking`, `walking` |
| `focused` | Working beside the user | `focused` |
| `tired` | Low energy, soft presence | `sleepy` |
| `quiet` | Calm, nonintrusive companionship | `idle`, occasional `sleepy` |

Suggested time behavior:

- Morning: wake animation, higher chance of `fresh`.
- Daytime: default `idle` with occasional `curious`.
- Afternoon or long idle: occasional `tired`.
- Evening: lower motion frequency, more `quiet`.
- Late night: quieter state, optional gentle rest hint.

Important constraint: daily rhythm must be non-punitive. The pet should not lose affection, become sick, or guilt the user for not working.

## 2. Work Reactions

Focus Adventure should feel like a small work scene, not just a timer.

First-version reaction scripts can be made entirely from existing actions:

| Event | Behavior Script |
| --- | --- |
| Focus setup opened | `thinking` reaction, then restore |
| Focus started | `walking` briefly, then `focused` |
| User asks for help during focus | `focused -> thinking -> talking -> focused` |
| Focus halfway point | small `thinking` reaction or quiet sparkle |
| Time nearly done | `surprised` reaction, then `focused` |
| Completed | `focused -> walking -> happy`, then memory object pop-in |
| Partial | `focused -> thinking -> happy`, then smaller memory object pop-in |
| Interrupted | `focused -> surprised -> sleepy`, save state without blame |
| Ability unlocked | `surprised -> happy`, brief badge glow |
| Skill seed created | `thinking -> happy`, seed object appears |

Task intent can change the overlay object or small visual prop, without requiring different pet animations:

| Intent | Suggested Prop |
| --- | --- |
| Code | tiny bug mark, wrench, test scroll |
| Writing | feather pen, paper, spark |
| Research | magnifier, folder, map scrap |
| Learning | book, note card |
| Planning | flag, route map |
| Admin | stamp, checklist |
| Rest | blanket, tea cup |

The pet's motion remains simple. The meaning comes from timing and props.

## 3. Memory Objects

Memory objects make shared history visible. They should be rendered around the pet, not baked into every pet spritesheet.

First-version object types:

| Object | Source | Meaning |
| --- | --- | --- |
| Memory Crystal | Completed or partial focus session with a summary | A shared work memory |
| Skill Seed | Reusable workflow candidate | This could grow into a skill |
| Skill Badge | Learned or mastered skill | The pet can use this workflow |
| Task Note | Active focus adventure | What the pet is currently helping with |

Preferred first-version placement:

- Use overlay objects near the pet's feet or side.
- Show only the most recent 1-3 objects in the desktop pet view.
- Keep the full list in the Adventure or Skill Book window.
- Let objects pop in after the relevant reaction script.

This keeps the system reusable across built-in pets, custom spritesheets, and generated pets.

## Object Progression

The object progression should mirror the existing focus and skill model:

```text
Focus session with summary
-> Memory Crystal
-> Similar/reusable memories
-> Skill Seed
-> User confirms
-> Skill Card
-> Skill Badge / mastered decoration
```

The visual progression:

```text
Crystal appears
-> Seed sprouts beside related crystals
-> Learned skill becomes a badge
-> Mastered skill gains a stronger visual treatment
```

## Relationship To Current Action Module

First version should use existing actions as semantic building blocks:

- `idle`: baseline life.
- `walking`: movement, fetching, returning from work.
- `focused`: active focus session.
- `thinking`: planning, noticing, analyzing.
- `talking`: companion chat or work response.
- `happy`: completion and unlock celebration.
- `sleepy`: tired or interrupted, without punishment.
- `surprised`: time warning, discovery, unlock.
- `sad`: reserved for genuine failure or unavailable state, used sparingly.
- `offline`: backend or Gateway disconnected state.

Only the director layer is new conceptually. New animation rows are optional later.

## Deferred New Actions

Second-version animation rows could add more charm:

- `carry`: pet brings back a memory object.
- `write`: pet writes in a notebook.
- `stretch`: daily rhythm wake/rest.
- `celebrate`: stronger task completion moment.
- `inspect`: pet looks at a memory object or skill seed.

These should not block the first version.

## User Experience Examples

### Morning Start

```text
App opens
-> sleepy for a moment
-> happy wake reaction
-> idle/fresh state
-> optional short line: "What should we catch first today?"
```

### Focus Completion

```text
User finishes a Code focus session
-> pet shifts from focused to walking
-> pet returns happy
-> a Memory Crystal appears near it
-> reward text mentions XP, fragments, and saved memory
```

### Reusable Workflow Discovery

```text
User summary describes several steps
-> pet thinking reaction
-> Skill Seed object appears like a small sprout
-> Skill Book shows the candidate seed
-> user can confirm later
```

### Long Idle

```text
No interaction for a while
-> pet stays quiet
-> occasional walking/thinking reaction
-> no guilt message
-> if late night, optional gentle rest line
```

## Data Needed

The existing `pet-progress.json` can stay the source for focus sessions, memories, skill seeds, and skills.

The behavior director may need derived state, not a large new persistence model:

```json
{
  "rhythmState": "quiet",
  "activeFocusSession": "...",
  "recentMemoryObjects": ["memory-focus-..."],
  "recentSkillSeedObjects": ["seed-focus-..."]
}
```

Persistent object data should remain tied to memories and skills. The renderer can derive the visible 1-3 desktop objects from progress.

## Error Handling And Safety

- If no progress exists, render no objects and use normal rhythm.
- If a custom pet lacks a requested mood, fall back to `idle` or `happy`.
- If multiple events happen quickly, behavior scripts should queue or replace low-priority scripts.
- Focus, chat, and backend status should have higher priority than idle rhythm.
- Object overlays should never block pet dragging, toolbar access, or conversation input.

## First-Version Acceptance Criteria

The first version is successful when:

- The pet shows a time-aware rhythm using existing moods.
- Starting focus visibly changes the pet into a work-partner state.
- Finishing focus plays a short reaction sequence.
- A Memory Crystal or Skill Seed appears near the pet when earned.
- The user can see that recent work left traces beside the pet.
- No new spritesheet rows are required.

The emotional acceptance test:

> After a completed focus run, the user should feel that the pet came back with something from the shared work.

## Implementation Boundary

This design intentionally does not implement:

- A full habitat.
- A cosmetics shop.
- Punitive care mechanics.
- New spritesheet rows.
- Multiplayer or social sharing.
- Automatic execution of workflow skills.

The first version should make the existing pet feel alive before expanding the asset system.
