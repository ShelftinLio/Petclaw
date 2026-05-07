const fs = require('fs')
const path = require('path')

describe('preload channel whitelist', () => {
  test('exposes Pet Studio opener to renderers', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'preload.js'), 'utf8')

    expect(source).toContain("'pet-studio-open'")
  })

  test('exposes direct basic chat channel to renderers', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'preload.js'), 'utf8')

    expect(source).toContain("'direct-chat-send'")
  })

  test('exposes automatic pet generation channels to renderers', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'preload.js'), 'utf8')

    expect(source).toContain("'appearance-generate-pet'")
    expect(source).toContain("'appearance-generate-pet-description'")
    expect(source).toContain("'appearance-delete-pet'")
    expect(source).toContain("'appearance-generation-status'")
    expect(source).toContain("'appearance-generation-progress'")
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
      'pet-skill-learn',
      'pet-skill-card-list',
      'pet-affinity-record',
      'pet-game-open',
    ]

    for (const channel of channels) {
      expect(source).toContain(`'${channel}'`)
    }
    expect(source).toContain("'pet-progress-changed'")
    expect(source).toContain("'pet-game-tab'")
  })

  test('exposes file inbox channels to renderers', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'preload.js'), 'utf8')
    const channels = [
      'inbox-get-state',
      'inbox-add-files',
      'inbox-capture-clipboard',
      'inbox-open-root',
      'inbox-open-item',
      'inbox-reveal-item',
      'inbox-remove-record',
      'inbox-start-drag',
    ]

    for (const channel of channels) {
      expect(source).toContain(`'${channel}'`)
    }
  })

  test('renderer includes gamified focus panel hooks', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')

    expect(source).toContain('id="btnAdventure"')
    expect(source).toContain('openPetGame')
    expect(source).toContain('id="focusAdventurePanel"')
    expect(source).toContain('startFocusAdventure')
    expect(source).toContain('renderPetProgress')
    expect(source).toContain('openSkillBook')
  })

  test('main renderer draws custom spritesheet pets through a centered canvas frame', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')

    expect(source).toContain('id="customPetCanvas"')
    expect(source).toContain('drawCustomPetFrame')
    expect(source).toContain('customPetFrameImage')
    expect(source).toContain('getCustomPetFrameGeometry')
    expect(source).toContain('calculateFrameCoreOffset')
    expect(source).toContain('const { dx, dy } = calculateFrameCoreOffset(frameData, customPetCanvas.width, customPetCanvas.height)')
  })

  test('pet appearance UI keeps deletion inside the pet studio library', () => {
    const mainSource = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')
    const studioSource = fs.readFileSync(path.join(__dirname, '..', '..', 'pet-studio.html'), 'utf8')

    expect(mainSource).not.toContain('deleteActivePet')
    expect(mainSource).not.toContain('appearance-delete-pet')
    expect(mainSource).toContain('overflow-y: auto !important')
    expect(studioSource).toContain('deletePetById')
    expect(studioSource).toContain('data-delete-id')
    expect(studioSource).toContain('Delete Pet')
    expect(studioSource).toContain('appearance-delete-pet')
    expect(studioSource).toContain('isBuiltInPet')
    expect(studioSource).toContain("pet.source === 'built-in'")
  })

  test('pet appearance UI exposes generation progress affordances', () => {
    const studioSource = fs.readFileSync(path.join(__dirname, '..', '..', 'pet-studio.html'), 'utf8')

    expect(studioSource).toContain('id="generationProgress"')
    expect(studioSource).toContain("electronAPI.on('appearance-generation-progress'")
  })

  test('pet studio separates static pet preview from the full spritesheet', () => {
    const studioSource = fs.readFileSync(path.join(__dirname, '..', '..', 'pet-studio.html'), 'utf8')

    expect(studioSource).toContain('id="stillViewport"')
    expect(studioSource).toContain('id="sheetPreview"')
    expect(studioSource).toContain('renderStillPreview')
    expect(studioSource).toContain('renderSpriteSheetPreview')
    expect(studioSource).toContain('id="stillCanvas"')
    expect(studioSource).toContain('drawCenteredFrame')
    expect(studioSource).toContain('startFrameAnimation')
  })

  test('dedicated pet game window is wired for compact gamified panels', () => {
    const mainSource = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8')
    const windowSource = fs.readFileSync(path.join(__dirname, '..', '..', 'pet-game-window.html'), 'utf8')

    expect(mainSource).toContain("ipcMain.handle('pet-game-open'")
    expect(mainSource).toContain("ipcMain.handle('pet-skill-learn'")
    expect(mainSource).toContain("ipcMain.handle('pet-affinity-record'")
    expect(mainSource).toContain('settleFinishedSession')
    expect(mainSource).toContain('affinityEvents')
    expect(mainSource).toContain('petGameWindow')
    expect(mainSource).toContain('width: 300')
    expect(mainSource).toContain('height: 420')
    expect(mainSource).toContain('backgroundThrottling: false')
    expect(windowSource).toContain('class="compact-shell"')
    expect(windowSource).toContain('id="focusView"')
    expect(windowSource).toContain('id="abilitiesView"')
    expect(windowSource).toContain('id="skillsView"')
    expect(windowSource).toContain("petBridge.invoke('pet-progress-get'")
    expect(windowSource).toContain("petBridge.on('pet-game-tab'")
    expect(windowSource).toContain('startFocusAdventure')
    expect(windowSource).toContain('finishFocusAdventure')
    expect(windowSource).toContain('unlockPetAbility')
    expect(windowSource).toContain('id="recentRuns"')
    expect(windowSource).toContain('createSkillSeedFromSession')
    expect(windowSource).toContain("petBridge.invoke('pet-skill-seed-create'")
    expect(windowSource).toContain('learnPetSkill')
    expect(windowSource).toContain("petBridge.invoke('pet-skill-learn'")
    expect(windowSource).toContain('data-skill-seed-id')
    expect(windowSource).toContain('id="affinityPanel"')
    expect(windowSource).toContain('renderBondItems')
  })

  test('desktop renderer records affinity events and renders bond items', () => {
    const mainSource = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')

    expect(mainSource).toContain('id="bondItemOverlay"')
    expect(mainSource).toContain('recordPetAffinity')
    expect(mainSource).toContain("recordPetAffinity('pet-click'")
    expect(mainSource).toContain("recordPetAffinity('text-message'")
    expect(mainSource).toContain('renderBondItemOverlay')
    expect(mainSource).toContain('showAffinityGain')
  })

  test('main renderer replaces screenshot controls with file inbox controls', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')

    expect(source).toContain('id="btnInbox"')
    expect(source).toContain('toggleInboxTray')
    expect(source).toContain('id="inboxTray"')
    expect(source).toContain('id="inboxDropZone"')
    expect(source).toContain('captureInboxClipboard')
    expect(source).toContain('startInboxDrag')
    expect(source).not.toContain('id="btnScreenshot"')
    expect(source).not.toContain('<button onclick="screenshot()">Screenshot</button>')
  })

  test('dedicated pet game window has a visible fallback and real timer controls', () => {
    const windowSource = fs.readFileSync(path.join(__dirname, '..', '..', 'pet-game-window.html'), 'utf8')

    expect(windowSource).not.toContain('id="tierBadge">Loading')
    expect(windowSource).toContain('id="tierBadge">Companion')
    expect(windowSource).toContain('<div class="stat">Lv 1</div>')
    expect(windowSource).toContain('class="view active" id="focusView"')
    expect(windowSource).toContain('class="active" data-tab="focus" id="focusTab"')
    expect(windowSource).toContain('renderOfflineProgress')
    expect(windowSource).toContain('id="timerLabel"')
    expect(windowSource).toContain('id="timerFill"')
    expect(windowSource).toContain('setInterval(updateFocusStatus, 1000)')
    expect(windowSource).toContain('data-active-session')
    expect(windowSource).toContain('data-minutes="5"')
    expect(windowSource).toContain('data-minutes="15"')
    expect(windowSource).toContain('data-minutes="25"')
    expect(windowSource).toContain('data-minutes="55"')
    expect(windowSource).not.toContain('data-minutes="90"')
    expect(windowSource).not.toContain('data-minutes="45"')
  })

  test('main renderer focus panel keeps the same task duration presets', () => {
    const mainSource = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')

    expect(mainSource).toContain('data-minutes="5"')
    expect(mainSource).toContain('selectFocusDuration(5)')
    expect(mainSource).toContain('data-minutes="15"')
    expect(mainSource).toContain('data-minutes="25"')
    expect(mainSource).toContain('data-minutes="55"')
    expect(mainSource).toContain('selectFocusDuration(55)')
    expect(mainSource).not.toContain('data-minutes="90"')
    expect(mainSource).not.toContain('selectFocusDuration(90)')
    expect(mainSource).not.toContain('data-minutes="45"')
    expect(mainSource).not.toContain('selectFocusDuration(45)')
    expect(mainSource).toContain('learnPetSkill')
    expect(mainSource).toContain("electronAPI.invoke('pet-skill-learn'")
  })

  test('dedicated pet game window binds controls without inline click handlers', () => {
    const windowSource = fs.readFileSync(path.join(__dirname, '..', '..', 'pet-game-window.html'), 'utf8')

    expect(windowSource).not.toContain('const electronAPI = window.electronAPI')
    expect(windowSource).toContain('const petBridge = window.electronAPI')
    expect(windowSource).not.toContain('onclick=')
    expect(windowSource).toContain('bindPetGameControls')
    expect(windowSource).toContain("focusTab.addEventListener('click'")
    expect(windowSource).toContain("startButton.addEventListener('click'")
    expect(windowSource).toContain("durationRow.addEventListener('click'")
    expect(windowSource).toContain('id="scriptStatus"')
    expect(windowSource).toContain("scriptStatus.textContent = 'Ready'")
  })

  test('reopening the dedicated pet game window reloads stale renderer content', () => {
    const mainSource = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8')

    expect(mainSource).toContain('petGameWindow.webContents.loadFile')
    expect(mainSource).toContain('pet-game-window.html')
    expect(mainSource).toContain('petGameWindow.webContents.once')
  })
})
