// KKClaw Startup Hero Banner
// Animation: fire-sweep + eye-open + bounce

const os = require('os');

const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  white:   '\x1b[37m',
  bWhite:  '\x1b[97m',
  gray:    '\x1b[90m',
  bRed:    '\x1b[91m',
  bGreen:  '\x1b[92m',
  bCyan:   '\x1b[96m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
};

// Lobster Ball — eyes CLOSED (line 7 has no gaps)
const LOGO_CLOSED = [
  '                \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588                ',
  '            \u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2588\u2588\u2588\u2588            ',
  '          \u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2588\u2588          ',
  '        \u2588\u2588\u2591\u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2588\u2588        ',
  '       \u2588\u2591\u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2588       ',
  '      \u2588\u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2588      ',
  '     \u2588\u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2588     ',
  '     \u2588\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2588     ',
  '     \u2588\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2588     ',
  '      \u2588\u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2588      ',
  '       \u2588\u2591\u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2588       ',
  '        \u2588\u2588\u2591\u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2588\u2588        ',
  '          \u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2588\u2588          ',
  '            \u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2588\u2588\u2588\u2588            ',
  '                \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588                ',
];

// Lobster Ball — eyes OPEN (line 7 has two eye gaps)
const LOGO_OPEN = [
  '                \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588                ',
  '            \u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2588\u2588\u2588\u2588            ',
  '          \u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2588\u2588          ',
  '        \u2588\u2588\u2591\u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2588\u2588        ',
  '       \u2588\u2591\u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2588       ',
  '      \u2588\u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2588      ',
  '     \u2588\u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2588     ',
  '     \u2588\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588  \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2588     ',
  '     \u2588\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2588     ',
  '      \u2588\u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2588      ',
  '       \u2588\u2591\u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2588       ',
  '        \u2588\u2588\u2591\u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2588\u2588        ',
  '          \u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2588\u2588          ',
  '            \u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2588\u2588\u2588\u2588            ',
  '                \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588                ',
];

const EYE_LINE_IDX = 7; // which LOGO line has the eyes

const TITLE = [
  ' \u2588\u2588\u2557  \u2588\u2588\u2557\u2588\u2588\u2557  \u2588\u2588\u2557 \u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2557      \u2588\u2588\u2588\u2588\u2588\u2557 \u2588\u2588\u2557    \u2588\u2588\u2557',
  ' \u2588\u2588\u2551 \u2588\u2588\u2554\u255d\u2588\u2588\u2551 \u2588\u2588\u2554\u255d\u2588\u2588\u2554\u2550\u2550\u2550\u2550\u255d\u2588\u2588\u2551     \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2557\u2588\u2588\u2551    \u2588\u2588\u2551',
  ' \u2588\u2588\u2588\u2588\u2588\u2554\u255d \u2588\u2588\u2588\u2588\u2588\u2554\u255d \u2588\u2588\u2551     \u2588\u2588\u2551     \u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2551\u2588\u2588\u2551 \u2588\u2557 \u2588\u2588\u2551',
  ' \u2588\u2588\u2554\u2550\u2588\u2588\u2557 \u2588\u2588\u2554\u2550\u2588\u2588\u2557 \u2588\u2588\u2551     \u2588\u2588\u2551     \u2588\u2588\u2554\u2550\u2550\u2588\u2588\u2551\u2588\u2588\u2551\u2588\u2588\u2588\u2557\u2588\u2588\u2551',
  ' \u2588\u2588\u2551  \u2588\u2588\u2557\u2588\u2588\u2551  \u2588\u2588\u2557\u255a\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2557\u2588\u2588\u2551  \u2588\u2588\u2551\u255a\u2588\u2588\u2588\u2554\u2588\u2588\u2588\u2554\u255d',
  ' \u255a\u2550\u255d  \u255a\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d \u255a\u2550\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u255d\u255a\u2550\u255d  \u255a\u2550\u255d \u255a\u2550\u2550\u255d\u255a\u2550\u2550\u255d ',
];

function getSystemInfo(version) {
  const cpus = os.cpus();
  const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
  const platform = process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux';
  const arch = process.arch === 'x64' ? 'x86_64' : process.arch;
  return {
    platform: `${platform} ${arch}`,
    node: process.versions.node,
    electron: process.versions.electron,
    cpu: `${cpus[0]?.model?.trim() || 'Unknown'} (${cpus.length} cores)`,
    memory: `${totalMem} GB`,
    version: version || '3.1.2',
  };
}

function printSeparator() {
  const width = Math.min(process.stdout.columns || 60, 60);
  console.log(c.gray + '='.repeat(width) + c.reset);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** Render a full banner frame (logo + gap + title) as one string */
function renderFrame(logoLines, titleLines, colorFn) {
  let frame = '';
  for (let i = 0; i < logoLines.length; i++) {
    frame += '\x1b[2K\r' + colorFn(i, 'logo') + '  ' + logoLines[i] + c.reset + '\n';
  }
  frame += '\x1b[2K\r\n'; // gap line
  for (let i = 0; i < titleLines.length; i++) {
    frame += '\x1b[2K\r' + colorFn(i, 'title') + ' ' + titleLines[i] + c.reset + '\n';
  }
  return frame;
}

const TOTAL_LINES = LOGO_CLOSED.length + 1 + TITLE.length; // 15 + 1 + 6 = 22

/**
 * Print startup Hero Banner with animation:
 * 1. Closed-eyes lobster appears in dim gray
 * 2. White fire-sweep top to bottom (still closed eyes)
 * 3. Flash pulse — eyes open!
 * 4. Bounce (jump up 1 line then fall back)
 * 5. Settle — done
 */
async function printHero(version, animate = true) {
  const info = getSystemInfo(version);

  console.log('');

  if (animate) {
    // === Phase 1: Print closed-eye logo in dim gray ===
    const dimColor = () => c.dim + c.gray;
    process.stdout.write(renderFrame(LOGO_CLOSED, TITLE, dimColor));

    await sleep(400);

    // === Phase 2: Fire sweep (closed eyes, white band top-to-bottom) ===
    for (let front = -1; front <= TOTAL_LINES + 1; front++) {
      process.stdout.write('\x1b[' + TOTAL_LINES + 'A'); // cursor to top

      const sweepColor = (lineIdx, section) => {
        const globalIdx = section === 'logo' ? lineIdx : LOGO_CLOSED.length + 1 + lineIdx;
        if (globalIdx <= front - 2) return c.bRed + (section === 'title' ? c.bold : '');
        if (globalIdx === front - 1 || globalIdx === front) return c.bWhite + c.bold;
        return c.dim + c.gray;
      };

      process.stdout.write(renderFrame(LOGO_CLOSED, TITLE, sweepColor));

      const t = Math.max(0, Math.min(1, front / TOTAL_LINES));
      await sleep(Math.round(50 - 30 * Math.sin(t * Math.PI)));
    }

    // === Phase 3: Flash + OPEN EYES! ===
    await sleep(80);

    // Flash white (still closed)
    process.stdout.write('\x1b[' + TOTAL_LINES + 'A');
    process.stdout.write(renderFrame(LOGO_CLOSED, TITLE, () => c.bWhite + c.bold));
    await sleep(120);

    // Eyes open! Switch to LOGO_OPEN in final red
    process.stdout.write('\x1b[' + TOTAL_LINES + 'A');
    const finalColor = (_i, section) => c.bRed + (section === 'title' ? c.bold : '');
    process.stdout.write(renderFrame(LOGO_OPEN, TITLE, finalColor));
    await sleep(200);

    // === Phase 4: Bounce! (jump up 1 line, fall back) ===
    // Jump UP: insert blank line at bottom, shift everything up by 1
    process.stdout.write('\x1b[' + TOTAL_LINES + 'A');
    // Print with 1 less leading newline (effectively moves up)
    process.stdout.write('\x1b[1A\x1b[2K\r'); // clear the line above banner
    process.stdout.write(renderFrame(LOGO_OPEN, TITLE, finalColor));
    // The last line that was occupied is now empty — we're 1 line higher
    await sleep(100);

    // Fall back DOWN: restore original position
    process.stdout.write('\x1b[' + TOTAL_LINES + 'A');
    process.stdout.write('\n'); // push down by 1 (restore the blank line)
    process.stdout.write(renderFrame(LOGO_OPEN, TITLE, finalColor));
    await sleep(80);

  } else {
    // No animation: direct output with open eyes
    const finalColor = (_i, section) => c.bRed + (section === 'title' ? c.bold : '');
    process.stdout.write(renderFrame(LOGO_OPEN, TITLE, finalColor));
  }

  // Subtitle
  console.log('');
  console.log(c.gray + '  ' + c.reset + c.white + c.bold +
    ' Desktop Pet  x  OpenClaw Gateway  x  Live Console' + c.reset);
  console.log('');

  printSeparator();

  // System info panel
  const label = (l) => c.gray + '  ' + l.padEnd(12) + c.reset;
  const val = (v) => c.white + v + c.reset;
  const hi = (v) => c.bCyan + c.bold + v + c.reset;

  console.log(label('Version') + hi('v' + info.version));
  console.log(label('Electron') + val('v' + info.electron) +
    c.gray + '  |  ' + c.reset + label('Node') + val('v' + info.node));
  console.log(label('Platform') + val(info.platform));
  console.log(label('CPU') + val(info.cpu));
  console.log(label('Memory') + val(info.memory));

  printSeparator();

  console.log(c.yellow + '  >> ' + c.reset + 'Initializing modules...');
  console.log('');
}

/**
 * Print ready banner after Gateway connects
 */
function printReady(port = 18789) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  printSeparator();
  console.log('');
  console.log(c.bGreen + c.bold + '  [OK] KKClaw is ready!' + c.reset);
  console.log('');
  console.log(c.gray + '  Gateway   ' + c.reset + c.green + c.bold +
    'http://127.0.0.1:' + port + c.reset);
  console.log(c.gray + '  Started   ' + c.reset + c.white + time + c.reset);
  console.log(c.gray + '  Logs      ' + c.reset + c.dim +
    'Gateway output will appear below' + c.reset);
  console.log('');
  printSeparator();
  console.log('');
}

module.exports = { printHero, printReady };
