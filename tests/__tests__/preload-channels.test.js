const fs = require('fs')
const path = require('path')

describe('preload channel whitelist', () => {
  test('exposes Pet Studio opener to renderers', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'preload.js'), 'utf8')

    expect(source).toContain("'pet-studio-open'")
  })

  test('exposes automatic pet generation channels to renderers', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'preload.js'), 'utf8')

    expect(source).toContain("'appearance-generate-pet'")
    expect(source).toContain("'appearance-generate-pet-description'")
    expect(source).toContain("'appearance-delete-pet'")
    expect(source).toContain("'appearance-generation-status'")
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
      'pet-game-open',
    ]

    for (const channel of channels) {
      expect(source).toContain(`'${channel}'`)
    }
    expect(source).toContain("'pet-progress-changed'")
    expect(source).toContain("'pet-game-tab'")
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

  test('dedicated pet game window is wired for larger gamified panels', () => {
    const mainSource = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8')
    const windowSource = fs.readFileSync(path.join(__dirname, '..', '..', 'pet-game-window.html'), 'utf8')

    expect(mainSource).toContain("ipcMain.handle('pet-game-open'")
    expect(mainSource).toContain('petGameWindow')
    expect(windowSource).toContain('id="focusView"')
    expect(windowSource).toContain('id="abilitiesView"')
    expect(windowSource).toContain('id="skillsView"')
    expect(windowSource).toContain("electronAPI.invoke('pet-progress-get'")
    expect(windowSource).toContain("electronAPI.on('pet-game-tab'")
  })
})
