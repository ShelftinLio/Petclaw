const fs = require('fs')
const os = require('os')
const path = require('path')
const InboxSystem = require('../../inbox-system')

function makeTempWorkspace() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'petclaw-inbox-test-'))
  const inboxRoot = path.join(root, 'Petclaw Inbox')
  const recordPath = path.join(root, 'pet-inbox.json')
  const sourceDir = path.join(root, 'source')
  fs.mkdirSync(sourceDir, { recursive: true })
  return { root, inboxRoot, recordPath, sourceDir }
}

function writeSourceFile(sourceDir, name, content = 'demo') {
  const filePath = path.join(sourceDir, name)
  fs.writeFileSync(filePath, content)
  return filePath
}

describe('InboxSystem', () => {
  test('classifies files into stable inbox buckets', () => {
    expect(InboxSystem.classifyType('photo.png')).toBe('images')
    expect(InboxSystem.classifyType('notes.md')).toBe('text')
    expect(InboxSystem.classifyType('brief.docx')).toBe('docs')
    expect(InboxSystem.classifyType('table.xlsx')).toBe('sheets')
    expect(InboxSystem.classifyType('deck.pptx')).toBe('slides')
    expect(InboxSystem.classifyType('bundle.zip')).toBe('archives')
    expect(InboxSystem.classifyType('unknown.bin')).toBe('other')
  })

  test('copies files into date and type folders without moving originals', async () => {
    const { inboxRoot, recordPath, sourceDir } = makeTempWorkspace()
    const sourceFile = writeSourceFile(sourceDir, 'report.pdf', 'pdf-content')
    const inbox = new InboxSystem({
      inboxRoot,
      recordPath,
      now: () => new Date('2026-05-07T10:30:00.000Z'),
    })

    const result = await inbox.collectFiles([sourceFile], { source: 'picker' })

    expect(result.success).toBe(true)
    expect(result.records).toHaveLength(1)
    expect(result.records[0]).toMatchObject({
      type: 'docs',
      source: 'picker',
      originalPath: sourceFile,
      inboxPath: path.join(inboxRoot, '2026-05-07', 'docs', 'report.pdf'),
    })
    expect(fs.readFileSync(result.records[0].inboxPath, 'utf8')).toBe('pdf-content')
    expect(fs.existsSync(sourceFile)).toBe(true)
  })

  test('adds suffixes for duplicate inbox file names', async () => {
    const { inboxRoot, recordPath, sourceDir } = makeTempWorkspace()
    const first = writeSourceFile(sourceDir, 'report.pdf', 'first')
    const second = writeSourceFile(sourceDir, 'second-report.pdf', 'second')
    const inbox = new InboxSystem({
      inboxRoot,
      recordPath,
      now: () => new Date('2026-05-07T10:30:00.000Z'),
    })

    await inbox.collectFiles([first], { source: 'picker', displayName: 'report.pdf' })
    const result = await inbox.collectFiles([second], { source: 'picker', displayName: 'report.pdf' })

    expect(result.success).toBe(true)
    expect(path.basename(result.records[0].inboxPath)).toBe('report (2).pdf')
    expect(fs.readFileSync(result.records[0].inboxPath, 'utf8')).toBe('second')
  })

  test('persists recent records and removes records without deleting files', async () => {
    const { inboxRoot, recordPath, sourceDir } = makeTempWorkspace()
    const sourceFile = writeSourceFile(sourceDir, 'photo.png', 'image')
    const inbox = new InboxSystem({
      inboxRoot,
      recordPath,
      now: () => new Date('2026-05-07T10:30:00.000Z'),
    })
    const result = await inbox.collectFiles([sourceFile], { source: 'drag' })
    const copiedPath = result.records[0].inboxPath

    const reloaded = new InboxSystem({ inboxRoot, recordPath })
    await reloaded.load()
    expect(reloaded.getState().records).toHaveLength(1)

    const removeResult = await reloaded.removeRecord(result.records[0].id)

    expect(removeResult.success).toBe(true)
    expect(reloaded.getState().records).toHaveLength(0)
    expect(fs.existsSync(copiedPath)).toBe(true)
  })

  test('reports missing inbox copies as stale records', async () => {
    const { inboxRoot, recordPath, sourceDir } = makeTempWorkspace()
    const sourceFile = writeSourceFile(sourceDir, 'photo.png', 'image')
    const inbox = new InboxSystem({
      inboxRoot,
      recordPath,
      now: () => new Date('2026-05-07T10:30:00.000Z'),
    })
    const result = await inbox.collectFiles([sourceFile], { source: 'picker' })
    fs.unlinkSync(result.records[0].inboxPath)

    expect(inbox.getState().records[0].missing).toBe(true)
  })

  test('creates clipboard image and text records in the right buckets', async () => {
    const { inboxRoot, recordPath } = makeTempWorkspace()
    const inbox = new InboxSystem({
      inboxRoot,
      recordPath,
      now: () => new Date('2026-05-07T10:30:00.000Z'),
    })

    const imageResult = await inbox.collectClipboardImage(Buffer.from('png-data'))
    const textResult = await inbox.collectClipboardText('https://example.com/resource')

    expect(imageResult.records[0].type).toBe('images')
    expect(path.extname(imageResult.records[0].inboxPath)).toBe('.png')
    expect(fs.readFileSync(imageResult.records[0].inboxPath, 'utf8')).toBe('png-data')
    expect(textResult.records[0].type).toBe('links')
    expect(path.extname(textResult.records[0].inboxPath)).toBe('.url')
  })

  test('returns per-file failures without failing the whole batch', async () => {
    const { inboxRoot, recordPath, sourceDir } = makeTempWorkspace()
    const sourceFile = writeSourceFile(sourceDir, 'report.pdf', 'ok')
    const missingFile = path.join(sourceDir, 'missing.pdf')
    const inbox = new InboxSystem({
      inboxRoot,
      recordPath,
      now: () => new Date('2026-05-07T10:30:00.000Z'),
    })

    const result = await inbox.collectFiles([sourceFile, missingFile], { source: 'drag' })

    expect(result.success).toBe(true)
    expect(result.records).toHaveLength(1)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].error).toContain('Source file missing')
  })
})
