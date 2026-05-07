# Pet Affinity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first-version B + C pet affinity loop: interactions add affinity XP, existing reactions play, and bond items unlock and display.

**Architecture:** Add a focused `pet-affinity.js` module for thresholds, daily caps, event rewards, and bond item unlocks. Keep persistence in `pet-progress.js`, expose one IPC event recorder from `main.js`, and render affinity progress in the desktop pet and compact game window.

**Tech Stack:** Electron main/renderer, CommonJS modules, JSON progress persistence, Jest tests.

---

### Task 1: Core Affinity Rules

**Files:**
- Create: `pet-affinity.js`
- Create: `tests/__tests__/pet-affinity.test.js`
- Modify: `pet-progress.js`
- Modify: `tests/__tests__/pet-progress.test.js`

- [ ] **Step 1: Write failing tests** for level thresholds, daily caps, focus rewards, bond item unlocks, and old progress normalization.
- [ ] **Step 2: Run targeted tests** with `npx jest tests/__tests__/pet-affinity.test.js tests/__tests__/pet-progress.test.js --runInBand`; expect failures for missing affinity module and fields.
- [ ] **Step 3: Implement `pet-affinity.js`** with `calculateAffinityLevel`, `getAffinityTier`, `normalizeAffinity`, and `applyAffinityEvent`.
- [ ] **Step 4: Integrate `pet-progress.js`** so defaults and normalization include affinity fields and derived `affinityLevel`.
- [ ] **Step 5: Re-run targeted tests**; expect pass.

### Task 2: Main Process Integration

**Files:**
- Modify: `main.js`
- Modify: `preload.js`
- Modify: `tests/__tests__/preload-channels.test.js`

- [ ] **Step 1: Write failing whitelist and source tests** for `pet-affinity-record`, focus affinity reward output, and renderer hooks.
- [ ] **Step 2: Run `npx jest tests/__tests__/preload-channels.test.js --runInBand`**; expect failures for missing channel and hooks.
- [ ] **Step 3: Add `pet-affinity-record` IPC** in `main.js`, using `applyAffinityEvent()` and broadcasting `pet-progress-changed`.
- [ ] **Step 4: Apply focus affinity events** after `applyFinishedSession()`: `focus-finished` for completed/partial, `focus-summary` for non-empty summaries, and `memory-created` when the session created a memory.
- [ ] **Step 5: Add `pet-affinity-record` to preload allowlist** and re-run targeted tests.

### Task 3: Renderer Affinity Presentation

**Files:**
- Modify: `index.html`
- Modify: `pet-game-window.html`
- Modify: `tests/__tests__/preload-channels.test.js`

- [ ] **Step 1: Write failing renderer source tests** for desktop bond item markup, click recording, chat recording, and compact affinity collection display.
- [ ] **Step 2: Add desktop affinity UI**: an overlay container for 1-3 bond items and a small floating gain indicator.
- [ ] **Step 3: Add desktop event hooks** for pet click and successful text message sends.
- [ ] **Step 4: Add compact game window affinity section** with level, XP-to-next-level, and bond item collection cards.
- [ ] **Step 5: Re-run targeted renderer tests**.

### Task 4: Verification And Restart

**Files:**
- No new production files beyond Tasks 1-3.

- [ ] **Step 1: Run targeted Jest suite** for affinity, progress, preload channels, and focus adventure.
- [ ] **Step 2: Compile-check touched JS** with `node --check pet-affinity.js`, `node --check pet-progress.js`, and `node --check preload.js`.
- [ ] **Step 3: Restart Petclaw from `C:\Users\Administrator\Desktop\黑客马拉松\Petclaw_win\Petclaw-git` using `npm start`.**
- [ ] **Step 4: Verify the new running Electron process points to the current workspace path.
