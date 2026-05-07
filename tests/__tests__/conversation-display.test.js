const fs = require('fs')
const os = require('os')
const path = require('path')
const WorkLogger = require('../../work-logger')

describe('conversation display', () => {
  test('recent message history is newest first', async () => {
    const logger = new WorkLogger(fs.mkdtempSync(path.join(os.tmpdir(), 'work-logger-')))
    await logger.logMessage('用户', 'first')
    await logger.logMessage('小K', 'second')
    await logger.logMessage('用户', 'third')

    expect(logger.getRecentMessages(2).map(message => message.content)).toEqual([
      'third',
      'second',
    ])
  })

  test('recent message history keeps full message content', async () => {
    const logger = new WorkLogger(fs.mkdtempSync(path.join(os.tmpdir(), 'work-logger-')))
    const longReply = 'reply '.repeat(40).trim()

    await logger.logMessage('小K', longReply)

    expect(logger.getRecentMessages(1)[0].content).toBe(longReply)
  })

  test('reply bubble supports expanding long answers from a compact preview', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')

    expect(source).toContain('id="replyBubbleToggle"')
    expect(source).toContain('id="replyBubbleCollapse"')
    expect(source).toContain('id="replyDockButton"')
    expect(source).toContain('let replyBubbleFullContent')
    expect(source).toContain('let currentConversationTitle')
    expect(source).toContain('function toggleReplyBubbleExpanded')
    expect(source).toContain('function collapseReplyBubble')
    expect(source).toContain('function restoreCollapsedReplyBubble')
    expect(source).toContain('function showPendingReplyBubble')
    expect(source).toContain('.reply-bubble.expanded .reply-bubble-text')
    expect(source).toContain('.conversation-dock-button.show')
    expect(source).toContain('.conversation-dock-button.pending')
    expect(source).toContain('.conversation-dock-button.ready')
    expect(source).toContain('id="replyBubbleNext"')
    expect(source).toContain('function continueConversation')
    expect(source).toContain("replyBubble.classList.toggle('has-more'")
    expect(source).toContain("replyBubbleToggle.textContent = '展开'")
    expect(source).toContain("replyBubbleToggle.textContent = '收起'")
  })

  test('completed replies avoid check icons and expose a direct continue action', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')

    expect(source).toContain('.reply-bubble.ready .reply-bubble-next')
    expect(source).toContain("replyBubble.classList.add('ready')")
    expect(source).toContain("setDockState('ready')")
    expect(source).toContain("enterConversationMode({ focusInput: true })")
    expect(source).not.toContain('0aaf47')
    expect(source).not.toContain('0a8f3e')
    expect(source).not.toContain('.reply-bubble.done .reply-bubble-state::after')
    expect(source).not.toContain('.conversation-dock-button.done .conversation-dock-status::after')
  })

  test('sending a message creates a collapsible pending card before the AI reply arrives', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')
    const sendStart = source.indexOf('async function send()')
    const sendEnd = source.indexOf('// ===== IPC =====', sendStart)

    expect(sendStart).toBeGreaterThan(-1)
    expect(sendEnd).toBeGreaterThan(sendStart)
    const sendSource = source.slice(sendStart, sendEnd)

    expect(sendSource).toContain('currentConversationTitle = msg')
    expect(sendSource).toContain('showPendingReplyBubble(msg)')
    expect(sendSource).toContain('setDockState(\'pending\')')
    expect(sendSource).toContain("inputBar.classList.remove('show')")
  })

  test('closing the conversation UI preserves pending replies so late answers still pop up', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')
    const endStart = source.indexOf('function endConversationMode')
    const endEnd = source.indexOf('function showGamePanel', endStart)

    expect(endStart).toBeGreaterThan(-1)
    expect(endEnd).toBeGreaterThan(endStart)
    const endSource = source.slice(endStart, endEnd)

    expect(endSource).toContain('conversationModeActive = false')
    expect(endSource).not.toContain('awaitingConversationReply = false')
    expect(source).toContain('return conversationModeActive || awaitingConversationReply')
  })

  test('reply bubbles render safe lightweight markdown instead of raw markdown text', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')

    expect(source).toContain('function renderMarkdown')
    expect(source).toContain('function renderMarkdownInline')
    expect(source).toContain('replyBubbleText.innerHTML = renderMarkdown')
    expect(source).toContain('.reply-bubble-text code')
    expect(source).toContain('.reply-bubble-text ul')
    expect(source).toContain('rel="noreferrer"')
  })

  test('pet clicks keep basic reactions without opening conversation UI', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')
    const clickStart = source.indexOf("pet.addEventListener('click'")
    const clickEnd = source.indexOf('function resetClick', clickStart)

    expect(source).toContain('id="replyBubble"')
    expect(source).toContain('id="conversationPanel"')
    expect(source).toContain('id="conversationHistoryButton"')
    expect(source).toContain('id="conversationModeToggle"')
    expect(source).toContain('id="conversationStatus"')
    expect(source).toContain('function enterConversationMode')
    expect(source).toContain('function toggleConversationMode')
    expect(source).toContain('function showReplyBubble')
    expect(source).toContain('function showConversationHistory')
    expect(source).toContain("electronAPI.invoke('show-history')")
    expect(source).toContain('onclick="showConversationHistory()"')
    expect(source).toContain('replyBubble.contains(e.target)')
    expect(source).toContain('replyDockButton.contains(e.target)')
    expect(source).toContain("replyBubble.classList.add('show')")
    expect(clickStart).toBeGreaterThan(-1)
    expect(clickEnd).toBeGreaterThan(clickStart)

    const clickSource = source.slice(clickStart, clickEnd)
    expect(clickSource).not.toContain('showConversationHistory')
    expect(clickSource).not.toContain("electronAPI.invoke('show-history')")
    expect(clickSource).not.toContain('enterConversationMode')
    expect(clickSource).not.toContain('showReplyBubble')
    expect(clickSource).toContain('pauseRoam(2400)')
    expect(clickSource).toContain('clickCount++')
    expect(clickSource).toContain('spawnParticles()')
    expect(clickSource).toContain("playSpriteReaction('surprised', 1200)")
    expect(clickSource).toContain("const rr = ['happy', 'talking', 'thinking']")
    expect(clickSource).toContain('EXPR[')
  })

  test('conversation composer keeps mode tools compact and close to the pet', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')

    expect(source).toContain('class="conversation-input-row"')
    expect(source).toContain('class="conversation-tools-row"')
    expect(source).toContain('.conversation-input-row')
    expect(source).toContain('.conversation-tools-row')
    expect(source).toContain('width: 236px')
    expect(source).toContain('bottom: 122px')
    expect(source).toContain('white-space: nowrap')
    expect(source).not.toContain('width: 292px')
    expect(source).not.toContain('flex: 1 0 100%')
  })

  test('agent replies are shown only while the conversation entry is active', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')
    const handlerStart = source.indexOf("electronAPI.on('agent-response'")
    const handlerEnd = source.indexOf("electronAPI.on('status-update'", handlerStart)

    expect(source).toContain('let conversationModeActive = false')
    expect(source).toContain('let awaitingConversationReply = false')
    expect(source).toContain('function shouldShowConversationReply')
    expect(handlerStart).toBeGreaterThan(-1)
    expect(handlerEnd).toBeGreaterThan(handlerStart)

    const handlerSource = source.slice(handlerStart, handlerEnd)
    expect(handlerSource).toContain('if (shouldShowConversationReply())')
    expect(handlerSource).toContain('showReplyBubble(res)')
  })

  test('chat send separates basic AI from OpenClaw mode and keeps errors out of reply bubbles', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')
    const sendStart = source.indexOf('async function send()')
    const sendEnd = source.indexOf('// ===== IPC =====', sendStart)

    expect(source).toContain("let conversationMode = 'basic'")
    expect(sendStart).toBeGreaterThan(-1)
    expect(sendEnd).toBeGreaterThan(sendStart)

    const sendSource = source.slice(sendStart, sendEnd)
    expect(sendSource).toContain("conversationMode === 'openclaw' ? 'gateway-send' : 'direct-chat-send'")
    expect(sendSource).toContain('setConversationStatus')
    expect(sendSource).toContain('return')

    const errorBranchStart = sendSource.indexOf("if (!result?.success)")
    const errorBranchEnd = sendSource.indexOf('setMood', errorBranchStart)
    expect(errorBranchStart).toBeGreaterThan(-1)
    expect(errorBranchEnd).toBeGreaterThan(errorBranchStart)
    expect(sendSource.slice(errorBranchStart, errorBranchEnd)).not.toContain('showReplyBubble')
  })

  test('openclaw chat checks gateway health before sending and can restart it', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'index.html'), 'utf8')
    const sendStart = source.indexOf('async function send()')
    const sendEnd = source.indexOf('// ===== IPC =====', sendStart)

    expect(source).toContain('async function ensureOpenClawReady')
    expect(source).toContain('async function waitForOpenClawGateway')
    expect(source).toContain("electronAPI.invoke('gateway-status')")
    expect(source).toContain("electronAPI.invoke('diag-restart-gateway')")
    expect(source).toContain('gatewaySnapshot?.availability')
    expect(source).toContain('OpenClaw Gateway is offline')
    expect(sendStart).toBeGreaterThan(-1)
    expect(sendEnd).toBeGreaterThan(sendStart)
    expect(source.slice(sendStart, sendEnd)).toContain('await ensureOpenClawReady()')
  })

  test('gateway status exposes chat availability details to the renderer', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8')
    const handlerStart = source.indexOf('async function handleGatewayStatus')
    const handlerEnd = source.indexOf("ipcMain.handle('direct-chat-send'", handlerStart)

    expect(handlerStart).toBeGreaterThan(-1)
    expect(handlerEnd).toBeGreaterThan(handlerStart)
    const handlerSource = source.slice(handlerStart, handlerEnd)
    expect(handlerSource).toContain('gatewayClient.getChatAvailability()')
    expect(handlerSource).toContain('backendCompat.resolve()')
    expect(handlerSource).toContain('availability')
    expect(handlerSource).toContain('backend')
  })

  test('show-history returns newest-first messages for renderers', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8')
    const handlerStart = source.indexOf("ipcMain.handle('show-history'")
    const handlerEnd = source.indexOf('// Gateway 消息处理', handlerStart)

    expect(handlerStart).toBeGreaterThan(-1)
    expect(handlerEnd).toBeGreaterThan(handlerStart)

      const handlerSource = source.slice(handlerStart, handlerEnd)
      expect(handlerSource).toContain('getRecentMessages(Number.MAX_SAFE_INTEGER)')
      expect(handlerSource).toContain('logs.slice(0, 5)')
      expect(handlerSource).toContain('return { success: true, messages: logs, recent }')
      expect(handlerSource).not.toContain('sendLyric')
    })

  test('agent reply publication does not also create a lyric dialog', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8')
    const publisherStart = source.indexOf('function publishAgentResponse')
    const publisherEnd = source.indexOf('let restartHandler', publisherStart)

    expect(publisherStart).toBeGreaterThan(-1)
    expect(publisherEnd).toBeGreaterThan(publisherStart)

    const publisherSource = source.slice(publisherStart, publisherEnd)
    expect(publisherSource).toContain("mainWindow.webContents.send('agent-response'")
    expect(publisherSource).not.toContain('sendLyric')
  })

  test('main process exposes a direct basic AI chat path separate from OpenClaw', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8')

    expect(source).toContain('const BASIC_CHAT_SYSTEM_PROMPT')
    expect(source).toContain('async function handleDirectChatSend')
    expect(source).toContain("ipcMain.handle('direct-chat-send', handleDirectChatSend)")
    expect(source).toContain('sendDirectChatMessage')
    expect(source).toContain('messages: [')
    expect(source).toContain('role: \'system\'')
    expect(source).toContain('publishAgentResponse(response.content')
  })
})
