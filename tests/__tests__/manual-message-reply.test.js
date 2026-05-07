const fs = require('fs')
const path = require('path')

describe('manual message replies', () => {
  test('gateway-send publishes successful manual replies through the visible agent response path', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', '..', 'main.js'), 'utf8')
    const handlerStart = source.indexOf('async function handleGatewaySend')
    const handlerEnd = source.indexOf('async function handleGatewayStatus')

    expect(handlerStart).toBeGreaterThan(-1)
    expect(handlerEnd).toBeGreaterThan(handlerStart)

    const handlerSource = source.slice(handlerStart, handlerEnd)

    expect(source).toContain('function publishAgentResponse')
    expect(handlerSource).toContain('publishAgentResponse(response')
    expect(source).toContain("mainWindow.webContents.send('agent-response'")
    expect(source).toContain('voiceSystem.speak')
  })
})
