const fs = require('fs')
const path = require('path')

describe('inbox list scrolling', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')
  const mainSource = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8')

  test('keeps inbox records in their own vertical scroll area', () => {
    expect(source).toContain('grid-template-rows: auto auto auto auto minmax(0, 1fr);')
    expect(source).toContain('overflow: hidden;')
    expect(source).toContain('max-height: 148px;')
    expect(source).toContain('overflow-y: auto !important;')
    expect(source).toContain('touch-action: pan-y;')
  })

  test('uses a dedicated drag-out handle so the record body can scroll', () => {
    expect(source).toContain('class="inbox-drag-handle"')
    expect(source).toContain('draggable="false" data-inbox-id=')
    expect(source).toContain('ondragstart="startInboxDrag(event,')
    expect(source).toContain('bindInboxListScrollDrag')
    expect(source).toContain('setPointerCapture')
    expect(source).toContain('inboxList.scrollTop = inboxScrollDrag.startTop - dy;')
  })

  test('keeps the runtime overflow guard from disabling inbox scrolling', () => {
    expect(mainSource).toContain('.inbox-list { overflow-y: auto !important; }')
  })
})
