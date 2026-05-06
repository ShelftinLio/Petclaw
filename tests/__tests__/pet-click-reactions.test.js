const fs = require('fs')
const path = require('path')

describe('pet click reactions', () => {
  test('single clicks keep visual feedback without opening message history', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')
    const clickStart = source.indexOf("pet.addEventListener('click'")
    const clickEnd = source.indexOf('function resetClick', clickStart)

    expect(clickStart).toBeGreaterThan(-1)
    expect(clickEnd).toBeGreaterThan(clickStart)

    const clickSource = source.slice(clickStart, clickEnd)
    expect(clickSource).toContain('pauseRoam(2400)')
    expect(clickSource).toContain('clickCount++')
    expect(clickSource).toContain('spawnParticles()')
    expect(clickSource).toContain("playSpriteReaction('surprised', 1200)")
    expect(clickSource).toContain("const rr = ['happy', 'talking', 'thinking']")
    expect(clickSource).toContain('EXPR[')
    expect(clickSource).not.toContain("electronAPI.invoke('show-history')")
    expect(clickSource).not.toContain('showConversationHistory')
    expect(clickSource).not.toContain('enterConversationMode')
  })
})
