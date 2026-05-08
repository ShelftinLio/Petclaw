const fs = require('fs')
const path = require('path')

describe('inbox list scrolling', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')
  const mainSource = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8')

  test('keeps inbox records in their own vertical scroll area', () => {
    expect(source).toContain('height: calc(100% - 178px);')
    expect(source).toContain('min-height: 168px;')
    expect(source).toContain('max-height: 294px;')
    expect(source).toContain('grid-template-rows: auto auto auto auto minmax(0, 1fr);')
    expect(source).toContain('overflow: hidden;')
    expect(source).toContain('overflow-y: auto !important;')
    expect(source).toContain('touch-action: pan-y;')
    expect(source).not.toContain('max-height: 148px;')
  })

  test('lets inbox records drag out through the native Electron path safely', () => {
    expect(source).not.toContain('class="inbox-drag-handle"')
    expect(source).not.toContain('.inbox-drag-handle')
    expect(source).toContain('draggable="${record.missing ? \'false\' : \'true\'}" data-inbox-id=')
    expect(source).toContain('ondragstart="startInboxDrag(event,')
    expect(source).toContain('event?.preventDefault?.();')
    expect(source).not.toContain('bindInboxListScrollDrag')
    expect(source).not.toContain('setPointerCapture')
    expect(source).not.toContain('inboxScrollDrag')
    expect(source).not.toContain('drag-scrolling')
  })

  test('scrolls the inbox list when the mouse wheel moves over the tray', () => {
    expect(source).toContain('function bindInboxWheelScroll()')
    expect(source).toContain("inboxTray.addEventListener('wheel'")
    expect(source).toContain("if (!inboxTray.classList.contains('show')) return;")
    expect(source).toContain('const maxScrollTop = inboxList.scrollHeight - inboxList.clientHeight;')
    expect(source).toContain('const unit = event.deltaMode === 1 ? 32 : event.deltaMode === 2 ? inboxList.clientHeight : 1;')
    expect(source).toContain('const deltaY = (event.deltaY || event.deltaX || 0) * unit;')
    expect(source).toContain('inboxList.scrollTop = Math.max(0, Math.min(maxScrollTop, inboxList.scrollTop + deltaY));')
    expect(source).toContain('{ passive: false }')
    expect(source).toContain('bindInboxWheelScroll();')
  })

  test('keeps the runtime overflow guard from disabling inbox scrolling', () => {
    expect(mainSource).toContain('.inbox-list { overflow-y: auto !important; }')
  })
})
