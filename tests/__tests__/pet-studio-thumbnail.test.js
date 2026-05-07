const fs = require('fs')
const path = require('path')

describe('Pet Studio library thumbnails', () => {
  const readStudio = () => fs.readFileSync(path.join(__dirname, '..', '..', 'pet-studio.html'), 'utf8')

  test('spritesheet pets use centered canvas thumbnails instead of scaled full-sheet images', () => {
    const html = readStudio()

    expect(html).toContain('function drawCenteredSpriteThumb')
    expect(html).toContain('function drawLibraryThumbs')
    expect(html).toContain('canvas class="sprite-thumb-canvas"')
    expect(html).not.toContain('const thumbClass = pet.manifest?.renderer === \'spritesheet\' ? \'thumb sprite-thumb\' : \'thumb\'')
  })

  test('tools reflect selected default pet state and library can collapse', () => {
    const html = readStudio()

    expect(html).toContain('id="studioContent"')
    expect(html).toContain('id="libraryToggle"')
    expect(html).toContain('function toggleLibraryCollapsed')
    expect(html).toContain('function renderSelectedPetInfo')
    expect(html).toContain('function renderToolButtons')
    expect(html).toContain('id="deleteSelectedButton"')
    expect(html).toContain('id="resetPetButton"')
    expect(html).toContain('deleteSelectedButton.disabled = selectedIsBuiltIn')
    expect(html).toContain('resetPetButton.disabled = selectedIsBuiltIn')
  })

  test('selected pet description is separate from generation prompt inputs', () => {
    const html = readStudio()

    expect(html).toContain('Selected Pet')
    expect(html).toContain('Generate Custom Pet')
    expect(html).toContain('id="selectedPetName"')
    expect(html).toContain('id="selectedPetDescription"')
    expect(html).toContain('id="generationPetName"')
    expect(html).toContain('id="generationPetDescription"')
    expect(html).toContain('function renderSelectedPetInfo')
    expect(html).toContain('const name = generationPetName.value.trim() ||')
    expect(html).toContain('const description = generationPetDescription.value.trim()')
    expect(html).not.toContain('petName.value = pet.name')
    expect(html).not.toContain('petDescription.value = manifest.description')
  })

  test('animated preview keeps the character core anchored instead of the full outer box', () => {
    const html = readStudio()

    expect(html).toContain('function calculateFrameCoreOffset')
    expect(html).toContain('const { dx, dy } = calculateFrameCoreOffset(frameData, canvas.width, canvas.height)')
  })
})
