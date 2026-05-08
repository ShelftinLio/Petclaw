# Pet Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a visual Pet Studio opened from Settings for browsing pets, previewing each animation, uploading reference images for hatch generation packages, and importing completed pet packages.

**Architecture:** Reuse the existing appearance manifest and IPC contract. Add a single main-process window opener, a small standalone HTML Studio renderer, and focused tests for preload exposure plus full hatch state coverage.

**Tech Stack:** Electron 28, vanilla HTML/CSS/JS, Node filesystem APIs, Jest.

---

## File Map

- Modify `preload.js`: expose `pet-studio-open` through the existing invoke whitelist.
- Modify `main.js`: add `openPetStudio()` and `ipcMain.handle('pet-studio-open')`.
- Modify `index.html`: replace the many pet setting buttons with one `Pet Studio` button while keeping reset/status controls available.
- Create `pet-studio.html`: render the pet library, live action preview, upload-generation flow, import package flow, activate, and reset.
- Modify `tests/__tests__/pet-appearance.test.js`: assert generated hatch requests expose every expected animation state.
- Create `tests/__tests__/preload-channels.test.js`: assert whitelisted invoke channels include `pet-studio-open`.

## Tasks

### Task 1: Lock Channel And State Contract

- [ ] Add this failing test to `tests/__tests__/preload-channels.test.js`:

```js
const fs = require('fs')
const path = require('path')

describe('preload channel whitelist', () => {
  test('exposes Pet Studio opener to renderers', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'preload.js'), 'utf8')
    expect(source).toContain("'pet-studio-open'")
  })
})
```

- [ ] Add this failing expectation to `tests/__tests__/pet-appearance.test.js` inside `createImagegenPetRequest creates a hatch-style generation package request`:

```js
expect(Object.keys(request.manifest.states)).toEqual([
  'idle',
  'happy',
  'talking',
  'thinking',
  'sleepy',
  'surprised',
  'focused',
  'offline',
  'sad',
  'walking',
])
```

- [ ] Run `npm.cmd test -- --runInBand tests/__tests__/preload-channels.test.js tests/__tests__/pet-appearance.test.js` and confirm the new preload test fails because the channel is missing.

### Task 2: Add Pet Studio Window Opener

- [ ] Modify `preload.js` by adding `'pet-studio-open'` to `VALID_INVOKE_CHANNELS`.
- [ ] Modify `main.js` near `openModelSettings()` with:

```js
let petStudioWindow = null;
function openPetStudio() {
  if (petStudioWindow && !petStudioWindow.isDestroyed()) {
    petStudioWindow.focus();
    return;
  }

  petStudioWindow = new BrowserWindow({
    width: 920,
    height: 620,
    title: 'Pet Studio',
    frame: false,
    resizable: true,
    minimizable: true,
    maximizable: false,
    backgroundColor: '#f8f8f4',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  petStudioWindow.setMenuBarVisibility(false);
  petStudioWindow.loadFile('pet-studio.html');
  petStudioWindow.on('closed', () => {
    petStudioWindow = null;
  });
}
```

- [ ] Add this IPC handler beside `model-open-settings`:

```js
ipcMain.handle('pet-studio-open', async () => {
  openPetStudio();
  return { success: true };
});
```

- [ ] Run the targeted Jest command again and confirm it passes.

### Task 3: Replace Settings Pet Controls With Pet Studio Entry

- [ ] Modify `index.html` settings markup so the Pet section contains `Pet Studio` plus `Reset Pet`.
- [ ] Add `openPetStudio()` renderer function:

```js
async function openPetStudio() {
  if (!electronAPI) return;
  await electronAPI.invoke('pet-studio-open');
  setAppearanceNote('Pet Studio opened.');
}
```

- [ ] Keep `resetAppearance()` and `loadAppearance()` unchanged so the HUD updates when the user resets from Settings.

### Task 4: Build `pet-studio.html`

- [ ] Create a standalone HTML file with three columns: library, preview, tools.
- [ ] On load, call `appearance-get`, merge `state.builtInPets` and `state.appearance.customPets`, and render selectable pet rows.
- [ ] Preview spritesheets by sizing the image to `columns * 100%` by `rows * 100%` and translating by selected frame and state row.
- [ ] Preview static image pets with `object-fit: contain` and a `Static` metadata badge.
- [ ] Implement action buttons from the known state order and fall back to `idle` when a pet lacks a state.
- [ ] Implement `Activate`, `Reset`, `Upload Reference`, and `Import Package` buttons by invoking the existing appearance IPC channels and refreshing state after each success.

### Task 5: Verify And Ship

- [ ] Run `npm.cmd test -- --runInBand tests/__tests__/preload-channels.test.js tests/__tests__/pet-appearance.test.js`.
- [ ] Run `node --check main.js`.
- [ ] Run `node --check preload.js`.
- [ ] Start or restart the app with `npm.cmd run dev`.
- [ ] Confirm the Settings panel opens Pet Studio and the Studio previews Cow Cat actions.
- [ ] Commit and push only tracked implementation files and the new docs; leave `assets/pets/custom/` and `temp_screenshot.py` untracked.
