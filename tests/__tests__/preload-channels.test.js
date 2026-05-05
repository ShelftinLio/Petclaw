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
    ]

    for (const channel of channels) {
      expect(source).toContain(`'${channel}'`)
    }
    expect(source).toContain("'pet-progress-changed'")
  })

  test('renderer includes gamified focus panel hooks', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')

    expect(source).toContain('id="btnAdventure"')
    expect(source).toContain('id="focusAdventurePanel"')
    expect(source).toContain('startFocusAdventure')
    expect(source).toContain('renderPetProgress')
    expect(source).toContain('openSkillBook')
  })
})
