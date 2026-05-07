jest.mock('child_process', () => {
  const { EventEmitter } = require('events')
  return {
    execSync: jest.fn(() => ''),
    spawn: jest.fn(() => {
      const child = new EventEmitter()
      process.nextTick(() => child.emit('close', 0))
      return child
    }),
  }
})

jest.mock('../../scripts/open-terminal', () => ({
  openTerminal: jest.fn(() => Promise.resolve({ launched: true })),
}))

jest.mock('../../utils/config-manager', () => ({
  getConfig: jest.fn(() => ({ gateway: { port: 18789 } })),
}))

jest.mock('../../utils/openclaw-detector', () => ({
  detect: jest.fn(() =>
    Promise.resolve({
      installed: true,
      version: '2026.4.1',
      cliPath: '/opt/homebrew/bin/openclaw',
      configFile: {
        exists: true,
        path: '/Users/test/.openclaw/openclaw.json',
      },
    })
  ),
}))

jest.mock('../../utils/backend-compat', () => ({
  resolve: jest.fn(() => ({
    preference: { mode: 'auto', source: 'auto' },
    activeMode: 'openclaw',
    active: {
      mode: 'openclaw',
      label: 'OpenClaw',
      installed: true,
      cliPath: '/opt/homebrew/bin/openclaw',
      configPath: '/Users/test/.openclaw/openclaw.json',
      configDir: '/Users/test/.openclaw',
      apiHost: 'http://127.0.0.1:18789',
      healthUrl: 'http://127.0.0.1:18789',
      logPaths: {
        out: '/Users/test/.openclaw/logs/gateway.log',
        err: '/Users/test/.openclaw/logs/gateway.err.log',
      },
      invocation: jest.fn((args = []) => ({
        source: 'installed-cli',
        installRoot: '/opt/homebrew/lib/node_modules/openclaw',
        cliPath: '/opt/homebrew/bin/openclaw',
        command: '/opt/homebrew/bin/openclaw',
        args,
        cwd: '/opt/homebrew/bin',
        shell: false,
      })),
    },
    openclaw: { installed: true },
    hermes: { installed: false },
  })),
  probeGateway: jest.fn(() => Promise.resolve({ ok: true, status: 200, source: 'http' })),
}))

jest.mock('../../utils/openclaw-path-resolver', () => ({
  resolveOpenClawInvocation: jest.fn((args = []) => ({
    source: 'installed-cli',
    installRoot: '/opt/homebrew/lib/node_modules/openclaw',
    cliPath: '/opt/homebrew/bin/openclaw',
    command: '/opt/homebrew/bin/openclaw',
    args,
    cwd: '/opt/homebrew/bin',
    shell: false,
  })),
}))

jest.mock('../../utils/path-resolver', () => ({
  getProjectRoot: jest.fn(() => '/repo/petclaw'),
  getOpenClawConfigDir: jest.fn(() => '/Users/test/.openclaw'),
  getOpenClawConfigPath: jest.fn(() => '/Users/test/.openclaw/openclaw.json'),
}))

const { execSync, spawn } = require('child_process')
const { openTerminal } = require('../../scripts/open-terminal')
const backendCompat = require('../../utils/backend-compat')
const { formatHelp, parseArgs, run } = require('../../bin/petclaw')

function mockListenerOutput(command, pid, port) {
  if (process.platform === 'win32') {
    return `  TCP    127.0.0.1:${port}    0.0.0.0:0    LISTENING    ${pid}`
  }

  return `COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME\n${command} ${pid} user 15u IPv4 0t0 TCP 127.0.0.1:${port} (LISTEN)`
}

describe('petclaw cli', () => {
  const originalFetch = global.fetch
  const stdoutSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  const stderrSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

  beforeEach(() => {
    execSync.mockReset()
    execSync.mockImplementation(() => '')
    spawn.mockClear()
    openTerminal.mockClear()
    global.fetch = jest.fn(() => Promise.resolve({ status: 200 }))
    backendCompat.resolve.mockImplementation(() => ({
      preference: { mode: 'auto', source: 'auto' },
      activeMode: 'openclaw',
      active: {
        mode: 'openclaw',
        label: 'OpenClaw',
        installed: true,
        cliPath: '/opt/homebrew/bin/openclaw',
        configPath: '/Users/test/.openclaw/openclaw.json',
        configDir: '/Users/test/.openclaw',
        apiHost: 'http://127.0.0.1:18789',
        healthUrl: 'http://127.0.0.1:18789',
        logPaths: {
          out: '/Users/test/.openclaw/logs/gateway.log',
          err: '/Users/test/.openclaw/logs/gateway.err.log',
        },
        invocation: jest.fn((args = []) => ({
          source: 'installed-cli',
          installRoot: '/opt/homebrew/lib/node_modules/openclaw',
          cliPath: '/opt/homebrew/bin/openclaw',
          command: '/opt/homebrew/bin/openclaw',
          args,
          cwd: '/opt/homebrew/bin',
          shell: false,
        })),
      },
      openclaw: { installed: true },
      hermes: { installed: false },
    }))
    backendCompat.probeGateway.mockResolvedValue({ ok: true, status: 200, source: 'http' })
  })

  afterAll(() => {
    global.fetch = originalFetch
    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  test('formats help with gateway entrypoint', () => {
    expect(formatHelp()).toContain('petclaw gateway')
    expect(formatHelp()).toContain('petclaw doctor')
    expect(formatHelp()).toContain('PETCLAW_COMPAT_MODE=hermes')
  })

  test('parses gateway as the animated console command', () => {
    expect(parseArgs(['gateway'])).toEqual({ type: 'gateway-start' })
    expect(parseArgs(['console'])).toEqual({ type: 'gateway-start' })
  })

  test('parses gateway status json mode', () => {
    expect(parseArgs(['gateway', 'status', '--json'])).toEqual({
      type: 'gateway-status',
      json: true,
    })
  })

  test('parses gateway logs options', () => {
    expect(parseArgs(['gateway', 'logs', '--tail', '80', '--err'])).toEqual({
      type: 'gateway-logs',
      err: true,
      json: false,
      tail: 80,
    })
  })

  test('launches the animated terminal for gateway start', async () => {
    await expect(run({ type: 'gateway-start' })).resolves.toBe(0)
    expect(openTerminal).toHaveBeenCalledTimes(1)
  })

  test('prints gateway status successfully', async () => {
    execSync
      .mockImplementationOnce(() => mockListenerOutput('node', 1653, 18789))
      .mockImplementationOnce(() => '1653 /repo/petclaw/node_modules/electron/dist/Electron .')

    await expect(run({ type: 'gateway-status', json: false })).resolves.toBe(0)
    expect(backendCompat.probeGateway).toHaveBeenCalled()
    expect(stdoutSpy).toHaveBeenCalledWith('Petclaw Gateway Status')
  })

  test('prints doctor output with ownership and dashboard checks', async () => {
    execSync
      .mockImplementationOnce(() => mockListenerOutput('node', 1653, 18789))
      .mockImplementationOnce(() => '1653 /repo/petclaw/node_modules/electron/dist/Electron .')

    await expect(run({ type: 'doctor', json: false })).resolves.toBe(0)
    expect(stdoutSpy).toHaveBeenCalledWith('Petclaw Doctor')
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('Gateway ownership'))
  })

  test('reports the installed openclaw cli in status output', async () => {
    execSync
      .mockImplementationOnce(() => '')
      .mockImplementationOnce(() => '')

    await expect(run({ type: 'gateway-status', json: false })).resolves.toBe(0)
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('/opt/homebrew/bin/openclaw'))
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('Petclaw processes: none'))
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('Compat backend: OpenClaw'))
  })

  test('supports Hermes compatibility mode in status output', async () => {
    backendCompat.resolve.mockImplementation(() => ({
      preference: { mode: 'hermes', source: 'env' },
      activeMode: 'hermes',
      active: {
        mode: 'hermes',
        label: 'Hermes',
        installed: true,
        cliPath: '/Users/test/.local/bin/hermes',
        configPath: '/Users/test/.hermes/config.yaml',
        configDir: '/Users/test/.hermes',
        apiHost: 'http://127.0.0.1:8642',
        apiServerEnabled: true,
        logPaths: {
          out: '/Users/test/.hermes/logs/gateway.log',
          err: '/Users/test/.hermes/logs/gateway.error.log',
        },
        invocation: jest.fn(),
      },
      openclaw: { installed: false },
      hermes: { installed: true },
    }))
    backendCompat.probeGateway.mockResolvedValueOnce({ ok: true, status: 200, source: 'http' })

    execSync
      .mockImplementationOnce(() => '')
      .mockImplementationOnce(() => '')

    await expect(run({ type: 'gateway-status', json: false })).resolves.toBe(0)
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('Compat backend: Hermes'))
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('/Users/test/.local/bin/hermes'))
  })

  test('treats an external Hermes service as reusable instead of an ownership failure', async () => {
    backendCompat.resolve.mockImplementation(() => ({
      preference: { mode: 'hermes', source: 'pet-config' },
      activeMode: 'hermes',
      active: {
        mode: 'hermes',
        label: 'Hermes',
        installed: true,
        cliPath: '/Users/test/.local/bin/hermes',
        configPath: '/Users/test/.hermes/config.yaml',
        configDir: '/Users/test/.hermes',
        apiHost: 'http://127.0.0.1:8642',
        apiServerEnabled: true,
        logPaths: {
          out: '/Users/test/.hermes/logs/gateway.log',
          err: '/Users/test/.hermes/logs/gateway.error.log',
        },
        invocation: jest.fn(),
      },
      openclaw: { installed: true },
      hermes: { installed: true },
    }))
    backendCompat.probeGateway.mockResolvedValueOnce({ ok: true, status: 200, source: 'http' })

    execSync
      .mockImplementationOnce(() => mockListenerOutput('Python', 95013, 8642))
      .mockImplementationOnce(() => '91859 /repo/petclaw/node_modules/electron/dist/Electron .')

    await expect(run({ type: 'doctor', json: false })).resolves.toBe(0)
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('OK Gateway ownership: Hermes gateway is already running as an external service and can be reused'))
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('Hermes service reuse is active'))
  })

  test('stops the installed gateway before force cleanup', async () => {
    backendCompat.probeGateway
      .mockResolvedValueOnce({ ok: true, status: 200, source: 'http' })
      .mockResolvedValueOnce({ ok: false, error: 'offline', source: 'http' })
      .mockResolvedValueOnce({ ok: false, error: 'offline', source: 'http' })

    execSync
      .mockImplementationOnce(() => mockListenerOutput('node', 1653, 18789))
      .mockImplementationOnce(
        () =>
          '33814 /Users/test/petclaw/node_modules/.bin/electron .\n33996 /Users/test/petclaw/node_modules/electron/dist/Electron.app/Contents/Frameworks/Electron Helper (GPU).app/Contents/MacOS/Electron Helper (GPU) --user-data-dir=/Users/test/Library/Application Support/openclaw-petclaw'
      )
      .mockImplementationOnce(() => '')
      .mockImplementationOnce(() => '')
      .mockImplementationOnce(() => '')
      .mockImplementationOnce(() => '')

    await expect(run({ type: 'gateway-stop' })).resolves.toBe(0)
    expect(spawn).toHaveBeenCalledWith(
      '/opt/homebrew/bin/openclaw',
      ['gateway', 'stop'],
      expect.objectContaining({ cwd: '/opt/homebrew/bin', stdio: 'inherit' })
    )
    expect(stdoutSpy).toHaveBeenCalledWith('Requested installed OpenClaw gateway stop.')
  })

  test('preserves an external Hermes service when stopping Petclaw', async () => {
    backendCompat.resolve.mockImplementation(() => ({
      preference: { mode: 'hermes', source: 'pet-config' },
      activeMode: 'hermes',
      active: {
        mode: 'hermes',
        label: 'Hermes',
        installed: true,
        cliPath: '/Users/test/.local/bin/hermes',
        configPath: '/Users/test/.hermes/config.yaml',
        configDir: '/Users/test/.hermes',
        apiHost: 'http://127.0.0.1:8642',
        apiServerEnabled: true,
        logPaths: {
          out: '/Users/test/.hermes/logs/gateway.log',
          err: '/Users/test/.hermes/logs/gateway.error.log',
        },
        invocation: jest.fn((args = []) => ({
          source: 'installed-cli',
          cliPath: '/Users/test/.local/bin/hermes',
          command: '/Users/test/.local/bin/hermes',
          args,
          cwd: '/Users/test/.local/bin',
          shell: false,
        })),
      },
      openclaw: { installed: true },
      hermes: { installed: true },
    }))
    backendCompat.probeGateway.mockResolvedValue({ ok: true, status: 200, source: 'http' })

    if (process.platform === 'win32') {
      execSync
        .mockImplementationOnce(() => mockListenerOutput('Python', 95013, 8642))
        .mockImplementationOnce(() => mockListenerOutput('Python', 95013, 8642))
        .mockImplementationOnce(() => mockListenerOutput('Python', 95013, 8642))
        .mockImplementationOnce(() => mockListenerOutput('Python', 95013, 8642))
    } else {
      execSync
        .mockImplementationOnce(() => mockListenerOutput('Python', 95013, 8642))
        .mockImplementationOnce(() => '')
        .mockImplementationOnce(() => mockListenerOutput('Python', 95013, 8642))
        .mockImplementationOnce(() => '')
    }

    await expect(run({ type: 'gateway-stop' })).resolves.toBe(0)
    expect(spawn).not.toHaveBeenCalled()
    expect(stdoutSpy).toHaveBeenCalledWith('Hermes gateway is running separately; Petclaw left the external service untouched.')
  })
})
