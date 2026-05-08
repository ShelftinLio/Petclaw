function callIfAvailable(target, methodName) {
  if (target && typeof target[methodName] === 'function') {
    target[methodName]();
  }
}

function focusWindowSafely(win) {
  if (!win || (typeof win.isDestroyed === 'function' && win.isDestroyed())) {
    return false;
  }

  if (typeof win.isMinimized === 'function' && win.isMinimized()) {
    callIfAvailable(win, 'restore');
  }

  if (typeof win.isVisible === 'function' && !win.isVisible()) {
    callIfAvailable(win, 'show');
  }

  callIfAvailable(win, 'moveTop');
  callIfAvailable(win, 'focus');
  return true;
}

module.exports = {
  focusWindowSafely,
};
