const fs = require('fs')

function startInboxDrag({ inbox, sender, id, iconPath }) {
  const record = inbox && typeof inbox.getRecord === 'function'
    ? inbox.getRecord(id)
    : null

  if (!record || !record.inboxPath || !fs.existsSync(record.inboxPath)) {
    return { success: false, error: 'Inbox item not available' }
  }

  if (!sender || typeof sender.startDrag !== 'function') {
    return { success: false, error: 'Drag sender unavailable' }
  }

  sender.startDrag({
    file: record.inboxPath,
    icon: iconPath,
  })
  return { success: true }
}

module.exports = {
  startInboxDrag,
}
