const fs = require('fs')
const path = require('path')

describe('lyrics window placement and contrast', () => {
  test('keeps reply subtitles close to the pet with dark readable text', () => {
    const mainSource = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8')
    const lyricsSource = fs.readFileSync(path.join(__dirname, '..', '..', 'lyrics.html'), 'utf8')

    expect(mainSource).toContain('const LYRICS_OFFSET_X = -70')
    expect(mainSource).toContain('const LYRICS_OFFSET_Y = 188')
    expect(mainSource).toContain('x: petPos[0] + LYRICS_OFFSET_X')
    expect(mainSource).toContain('y: petPos[1] + LYRICS_OFFSET_Y')
    expect(mainSource).toContain('setLyricsWindowPosition(newX, newY)')
    expect(mainSource).toContain('setLyricsWindowPosition(next.x, next.y)')

    expect(lyricsSource).toContain('color: #111111')
    expect(lyricsSource).toContain('background: #111111')
    expect(lyricsSource).not.toContain('color: #ffffff')
    expect(lyricsSource).not.toContain('background: #fff')
  })
})
