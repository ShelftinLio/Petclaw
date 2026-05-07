const path = require('path')

describe('openclaw path resolver', () => {
  afterEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  test('trims Windows where output and prefers the cmd shim', () => {
    const cliNoExt = 'C:\\Users\\Administrator\\AppData\\Roaming\\npm\\openclaw'
    const cliCmd = `${cliNoExt}.cmd`
    const execSync = jest.fn(() => `${cliNoExt}\r\n${cliCmd}\r\n`)
    const existsSync = jest.fn((target) => [cliNoExt, cliCmd].includes(String(target)))

    jest.doMock('child_process', () => ({ execSync }))
    jest.doMock('fs', () => ({
      ...jest.requireActual('fs'),
      existsSync,
    }))

    const resolver = require('../../utils/openclaw-path-resolver')

    expect(resolver.findOpenClawCliPath()).toBe(path.normalize(cliCmd))
    expect(existsSync).not.toHaveBeenCalledWith(`${cliNoExt}\r`)
  })
})
