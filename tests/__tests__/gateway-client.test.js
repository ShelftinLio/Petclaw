jest.mock('../../utils/openclaw-path-resolver', () => ({
  getConfigPath: jest.fn(() => '/Users/test/.openclaw/openclaw.json'),
  resolveOpenClawInvocation: jest.fn((args = []) => ({
    command: 'C:\\Users\\test\\AppData\\Roaming\\npm\\openclaw.cmd',
    args,
    cwd: 'C:\\Users\\test\\AppData\\Roaming\\npm',
    shell: true,
    windowsHide: true,
  })),
}))

jest.mock('child_process', () => ({
  spawn: jest.fn(),
}))

jest.mock('../../utils/config-manager', () => ({
  getConfig: jest.fn(() => ({})),
}))

jest.mock('../../utils/backend-compat', () => ({
  resolve: jest.fn(() => ({
    active: {
      mode: 'hermes',
      apiServerEnabled: false,
      chatBlockReason: 'Hermes API server 未启用，请在 ~/.hermes/.env 中设置 API_SERVER_ENABLED=true 后重启 Hermes。',
      apiHost: 'http://127.0.0.1:8642',
      apiKey: '',
      apiKeyHeader: {},
      model: 'hermes-agent',
    },
  })),
}))

jest.mock('../../utils/log-sanitizer', () => ({
  sanitizeMessage: jest.fn((value) => value),
}))

jest.mock('../../utils/secure-storage', () => ({
  getSecureToken: jest.fn(() => ''),
}))

jest.mock('../../utils/session-lock-manager', () => ({
  isPluginSessionKey: jest.fn(() => false),
  cleanupPluginSessions: jest.fn(() => ({ deletedSessions: 0, removedLocks: 0, skippedLocked: 0 })),
}))

const GatewayClient = require('../../gateway-client')
const backendCompat = require('../../utils/backend-compat')
const { spawn } = require('child_process')
const EventEmitter = require('events')
const fs = require('fs')

describe('gateway client', () => {
  const originalFetch = global.fetch
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

  afterEach(() => {
    global.fetch = originalFetch
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  afterAll(() => {
    errorSpy.mockRestore()
  })

  test('blocks Hermes chat requests when the API server is disabled', async () => {
    global.fetch = jest.fn()
    const client = new GatewayClient()

    await expect(client.sendMessage('hello')).resolves.toContain('Hermes API server 未启用')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('blocks OpenClaw chat requests when the CLI is missing', async () => {
    backendCompat.resolve.mockReturnValueOnce({
      active: {
        mode: 'openclaw',
        label: 'OpenClaw',
        installed: false,
        cliPath: null,
        chatReady: false,
        chatBlockReason: 'OpenClaw CLI not found. Install OpenClaw or add it to PATH.',
        apiHost: 'http://127.0.0.1:18789',
        apiKey: '',
        apiKeyHeader: {},
        model: 'openclaw:main',
      },
    })
    global.fetch = jest.fn()
    const client = new GatewayClient()

    await expect(client.sendMessage('hello')).resolves.toContain('OpenClaw CLI not found')
    expect(global.fetch).not.toHaveBeenCalled()
  })

  test('uses the OpenClaw agent CLI instead of the legacy chat completions endpoint', async () => {
    const originalNpmNodeExecPath = process.env.npm_node_execpath
    process.env.npm_node_execpath = 'C:\\Tools\\node.exe'
    backendCompat.resolve.mockReturnValue({
      active: {
        mode: 'openclaw',
        label: 'OpenClaw',
        installed: true,
        cliPath: 'openclaw.cmd',
        chatReady: true,
        chatBlockReason: null,
        apiHost: 'http://127.0.0.1:18789',
        apiKey: '',
        apiKeyHeader: {},
        model: 'openclaw:main',
      },
    })
    global.fetch = jest.fn()
    jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    spawn.mockImplementation(() => {
      const child = new EventEmitter()
      child.stdout = new EventEmitter()
      child.stderr = new EventEmitter()
      child.kill = jest.fn()
      process.nextTick(() => {
        child.stdout.emit('data', Buffer.from(JSON.stringify({
          payloads: [{ text: 'OpenClaw OK' }],
          meta: { finalAssistantVisibleText: 'OpenClaw OK' },
        })))
        child.emit('close', 0)
      })
      return child
    })

    const client = new GatewayClient()

    await expect(client.sendMessage('hello')).resolves.toBe('OpenClaw OK')
    expect(global.fetch).not.toHaveBeenCalled()
    expect(spawn).toHaveBeenCalledWith(
      'C:\\Tools\\node.exe',
      expect.arrayContaining([
        'C:\\Users\\test\\AppData\\Roaming\\npm\\node_modules\\openclaw\\openclaw.mjs',
        'agent',
        '--agent',
        'main',
        '--session-id',
        'petclaw-desktop-pet',
        '--message',
        '--local',
        '--json',
      ]),
      expect.objectContaining({ shell: false, windowsHide: true })
    )
    const args = spawn.mock.calls[0][1]
    const messageArg = args[args.indexOf('--message') + 1]
    expect(messageArg).toContain('hello')
    expect(messageArg).toContain('请用简短')
    if (originalNpmNodeExecPath === undefined) {
      delete process.env.npm_node_execpath
    } else {
      process.env.npm_node_execpath = originalNpmNodeExecPath
    }
  })
})
