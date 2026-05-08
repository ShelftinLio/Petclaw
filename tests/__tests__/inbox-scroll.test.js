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

  test('lets inbox records drag out through the native Electron path safely', () => {
    expect(source).toContain('class="inbox-drag-handle"')
    expect(source).toContain('draggable="${record.missing ? \'false\' : \'true\'}" data-inbox-id=')
    expect(source).toContain('ondragstart="startInboxDrag(event,')
    expect(source).toContain('event?.preventDefault?.();')
    expect(source).toContain('bindInboxListScrollDrag')
    expect(source).toContain('setPointerCapture')
    expect(source).toContain('inboxList.scrollTop = inboxScrollDrag.startTop - dy;')
  })

  test('scrolls the inbox list when the mouse wheel moves over the tray', () => {
    expect(source).toContain('function bindInboxWheelScroll()')
    expect(source).toContain("inboxTray.addEventListener('wheel'")
    expect(source).toContain('const maxScrollTop = inboxList.scrollHeight - inboxList.clientHeight;')
    expect(source).toContain('inboxList.scrollTop = Math.max(0, Math.min(maxScrollTop, inboxList.scrollTop + deltaY));')
    expect(source).toContain('{ passive: false }')
    expect(source).toContain('bindInboxWheelScroll();')
  })

  test('keeps the runtime overflow guard from disabling inbox scrolling', () => {
    expect(mainSource).toContain('.inbox-list { overflow-y: auto !important; }')
  })
})
