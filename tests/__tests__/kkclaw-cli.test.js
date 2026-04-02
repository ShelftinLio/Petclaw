jest.mock('child_process', () => ({
  execSync: jest.fn(() => ''),
  spawn: jest.fn(),
}))

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

jest.mock('../../utils/path-resolver', () => ({
  getProjectRoot: jest.fn(() => '/repo/kkclaw'),
  getOpenClawConfigDir: jest.fn(() => '/Users/test/.openclaw'),
  getOpenClawConfigPath: jest.fn(() => '/Users/test/.openclaw/openclaw.json'),
}))

const { execSync } = require('child_process')
const { openTerminal } = require('../../scripts/open-terminal')
const { formatHelp, parseArgs, run } = require('../../bin/kkclaw')

describe('kkclaw cli', () => {
  const originalFetch = global.fetch
  const stdoutSpy = jest.spyOn(console, 'log').mockImplementation(() => {})
  const stderrSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

  beforeEach(() => {
    execSync.mockReset()
    execSync.mockImplementation(() => '')
    openTerminal.mockClear()
    global.fetch = jest.fn(() => Promise.resolve({ status: 200 }))
  })

  afterAll(() => {
    global.fetch = originalFetch
    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
  })

  test('formats help with gateway entrypoint', () => {
    expect(formatHelp()).toContain('kkclaw gateway')
    expect(formatHelp()).toContain('kkclaw doctor')
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
      .mockImplementationOnce(() => 'COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME\nnode 1653 user 15u IPv4 0t0 TCP 127.0.0.1:18789 (LISTEN)')
      .mockImplementationOnce(() => '1653 /repo/kkclaw/node_modules/electron/dist/Electron .')

    await expect(run({ type: 'gateway-status', json: false })).resolves.toBe(0)
    expect(global.fetch).toHaveBeenCalledWith('http://127.0.0.1:18789', expect.any(Object))
    expect(stdoutSpy).toHaveBeenCalledWith('KKClaw Gateway Status')
  })

  test('prints doctor output with ownership and dashboard checks', async () => {
    execSync
      .mockImplementationOnce(() => 'COMMAND PID USER FD TYPE DEVICE SIZE/OFF NODE NAME\nnode 1653 user 15u IPv4 0t0 TCP 127.0.0.1:18789 (LISTEN)')
      .mockImplementationOnce(() => '1653 /repo/kkclaw/node_modules/electron/dist/Electron .')

    await expect(run({ type: 'doctor', json: false })).resolves.toBe(0)
    expect(stdoutSpy).toHaveBeenCalledWith('KKClaw Doctor')
    expect(stdoutSpy).toHaveBeenCalledWith(expect.stringContaining('Gateway ownership'))
  })
})
