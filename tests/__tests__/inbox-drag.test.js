const path = require('path')
const { startInboxDrag } = require('../../utils/inbox-drag')

function createInbox(records = []) {
  return {
    getRecord: jest.fn((id) => records.find(record => record.id === id) || null),
    getState: jest.fn(() => ({ records })),
  }
}

describe('inbox drag-out bridge', () => {
  test('starts a native drag synchronously for an existing inbox file', () => {
    const inboxPath = __filename
    const sender = { startDrag: jest.fn() }
    const inbox = createInbox([{ id: 'record-1', inboxPath }])
    const iconPath = path.join(__dirname, '..', '..', 'icon.png')

    const result = startInboxDrag({ inbox, sender, id: 'record-1', iconPath })

    expect(result).toEqual({ success: true })
    expect(sender.startDrag).toHaveBeenCalledWith({
      file: inboxPath,
      icon: iconPath,
    })
  })

  test('does not call native drag for missing records or missing files', () => {
    const sender = { startDrag: jest.fn() }

    expect(startInboxDrag({
      inbox: createInbox([]),
      sender,
      id: 'missing-record',
      iconPath: 'icon.png',
    })).toMatchObject({ success: false, error: 'Inbox item not available' })

    expect(startInboxDrag({
      inbox: createInbox([{ id: 'record-1', inboxPath: path.join(__dirname, 'missing.file') }]),
      sender,
      id: 'record-1',
      iconPath: 'icon.png',
    })).toMatchObject({ success: false, error: 'Inbox item not available' })

    expect(sender.startDrag).not.toHaveBeenCalled()
  })
})
