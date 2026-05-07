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
  archives: ['.zip', '.rar', '.7z', '.tar', '.gz'],
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
    pad(date.getSeconds()),
  ].join('')
  return `inbox_${stamp}_${Math.random().toString(36).slice(2, 8)}`
}

function looksLikeUrl(text) {
  return /^https?:\/\/\S+/i.test(String(text || '').trim())
}

function sanitizeFileName(name) {
  const clean = String(name || 'item')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
    .trim()
  return clean || 'item'
}

class InboxSystem {
  constructor(options = {}) {
    this.inboxRoot = options.inboxRoot || path.join(os.homedir(), 'Documents', 'Petclaw Inbox')
    this.recordPath = options.recordPath || path.join(process.cwd(), 'pet-inbox.json')
    this.now = typeof options.now === 'function' ? options.now : () => new Date()
    this.records = []
  }

  static classifyType(fileName) {
    const ext = path.extname(String(fileName || '')).toLowerCase()
    for (const [type, extensions] of Object.entries(TYPE_EXTENSIONS)) {
      if (extensions.includes(ext)) return type
    }
    return 'other'
  }

  static formatDateSegment(date = new Date()) {
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
    ].join('-')
  }

  async load() {
    try {
      const raw = JSON.parse(await fsp.readFile(this.recordPath, 'utf8'))
      this.records = Array.isArray(raw.records) ? raw.records : []
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
    this.records = this.records.slice(0, MAX_RECENT_RECORDS)
    await fsp.writeFile(this.recordPath, JSON.stringify({ records: this.records }, null, 2), 'utf8')
    return this.getState()
  }

  getState() {
    return {
      inboxRoot: this.inboxRoot,
      records: this.records.map(record => ({
        ...record,
        missing: record.inboxPath ? !fs.existsSync(record.inboxPath) : false,
      })),
    }
  }

  getRecord(id) {
    return this.records.find(record => record.id === id) || null
  }

  async getUniqueTargetPath(targetDir, fileName) {
    await fsp.mkdir(targetDir, { recursive: true })
    const parsed = path.parse(sanitizeFileName(fileName))
    const base = parsed.name || 'item'
    const ext = parsed.ext || ''
    let candidate = path.join(targetDir, `${base}${ext}`)
    let index = 2
    while (fs.existsSync(candidate)) {
      candidate = path.join(targetDir, `${base} (${index})${ext}`)
      index += 1
    }
    return candidate
  }

  async collectFiles(filePaths = [], options = {}) {
    const records = []
    const failures = []

    for (const sourcePath of filePaths.filter(Boolean)) {
      try {
        if (!fs.existsSync(sourcePath)) {
          throw new Error(`Source file missing: ${sourcePath}`)
        }
        const record = await this.copyFileIntoInbox(sourcePath, options)
        records.push(record)
      } catch (err) {
        failures.push({ sourcePath, error: err.message })
      }
    }

    if (records.length > 0) {
      this.records = [...records, ...this.records].slice(0, MAX_RECENT_RECORDS)
      await this.save()
    }

    return {
      success: records.length > 0,
      records,
      failures,
      state: this.getState(),
    }
  }

  async copyFileIntoInbox(sourcePath, options = {}) {
    const date = this.now()
    const displayName = sanitizeFileName(options.displayName || path.basename(sourcePath))
    const type = InboxSystem.classifyType(displayName)
    const targetDir = path.join(this.inboxRoot, InboxSystem.formatDateSegment(date), type)
    const inboxPath = await this.getUniqueTargetPath(targetDir, displayName)
    await fsp.copyFile(sourcePath, inboxPath)
    const stat = await fsp.stat(inboxPath)

    return {
      id: createId(date),
      name: path.basename(inboxPath),
      type,
      source: options.source || 'picker',
      originalPath: sourcePath,
      inboxPath,
      size: stat.size,
      createdAt: date.toISOString(),
      note: '',
    }
  }

  async collectClipboardImage(pngBuffer, options = {}) {
    const date = this.now()
    const targetDir = path.join(this.inboxRoot, InboxSystem.formatDateSegment(date), 'images')
    const inboxPath = await this.getUniqueTargetPath(targetDir, options.displayName || 'clipboard-image.png')
    await fsp.writeFile(inboxPath, pngBuffer)
    const stat = await fsp.stat(inboxPath)
    const record = {
      id: createId(date),
      name: path.basename(inboxPath),
      type: 'images',
      source: 'clipboard',
      originalPath: null,
      inboxPath,
      size: stat.size,
      createdAt: date.toISOString(),
      note: '',
    }
    this.records = [record, ...this.records].slice(0, MAX_RECENT_RECORDS)
    await this.save()
    return { success: true, records: [record], failures: [], state: this.getState() }
  }

  async collectClipboardText(text, options = {}) {
    const date = this.now()
    const isUrl = looksLikeUrl(text)
    const type = isUrl ? 'links' : 'text'
    const extension = isUrl ? '.url' : '.txt'
    const defaultName = isUrl ? 'clipboard-link.url' : 'clipboard-text.txt'
    const targetDir = path.join(this.inboxRoot, InboxSystem.formatDateSegment(date), type)
    const displayName = sanitizeFileName(options.displayName || defaultName)
    const finalName = path.extname(displayName) ? displayName : `${displayName}${extension}`
    const inboxPath = await this.getUniqueTargetPath(targetDir, finalName)
    const content = isUrl ? `[InternetShortcut]\nURL=${String(text).trim()}\n` : String(text || '')
    await fsp.writeFile(inboxPath, content, 'utf8')
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
      note: '',
    }
    this.records = [record, ...this.records].slice(0, MAX_RECENT_RECORDS)
    await this.save()
    return { success: true, records: [record], failures: [], state: this.getState() }
  }

  async removeRecord(id) {
    const before = this.records.length
    this.records = this.records.filter(record => record.id !== id)
    await this.save()
    return {
      success: this.records.length !== before,
      records: this.getState().records,
      state: this.getState(),
    }
  }
}

module.exports = InboxSystem
