const { focusWindowSafely } = require('../../utils/window-visibility')

function createWindowDouble(overrides = {}) {
  const calls = []
  const win = {
    isDestroyed: () => false,
    isMinimized: () => false,
    isVisible: () => true,
    restore: () => calls.push('restore'),
    show: () => calls.push('show'),
    moveTop: () => calls.push('moveTop'),
    focus: () => calls.push('focus'),
    ...overrides,
  }
  return { win, calls }
}

describe('window visibility helpers', () => {
  test('restores and shows an existing hidden minimized window before focusing it', () => {
    const { win, calls } = createWindowDouble({
      isMinimized: () => true,
      isVisible: () => false,
    })

    expect(focusWindowSafely(win)).toBe(true)

    expect(calls).toEqual(['restore', 'show', 'moveTop', 'focus'])
  })

  test('returns false for missing or destroyed windows', () => {
    expect(focusWindowSafely(null)).toBe(false)

    const { win, calls } = createWindowDouble({
      isDestroyed: () => true,
    })

    expect(focusWindowSafely(win)).toBe(false)
    expect(calls).toEqual([])
  })
})
