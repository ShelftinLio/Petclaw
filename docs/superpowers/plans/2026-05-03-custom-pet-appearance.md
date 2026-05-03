# Custom Pet Appearance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed glass orb with a default Codex-style cow-cat and add three customization paths: local image upload, `$imagegen` handoff, and pet package import.

**Architecture:** Add a small manifest/config helper module for testable behavior, expose appearance IPC from the Electron main process, and update the renderer to choose between the built-in cow-cat DOM renderer and image/spritesheet custom pets. The existing mood system remains the animation source of truth.

**Tech Stack:** Electron 28, vanilla HTML/CSS/JS, Node filesystem APIs, Jest.

---

## File Map

- Modify `pet-config.js`: add default `appearance` values and merge them safely when loading old config files.
- Create `pet-appearance.js`: normalize appearance config, validate/import manifests, create custom pet records, and provide safe path helpers.
- Modify `preload.js`: allow appearance IPC channels.
- Modify `main.js`: add IPC handlers for appearance state, local image import, generated-image saving, package import, and reset.
- Modify `index.html`: replace orb markup/CSS with cow-cat renderer, add appearance panel, local image pixelization canvas flow, and renderer switching.
- Create `assets/pets/cow-cat/pet.json`: built-in cow-cat manifest.
- Create `tests/__tests__/pet-appearance.test.js`: tests for manifest/config behavior.
- Modify `tests/__tests__/pet-config.test.js`: assert default appearance config.

## Tasks

### Task 1: Lock Appearance Config Behavior

- [ ] Add failing Jest tests for default `appearance` config in `tests/__tests__/pet-config.test.js`.
- [ ] Add failing Jest tests for `normalizeAppearanceConfig`, `createBuiltInCowCatManifest`, and manifest validation in `tests/__tests__/pet-appearance.test.js`.
- [ ] Run the targeted tests and confirm they fail because `pet-appearance.js` and default config do not exist yet.
- [ ] Implement `pet-appearance.js` and update `pet-config.js`.
- [ ] Run the targeted tests and confirm they pass.

### Task 2: Add Main-Process Appearance IPC

- [ ] Add failing tests for pure helper functions used by import/save logic where possible.
- [ ] Add IPC channel names to `preload.js`.
- [ ] Add `main.js` handlers for `appearance-get`, `appearance-set-active`, `appearance-reset`, `appearance-upload-image`, `appearance-save-generated-image`, `appearance-import-package`, and `appearance-imagegen-status`.
- [ ] Keep all filesystem writes inside `assets/pets/custom/<pet-id>`.
- [ ] Run the focused Jest tests and existing config tests.

### Task 3: Replace Default Visual With Cow-Cat Renderer

- [ ] Update `index.html` markup to make `#pet` host the cow-cat DOM structure.
- [ ] Replace glass orb CSS with pixel cow-cat CSS while keeping toolbar/input placement stable.
- [ ] Update mood application so cow-cat receives mood classes and custom image pets receive image transforms.
- [ ] Preserve drag, click, toolbar, input, voice, screenshot, and model switch behavior.

### Task 4: Add Customization Panel

- [ ] Add the appearance toolbar button and panel.
- [ ] Implement `Upload Image` flow: invoke file picker, pixelize selected image in canvas, save generated PNG through IPC, switch active pet.
- [ ] Implement `Import Package` flow: invoke package picker, validate/copy package, switch active pet.
- [ ] Implement `Generate with AI` panel state: explain `$imagegen` is the supported Codex generation route and show configuration-needed state inside the runtime app.
- [ ] Implement `Cow Cat` and `Reset` actions.

### Task 5: Verify And Commit

- [ ] Run `npm test -- --runInBand tests/__tests__/pet-config.test.js tests/__tests__/pet-appearance.test.js`.
- [ ] Run `npm test -- --runInBand`.
- [ ] Start the app with `npm run dev` and verify the window renders without console errors.
- [ ] Review `git diff` for accidental unrelated edits.
- [ ] Commit and push the implementation.
