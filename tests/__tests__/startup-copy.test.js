const fs = require('fs')
const path = require('path')

describe('startup copy', () => {
  test('uses Petclaw branding for the initial standby message', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8')

    expect(source).toContain("text: 'Petclaw待命'")
    expect(source).not.toContain('龙虾待命')
  })
})
