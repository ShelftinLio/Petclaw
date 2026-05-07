# File Inbox Helper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the screenshot UI entry with a safe local file inbox tray that supports file picker collection, drag-in, clipboard collection, recent records, and dragging collected files back out from the Inbox copy.

**Architecture:** Add a focused `inbox-system.js` module for file classification, copy, duplicate naming, and record persistence. Wire it into Electron through explicit IPC handlers in `main.js` and whitelisted renderer channels in `preload.js`. Add a compact HUD tray in `index.html` that manages UI state, drag-in, drag-out, and recent file actions.

**Tech Stack:** Electron 28 main/renderer IPC, Node.js `fs/path/os`, Electron `dialog/clipboard/shell/webContents.startDrag`, Jest unit tests, existing single-file renderer HTML/CSS/JS.

---

## Current Context

The repository currently has many unrelated uncommitted changes. Do not revert them. When committing implementation work, stage only the files listed in the current task.

The existing screenshot UI is in `index.html`:

- Toolbar button: `id="btnScreenshot"` around `index.html:1009`.
- Settings button: `button onclick="screenshot()">Screenshot</button>` around `index.html:1031`.
- Renderer function: `async function screenshot()` around `index.html:3150`.

The existing screenshot IPC remains in `main.js`:

- `ipcMain.handle('take-screenshot'...)` around `main.js:2718`.

P0 removes visible screenshot entry points but does not delete `screenshot-system.js` or `take-screenshot`, because other diagnostics may still reference them.

## File Structure

- Create `inbox-system.js`: pure-ish inbox domain module. It owns type classification, date/type destination paths, duplicate-safe copies, clipboard payload file creation, record persistence, stale record detection, and state shaping.
- Create `tests/__tests__/inbox-system.test.js`: unit tests for `inbox-system.js` using temporary directories.
- Modify `main.js`: import Electron `clipboard`, instantiate `InboxSystem`, register `inbox-*` IPC handlers, bridge file picker, clipboard, open/reveal, and drag-out.
- Modify `preload.js`: whitelist `inbox-*` invoke channels.
- Modify `index.html`: replace screenshot toolbar/settings UI, add inbox tray markup/style/state logic, add drag-in/drop handlers, add drag-out behavior for recent records.
- Modify `tests/__tests__/preload-channels.test.js`: assert new IPC channels and renderer UI affordances.

---

### Task 1: Core Inbox System Tests

**Files:**
- Create: `tests/__tests__/inbox-system.test.js`
- Test target created in next task: `inbox-system.js`

- [ ] **Step 1: Write the failing core tests**

Create `tests/__tests__/inbox-system.test.js`:

```javascript
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
      now: () => new Date('2026-05-07T10:30:00.000Z')
    })

    const result = await inbox.collectFiles([sourceFile], { source: 'picker' })

    expect(result.success).toBe(true)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].type).toBe('docs')
    expect(result.records[0].source).toBe('picker')
    expect(result.records[0].originalPath).toBe(sourceFile)
    expect(result.records[0].inboxPath).toBe(path.join(inboxRoot, '2026-05-07', 'docs', 'report.pdf'))
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
      now: () => new Date('2026-05-07T10:30:00.000Z')
    })

    await inbox.collectFiles([first], { source: 'picker', displayName: 'report.pdf' })
    const result = await inbox.collectFiles([second], { source: 'picker', displayName: 'report.pdf' })

    expect(result.success).toBe(true)
    expect(path.basename(result.records[0].inboxPath)).toBe('report (2).pdf')
    expect(fs.readFileSync(result.records[0].inboxPath, 'utf8')).toBe('second')
  })

  test('persists recent records across instances and removes records without deleting files', async () => {
    const { inboxRoot, recordPath, sourceDir } = makeTempWorkspace()
    const sourceFile = writeSourceFile(sourceDir, 'photo.png', 'image')
    const inbox = new InboxSystem({
      inboxRoot,
      recordPath,
      now: () => new Date('2026-05-07T10:30:00.000Z')
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
      now: () => new Date('2026-05-07T10:30:00.000Z')
    })
    const result = await inbox.collectFiles([sourceFile], { source: 'picker' })
    fs.unlinkSync(result.records[0].inboxPath)

    const state = inbox.getState()

    expect(state.records[0].missing).toBe(true)
  })

  test('creates clipboard image and text records in the right buckets', async () => {
    const { inboxRoot, recordPath } = makeTempWorkspace()
    const inbox = new InboxSystem({
      inboxRoot,
      recordPath,
      now: () => new Date('2026-05-07T10:30:00.000Z')
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
      now: () => new Date('2026-05-07T10:30:00.000Z')
    })

    const result = await inbox.collectFiles([sourceFile, missingFile], { source: 'drag' })

    expect(result.success).toBe(true)
    expect(result.records).toHaveLength(1)
    expect(result.failures).toHaveLength(1)
    expect(result.failures[0].error).toContain('Source file missing')
  })
})
```

- [ ] **Step 2: Run the focused test and verify it fails because the module does not exist**

Run:

```bash
npx jest tests/__tests__/inbox-system.test.js --runInBand
```

Expected: FAIL with `Cannot find module '../../inbox-system'`.

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/__tests__/inbox-system.test.js
git commit -m "test: define file inbox system behavior"
```

---

### Task 2: Inbox System Implementation

**Files:**
- Create: `inbox-system.js`
- Test: `tests/__tests__/inbox-system.test.js`

- [ ] **Step 1: Implement `inbox-system.js`**

Create `inbox-system.js`:

```javascript
const fs = require('fs')
const fsp = require('fs').promises
const os = require('os')
const path = require('path')

const TYPE_EXTENSIONS = {
  images: ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'],
  docs: ['.pdf', '.doc', '.docx', '.rtf'],
  sheets: ['.xls', '.xlsx', '.csv'],
  slides: ['.ppt', '.pptx', '.key'],
  text: ['.txt', '.md', '.json', '.js', '.ts', '.css', '.html', '.log'],
  links: ['.url', '.webloc'],
  archives: ['.zip', '.rar', '.7z', '.tar', '.gz']
}

const MAX_RECENT_RECORDS = 100

function pad(value) {
  return String(value).padStart(2, '0')
}

function createId(date = new Date()) {
  const stamp = [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join('')
  return `inbox_${stamp}_${Math.random().toString(36).slice(2, 8)}`
}

function looksLikeUrl(text) {
  return /^https?:\/\/\S+$/i.test(String(text || '').trim())
}

class InboxSystem {
  constructor(options = {}) {
    this.inboxRoot = options.inboxRoot || path.join(os.homedir(), 'Documents', 'Petclaw Inbox')
    this.recordPath = options.recordPath || path.join(process.cwd(), 'pet-inbox.json')
    this.now = options.now || (() => new Date())
    this.records = []
  }

  static classifyType(filePath, kind) {
    if (kind === 'image') return 'images'
    if (kind === 'text') return 'text'
    if (kind === 'link') return 'links'

    const ext = path.extname(String(filePath || '')).toLowerCase()
    for (const [type, extensions] of Object.entries(TYPE_EXTENSIONS)) {
      if (extensions.includes(ext)) return type
    }
    return 'other'
  }

  static formatDateSegment(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  }

  async load() {
    try {
      const raw = await fsp.readFile(this.recordPath, 'utf8')
      const parsed = JSON.parse(raw)
      this.records = Array.isArray(parsed.records) ? parsed.records : []
    } catch (err) {
      if (err.code !== 'ENOENT') {
        console.warn('[InboxSystem] Failed to load records:', err.message)
      }
      this.records = []
    }
    return this.getState()
  }

  async save() {
    await fsp.mkdir(path.dirname(this.recordPath), { recursive: true })
    const payload = {
      version: 1,
      records: this.records.slice(0, MAX_RECENT_RECORDS)
    }
    await fsp.writeFile(this.recordPath, JSON.stringify(payload, null, 2), 'utf8')
  }

  getState() {
    return {
      inboxRoot: this.inboxRoot,
      records: this.records.map(record => ({
        ...record,
        missing: record.inboxPath ? !fs.existsSync(record.inboxPath) : false
      }))
    }
  }

  async collectFiles(filePaths, options = {}) {
    const paths = Array.isArray(filePaths) ? filePaths : []
    const records = []
    const failures = []

    for (const sourcePath of paths) {
      try {
        const record = await this.copyFileIntoInbox(sourcePath, options)
        records.push(record)
      } catch (err) {
        failures.push({
          sourcePath,
          error: err.message
        })
      }
    }

    if (records.length > 0) {
      this.records = [...records, ...this.records].slice(0, MAX_RECENT_RECORDS)
      await this.save()
    }

    return {
      success: records.length > 0,
      records,
      failures
    }
  }

  async copyFileIntoInbox(sourcePath, options = {}) {
    if (!sourcePath || !fs.existsSync(sourcePath)) {
      throw new Error(`Source file missing: ${sourcePath}`)
    }

    const stat = await fsp.stat(sourcePath)
    if (!stat.isFile()) {
      throw new Error(`Source is not a file: ${sourcePath}`)
    }

    const date = options.now || this.now()
    const displayName = options.displayName || path.basename(sourcePath)
    const type = InboxSystem.classifyType(displayName)
    const targetDir = path.join(this.inboxRoot, InboxSystem.formatDateSegment(date), type)
    await fsp.mkdir(targetDir, { recursive: true })
    const inboxPath = await this.getUniqueTargetPath(targetDir, displayName)
    await fsp.copyFile(sourcePath, inboxPath)

    const copiedStat = await fsp.stat(inboxPath)
    return {
      id: createId(date),
      name: path.basename(inboxPath),
      type,
      source: options.source || 'picker',
      originalPath: sourcePath,
      inboxPath,
      size: copiedStat.size,
      createdAt: date.toISOString(),
      note: ''
    }
  }

  async collectClipboardImage(pngBuffer, options = {}) {
    if (!Buffer.isBuffer(pngBuffer) || pngBuffer.length === 0) {
      return { success: false, records: [], failures: [{ error: 'Clipboard image is empty' }] }
    }

    const date = options.now || this.now()
    const type = 'images'
    const targetDir = path.join(this.inboxRoot, InboxSystem.formatDateSegment(date), type)
    await fsp.mkdir(targetDir, { recursive: true })
    const inboxPath = await this.getUniqueTargetPath(targetDir, options.displayName || 'clipboard-image.png')
    await fsp.writeFile(inboxPath, pngBuffer)
    const stat = await fsp.stat(inboxPath)
    const record = {
      id: createId(date),
      name: path.basename(inboxPath),
      type,
      source: 'clipboard',
      originalPath: null,
      inboxPath,
      size: stat.size,
      createdAt: date.toISOString(),
      note: ''
    }
    this.records = [record, ...this.records].slice(0, MAX_RECENT_RECORDS)
    await this.save()
    return { success: true, records: [record], failures: [] }
  }

  async collectClipboardText(text, options = {}) {
    const content = String(text || '').trim()
    if (!content) {
      return { success: false, records: [], failures: [{ error: 'Clipboard text is empty' }] }
    }

    const date = options.now || this.now()
    const isLink = looksLikeUrl(content)
    const type = isLink ? 'links' : 'text'
    const extension = isLink ? '.url' : '.txt'
    const defaultName = isLink ? 'clipboard-link.url' : 'clipboard-text.txt'
    const targetDir = path.join(this.inboxRoot, InboxSystem.formatDateSegment(date), type)
    await fsp.mkdir(targetDir, { recursive: true })
    const inboxPath = await this.getUniqueTargetPath(targetDir, options.displayName || defaultName)
    const fileContent = isLink
      ? `[InternetShortcut]\nURL=${content}\n`
      : content
    const finalPath = path.extname(inboxPath) ? inboxPath : `${inboxPath}${extension}`
    await fsp.writeFile(finalPath, fileContent, 'utf8')
    const stat = await fsp.stat(finalPath)
    const record = {
      id: createId(date),
      name: path.basename(finalPath),
      type,
      source: 'clipboard',
      originalPath: null,
      inboxPath: finalPath,
      size: stat.size,
      createdAt: date.toISOString(),
      note: ''
    }
    this.records = [record, ...this.records].slice(0, MAX_RECENT_RECORDS)
    await this.save()
    return { success: true, records: [record], failures: [] }
  }

  async getUniqueTargetPath(targetDir, fileName) {
    const parsed = path.parse(fileName)
    const baseName = parsed.name || 'untitled'
    const ext = parsed.ext || ''
    let candidate = path.join(targetDir, `${baseName}${ext}`)
    let index = 2
    while (fs.existsSync(candidate)) {
      candidate = path.join(targetDir, `${baseName} (${index})${ext}`)
      index += 1
    }
    return candidate
  }

  getRecord(id) {
    return this.records.find(record => record.id === id) || null
  }

  async removeRecord(id) {
    const before = this.records.length
    this.records = this.records.filter(record => record.id !== id)
    const removed = this.records.length !== before
    if (removed) await this.save()
    return { success: removed, records: this.getState().records }
  }
}

module.exports = InboxSystem
```

- [ ] **Step 2: Run the focused test and verify it passes**

Run:

```bash
npx jest tests/__tests__/inbox-system.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 3: Commit the core implementation**

```bash
git add inbox-system.js tests/__tests__/inbox-system.test.js
git commit -m "feat: add file inbox system"
```

---

### Task 3: IPC Contract Tests

**Files:**
- Modify: `tests/__tests__/preload-channels.test.js`
- Implementation target: `preload.js`
- Implementation target: `main.js`

- [ ] **Step 1: Add a failing test for inbox channels**

Append this test to `tests/__tests__/preload-channels.test.js` before the final `})`:

```javascript
  test('exposes file inbox channels to renderers', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'preload.js'), 'utf8')
    const channels = [
      'inbox-get-state',
      'inbox-add-files',
      'inbox-capture-clipboard',
      'inbox-open-root',
      'inbox-open-item',
      'inbox-reveal-item',
      'inbox-remove-record',
      'inbox-start-drag',
    ]

    for (const channel of channels) {
      expect(source).toContain(`'${channel}'`)
    }
  })
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
npx jest tests/__tests__/preload-channels.test.js --runInBand
```

Expected: FAIL because `preload.js` has not been wired yet.

- [ ] **Step 3: Commit the failing IPC contract test**

```bash
git add tests/__tests__/preload-channels.test.js
git commit -m "test: define file inbox ipc contract"
```

---

### Task 4: Main Process And Preload Wiring

**Files:**
- Modify: `main.js`
- Modify: `preload.js`
- Test: `tests/__tests__/preload-channels.test.js`
- Runtime dependency: `inbox-system.js`

- [ ] **Step 1: Update Electron imports and instantiate `InboxSystem`**

In `main.js`, update the Electron import near `main.js:55`:

```javascript
const { app, BrowserWindow, ipcMain, screen, Menu, Tray, Notification, shell, dialog, clipboard } = require('electron');
```

Add the module import near the other local modules:

```javascript
const InboxSystem = require('./inbox-system');
```

Add the shared variable near other system variables:

```javascript
let inboxSystem;
```

Inside `createWindow()`, after `petProgressStore.load()` and before IPC handlers are used, initialize the inbox system:

```javascript
  inboxSystem = new InboxSystem({
    inboxRoot: path.join(app.getPath('documents'), 'Petclaw Inbox'),
    recordPath: path.join(app.getPath('userData'), 'pet-inbox.json')
  });
  await inboxSystem.load();
```

- [ ] **Step 2: Add clipboard file-path parsing helpers**

In `main.js`, place these helpers near the screenshot IPC section or before the new inbox IPC handlers:

```javascript
function readClipboardFilePaths() {
  const paths = [];
  if (process.platform === 'win32') {
    for (const format of ['FileNameW', 'FileName']) {
      const buffer = clipboard.readBuffer(format);
      const decoded = decodeClipboardFileBuffer(buffer, format);
      if (decoded.length > 0) paths.push(...decoded);
    }
  }
  return [...new Set(paths)].filter(filePath => filePath && fs.existsSync(filePath));
}

function decodeClipboardFileBuffer(buffer, format) {
  if (!buffer || buffer.length === 0) return [];
  const encoding = format === 'FileNameW' ? 'utf16le' : 'utf8';
  return buffer
    .toString(encoding)
    .split('\u0000')
    .map(item => item.trim())
    .filter(Boolean);
}
```

- [ ] **Step 3: Register inbox IPC handlers**

Add this block in `main.js` near the other `ipcMain.handle(...)` registrations:

```javascript
ipcMain.handle('inbox-get-state', async () => {
  if (!inboxSystem) return { inboxRoot: '', records: [] };
  return inboxSystem.getState();
});

ipcMain.handle('inbox-add-files', async (event, options = {}) => {
  if (!inboxSystem) return { success: false, error: 'Inbox is not initialized', records: [], failures: [] };

  let filePaths = Array.isArray(options.paths) ? options.paths.filter(Boolean) : [];
  const source = options.source || (filePaths.length > 0 ? 'drag' : 'picker');

  if (filePaths.length === 0) {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Add files to Petclaw Inbox',
      properties: ['openFile', 'multiSelections']
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true, records: [], failures: [] };
    }
    filePaths = result.filePaths;
  }

  return inboxSystem.collectFiles(filePaths, { source });
});

ipcMain.handle('inbox-capture-clipboard', async () => {
  if (!inboxSystem) return { success: false, error: 'Inbox is not initialized', records: [], failures: [] };

  const filePaths = readClipboardFilePaths();
  if (filePaths.length > 0) {
    return inboxSystem.collectFiles(filePaths, { source: 'clipboard' });
  }

  const image = clipboard.readImage();
  if (image && !image.isEmpty()) {
    return inboxSystem.collectClipboardImage(image.toPNG());
  }

  const text = clipboard.readText();
  if (text && text.trim()) {
    return inboxSystem.collectClipboardText(text);
  }

  return {
    success: false,
    error: 'Clipboard does not contain a supported file, image, text, or link.',
    records: [],
    failures: []
  };
});

ipcMain.handle('inbox-open-root', async () => {
  if (!inboxSystem) return { success: false, error: 'Inbox is not initialized' };
  await fsp.mkdir(inboxSystem.inboxRoot, { recursive: true });
  const error = await shell.openPath(inboxSystem.inboxRoot);
  return { success: !error, error };
});

ipcMain.handle('inbox-open-item', async (event, id) => {
  if (!inboxSystem) return { success: false, error: 'Inbox is not initialized' };
  const record = inboxSystem.getRecord(id);
  if (!record || !record.inboxPath || !fs.existsSync(record.inboxPath)) {
    return { success: false, error: '文件已不在 Inbox' };
  }
  const error = await shell.openPath(record.inboxPath);
  return { success: !error, error };
});

ipcMain.handle('inbox-reveal-item', async (event, id) => {
  if (!inboxSystem) return { success: false, error: 'Inbox is not initialized' };
  const record = inboxSystem.getRecord(id);
  if (!record || !record.inboxPath || !fs.existsSync(record.inboxPath)) {
    return { success: false, error: '文件已不在 Inbox' };
  }
  shell.showItemInFolder(record.inboxPath);
  return { success: true };
});

ipcMain.handle('inbox-remove-record', async (event, id) => {
  if (!inboxSystem) return { success: false, error: 'Inbox is not initialized', records: [] };
  return inboxSystem.removeRecord(id);
});

ipcMain.handle('inbox-start-drag', async (event, id) => {
  if (!inboxSystem) return { success: false, error: 'Inbox is not initialized' };
  const record = inboxSystem.getRecord(id);
  if (!record || !record.inboxPath || !fs.existsSync(record.inboxPath)) {
    return { success: false, error: '文件已不在 Inbox' };
  }
  event.sender.startDrag({
    file: record.inboxPath,
    icon: path.join(__dirname, 'icon.png')
  });
  return { success: true };
});
```

- [ ] **Step 4: Add preload channel whitelist entries**

In `preload.js`, add these strings to `VALID_INVOKE_CHANNELS`:

```javascript
  'inbox-get-state',
  'inbox-add-files',
  'inbox-capture-clipboard',
  'inbox-open-root',
  'inbox-open-item',
  'inbox-reveal-item',
  'inbox-remove-record',
  'inbox-start-drag',
```

- [ ] **Step 5: Run tests**

Run:

```bash
npx jest tests/__tests__/inbox-system.test.js tests/__tests__/preload-channels.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 6: Commit main/preload wiring**

```bash
git add main.js preload.js
git commit -m "feat: wire file inbox ipc"
```

---

### Task 5: Renderer Inbox Tray And Drag Interactions

**Files:**
- Modify: `index.html`
- Test: `tests/__tests__/preload-channels.test.js`

- [ ] **Step 1: Add a failing renderer UI contract test**

Append this test to `tests/__tests__/preload-channels.test.js` before the final `})`:

```javascript
  test('main renderer replaces screenshot controls with file inbox controls', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')

    expect(source).toContain('id="btnInbox"')
    expect(source).toContain('toggleInboxTray')
    expect(source).toContain('id="inboxTray"')
    expect(source).toContain('id="inboxDropZone"')
    expect(source).toContain('captureInboxClipboard')
    expect(source).toContain('startInboxDrag')
    expect(source).not.toContain('id="btnScreenshot"')
    expect(source).not.toContain('onclick="screenshot()"')
    expect(source).not.toContain('>Screenshot</button>')
  })
```

- [ ] **Step 2: Run the renderer contract test and verify it fails**

Run:

```bash
npx jest tests/__tests__/preload-channels.test.js --runInBand
```

Expected: FAIL because `index.html` still exposes the screenshot controls.

- [ ] **Step 3: Add inbox tray CSS**

In `index.html`, near the existing `.input-bar` and settings panel styles, add:

```css
    .inbox-tray {
        position: absolute;
        bottom: 122px;
        left: 50%;
        transform: translateX(-50%);
        display: none;
        width: 254px;
        max-height: 286px;
        padding: 7px;
        gap: 6px;
        overflow-y: auto !important;
        z-index: 34;
        background: var(--hud-bg);
        border: 2px solid var(--hud-line);
        box-shadow: var(--pixel-shadow);
        clip-path: polygon(6px 0, calc(100% - 6px) 0, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 0 calc(100% - 6px), 0 6px);
    }
    .inbox-tray.show {
        display: grid;
        transform: translateX(-50%) translateY(-4px);
    }
    .inbox-title {
        font-size: 14px;
        font-weight: 900;
        color: #000000;
    }
    .inbox-actions {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 5px;
    }
    .inbox-actions button,
    .inbox-record-actions button {
        min-width: 0;
        height: 26px;
        border: 2px solid var(--hud-line);
        border-radius: 0;
        background: #ffffff;
        color: var(--hud-text);
        font-size: 10px;
        font-weight: 900;
        cursor: pointer;
        box-shadow: inset -2px -2px 0 rgba(0,0,0,0.14);
    }
    .inbox-drop-zone {
        min-height: 46px;
        display: grid;
        place-items: center;
        border: 2px dashed var(--hud-line);
        background: #f7f7f2;
        color: #111111;
        font-size: 11px;
        font-weight: 900;
        text-align: center;
    }
    .inbox-tray.drag-over .inbox-drop-zone,
    .pet-wrapper.inbox-drag-over {
        background: #fff1bd;
        filter: drop-shadow(0 0 8px rgba(232,168,56,0.65));
    }
    .inbox-status {
        min-height: 14px;
        font-size: 10px;
        font-weight: 800;
        color: #111111;
        overflow-wrap: anywhere;
    }
    .inbox-status.error {
        color: #7a0000;
    }
    .inbox-list {
        display: grid;
        gap: 5px;
    }
    .inbox-empty {
        padding: 7px;
        border: 2px solid var(--hud-line);
        background: #ffffff;
        font-size: 11px;
        font-weight: 800;
        color: #666666;
    }
    .inbox-record {
        display: grid;
        gap: 5px;
        padding: 6px;
        border: 2px solid var(--hud-line);
        background: #ffffff;
        cursor: grab;
    }
    .inbox-record:active {
        cursor: grabbing;
    }
    .inbox-record.missing {
        background: #f0f0ea;
        color: #666666;
    }
    .inbox-record-main {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 5px;
        align-items: start;
    }
    .inbox-record-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 11px;
        font-weight: 900;
    }
    .inbox-record-type {
        border: 2px solid var(--hud-line);
        padding: 1px 4px;
        background: #f7f7f2;
        font-size: 9px;
        font-weight: 900;
        text-transform: uppercase;
    }
    .inbox-record-meta {
        font-size: 9px;
        color: #666666;
        font-weight: 800;
    }
    .inbox-record-actions {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 4px;
    }
```

- [ ] **Step 4: Replace toolbar and settings screenshot controls**

Replace the toolbar screenshot button with:

```html
        <div class="tool-icon" id="btnInbox" title="收纳" onclick="toggleInboxTray()">
            <svg viewBox="0 0 24 24"><path d="M4 4h16v5H4z"/><path d="M4 9h16v11H4z"/><path d="M9 13h6"/><path d="M8 4l1.5-2h5L16 4"/></svg>
        </div>
```

Replace the settings screenshot button with:

```html
        <button onclick="openInboxRoot()">Open Inbox</button>
```

- [ ] **Step 5: Add inbox tray markup**

Place this block after the toolbar and before `settingsPanel`:

```html
    <div class="inbox-tray" id="inboxTray">
        <div class="inbox-title">File Inbox</div>
        <div class="inbox-actions">
            <button onclick="addInboxFiles()">Add</button>
            <button onclick="captureInboxClipboard()">Clip</button>
            <button onclick="openInboxRoot()">Open</button>
        </div>
        <div class="inbox-drop-zone" id="inboxDropZone">拖文件到这里收纳</div>
        <div class="inbox-status" id="inboxStatus"></div>
        <div class="inbox-list" id="inboxList">
            <div class="inbox-empty">No files collected yet.</div>
        </div>
    </div>
```

- [ ] **Step 6: Add renderer state references**

Near existing DOM references around `const toolbar = document.getElementById('toolbar');`, add:

```javascript
const inboxTray = document.getElementById('inboxTray');
const inboxDropZone = document.getElementById('inboxDropZone');
const inboxStatus = document.getElementById('inboxStatus');
const inboxList = document.getElementById('inboxList');
let inboxRecords = [];
let inboxDragDepth = 0;
```

- [ ] **Step 7: Add inbox UI functions**

Replace the old `async function screenshot()` with:

```javascript
function toggleInboxTray() {
    if (!inboxTray) return;
    const willShow = !inboxTray.classList.contains('show');
    inboxTray.classList.toggle('show', willShow);
    settingsPanel.classList.remove('show');
    inputBar.classList.remove('show');
    hideGamePanels();
    endConversationMode();
    pauseRoam(2500);
    if (willShow) loadInboxState();
}

function setInboxStatus(message, type = '') {
    if (!inboxStatus) return;
    inboxStatus.textContent = message || '';
    inboxStatus.classList.toggle('error', type === 'error');
}

async function loadInboxState() {
    if (!electronAPI) return;
    const state = await electronAPI.invoke('inbox-get-state');
    inboxRecords = Array.isArray(state.records) ? state.records : [];
    renderInboxRecords();
}

function renderInboxRecords() {
    if (!inboxList) return;
    if (!inboxRecords.length) {
        inboxList.innerHTML = '<div class="inbox-empty">No files collected yet.</div>';
        return;
    }

    inboxList.innerHTML = inboxRecords.slice(0, 20).map(record => `
        <div class="inbox-record ${record.missing ? 'missing' : ''}" draggable="${record.missing ? 'false' : 'true'}" data-inbox-id="${escapeHtml(record.id)}">
            <div class="inbox-record-main">
                <div class="inbox-record-name" title="${escapeHtml(record.name)}">${escapeHtml(record.name)}</div>
                <div class="inbox-record-type">${escapeHtml(record.type)}</div>
            </div>
            <div class="inbox-record-meta">${escapeHtml(record.source || 'inbox')} · ${formatInboxTime(record.createdAt)}${record.missing ? ' · 文件已不在 Inbox' : ''}</div>
            <div class="inbox-record-actions">
                <button data-action="open" data-inbox-id="${escapeHtml(record.id)}">Open</button>
                <button data-action="reveal" data-inbox-id="${escapeHtml(record.id)}">Find</button>
                <button data-action="remove" data-inbox-id="${escapeHtml(record.id)}">Remove</button>
            </div>
        </div>
    `).join('');
}

function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[char]);
}

function formatInboxTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--:--';
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

async function addInboxFiles(paths = null, source = 'picker') {
    if (!electronAPI) return;
    setInboxStatus('Collecting...');
    const result = await electronAPI.invoke('inbox-add-files', { paths, source });
    handleInboxResult(result);
}

async function captureInboxClipboard() {
    if (!electronAPI) return;
    setInboxStatus('Reading clipboard...');
    const result = await electronAPI.invoke('inbox-capture-clipboard');
    handleInboxResult(result);
}

async function openInboxRoot() {
    if (!electronAPI) return;
    const result = await electronAPI.invoke('inbox-open-root');
    if (!result.success) setInboxStatus(result.error || 'Could not open Inbox.', 'error');
}

async function handleInboxAction(action, id) {
    if (!electronAPI || !id) return;
    const channel = {
        open: 'inbox-open-item',
        reveal: 'inbox-reveal-item',
        remove: 'inbox-remove-record'
    }[action];
    if (!channel) return;
    const result = await electronAPI.invoke(channel, id);
    if (!result.success) {
        setInboxStatus(result.error || 'Inbox action failed.', 'error');
        return;
    }
    if (action === 'remove') await loadInboxState();
}

function handleInboxResult(result) {
    if (result?.records?.length) {
        inboxRecords = [...result.records, ...inboxRecords];
        renderInboxRecords();
        inboxTray.classList.add('show');
        setInboxStatus(`已收纳 ${result.records.length} 个项目`);
        setMood('happy');
        setTimeout(() => setMood('idle'), 1800);
        return;
    }
    if (result?.canceled) {
        setInboxStatus('');
        return;
    }
    setInboxStatus(result?.error || result?.failures?.[0]?.error || '没有可收纳的内容', 'error');
    setMood('idle');
}
```

- [ ] **Step 8: Add drag-in and drag-out listeners**

Near the click listeners around `togglePetOptions()`, add:

```javascript
function getDraggedFilePaths(event) {
    return Array.from(event.dataTransfer?.files || [])
        .map(file => file.path)
        .filter(Boolean);
}

function showInboxDragState(active) {
    inboxTray?.classList.toggle('drag-over', active);
    pet?.classList.toggle('inbox-drag-over', active);
    if (active) {
        inboxTray?.classList.add('show');
        setInboxStatus('松手收纳');
        pauseRoam(2500);
    }
}

function bindInboxDropTarget(target) {
    if (!target) return;
    target.addEventListener('dragenter', event => {
        if (!event.dataTransfer?.types?.includes('Files')) return;
        event.preventDefault();
        inboxDragDepth += 1;
        showInboxDragState(true);
    });
    target.addEventListener('dragover', event => {
        if (!event.dataTransfer?.types?.includes('Files')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        showInboxDragState(true);
    });
    target.addEventListener('dragleave', () => {
        inboxDragDepth = Math.max(0, inboxDragDepth - 1);
        if (inboxDragDepth === 0) showInboxDragState(false);
    });
    target.addEventListener('drop', event => {
        event.preventDefault();
        inboxDragDepth = 0;
        showInboxDragState(false);
        const paths = getDraggedFilePaths(event);
        if (paths.length) addInboxFiles(paths, 'drag');
        else setInboxStatus('没有可收纳的文件', 'error');
    });
}

bindInboxDropTarget(pet);
bindInboxDropTarget(inboxTray);

inboxList?.addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    handleInboxAction(button.dataset.action, button.dataset.inboxId);
});

inboxList?.addEventListener('dragstart', event => {
    const recordEl = event.target.closest('.inbox-record[data-inbox-id]');
    if (!recordEl || recordEl.classList.contains('missing')) return;
    event.dataTransfer.effectAllowed = 'copy';
    electronAPI.invoke('inbox-start-drag', recordEl.dataset.inboxId)
        .then(result => {
            if (!result?.success) setInboxStatus(result?.error || '拖出失败', 'error');
        });
});
```

- [ ] **Step 9: Include inbox tray in dismissal and roam guards**

Update the outside click guard so the inbox tray does not close itself:

```javascript
        inboxTray.contains(e.target) ||
```

Add this line where other panels are closed:

```javascript
    inboxTray.classList.remove('show');
```

Update `shouldRoam()` to include the inbox tray:

```javascript
    if (toolbar.classList.contains('show') || settingsPanel.classList.contains('show') || inputBar.classList.contains('show') || inboxTray.classList.contains('show')) return false;
```

Update `showGamePanel`, `enterConversationMode`, and `openPetGame` to hide the inbox tray:

```javascript
    inboxTray.classList.remove('show');
```

- [ ] **Step 10: Run focused renderer contract tests**

Run:

```bash
npx jest tests/__tests__/preload-channels.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 11: Commit renderer tray work**

```bash
git add index.html tests/__tests__/preload-channels.test.js
git commit -m "feat: add file inbox tray"
```

---

### Task 6: Verification And Polish

**Files:**
- Modify only if verification exposes issues: `inbox-system.js`, `main.js`, `preload.js`, `index.html`, tests.

- [ ] **Step 1: Run the focused test suite**

Run:

```bash
npx jest tests/__tests__/inbox-system.test.js tests/__tests__/preload-channels.test.js --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run the full Jest suite**

Run:

```bash
npm test -- --runInBand
```

Expected: PASS, unless unrelated dirty-worktree tests already fail. If unrelated failures appear, record the failing test names and do not change unrelated files.

- [ ] **Step 3: Start the app for manual drag verification**

Run:

```bash
npm start
```

Expected: Electron app opens with the pet UI.

- [ ] **Step 4: Manually verify toolbar replacement**

Manual checks:

- Right-click the pet to show toolbar.
- Confirm the old screenshot/camera entry is gone.
- Confirm the new inbox entry appears and opens `File Inbox`.
- Open settings and confirm `Screenshot` is gone and `Open Inbox` is present.

- [ ] **Step 5: Manually verify file picker collection**

Manual checks:

- Click `Add`.
- Select a small local file.
- Confirm it appears in the recent list.
- Click `Open Inbox`.
- Confirm the copied file exists under `Documents/Petclaw Inbox/YYYY-MM-DD/<type>/`.
- Confirm the original file remains in place.

- [ ] **Step 6: Manually verify drag-in**

Manual checks:

- Drag a file onto the pet.
- Confirm the UI highlights and shows `松手收纳`.
- Drop the file.
- Confirm it appears in recent records and is copied to the Inbox.

- [ ] **Step 7: Manually verify drag-out**

Manual checks:

- Drag a recent file card from the Inbox tray to the desktop or a folder.
- Confirm the dragged file is the Inbox copy.
- Drag a recent file card to a browser or app upload field if one is available.
- If drag-out fails on Windows, inspect whether `event.sender.startDrag` needs to run synchronously from `dragstart`; adjust the renderer/main handshake while keeping the same IPC channel.

- [ ] **Step 8: Manually verify clipboard collection**

Manual checks:

- Copy an image to the clipboard and click `Clip`.
- Confirm a `.png` item appears under `images`.
- Copy text or a URL and click `Clip`.
- If supported in implementation, confirm `.txt` or `.url` appears; if not supported cleanly, confirm the UI shows a short unsupported clipboard error.

- [ ] **Step 9: Commit final polish if needed**

If verification required fixes:

```bash
git add inbox-system.js main.js preload.js index.html tests/__tests__/inbox-system.test.js tests/__tests__/preload-channels.test.js
git commit -m "fix: polish file inbox interactions"
```

If no fixes were needed, do not create an empty commit.
