// 🦞 KKClaw 启动动画 — 终端 Hero Banner
// 灵感来自 Codex / Vercel CLI 的启动序列

const os = require('os');

// ANSI 颜色码
const c = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  red:     '\x1b[31m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  blue:    '\x1b[34m',
  magenta: '\x1b[35m',
  cyan:    '\x1b[36m',
  white:   '\x1b[37m',
  gray:    '\x1b[90m',
  bRed:    '\x1b[91m',
  bGreen:  '\x1b[92m',
  bYellow: '\x1b[93m',
  bMagenta:'\x1b[95m',
  bCyan:   '\x1b[96m',
};

// 行级渐变（每行一个颜色，从红→洋红→黄，龙虾色系）
const rowColors = [
  '\x1b[31m',   // 红
  '\x1b[91m',   // 亮红
  '\x1b[31m',   // 红
  '\x1b[91m',   // 亮红
  '\x1b[95m',   // 亮洋红
  '\x1b[91m',   // 亮红
];

// 简洁龙虾 ASCII Art — 线条风格，CMD 友好
const LOBSTER = [
  '          \\/\\/          \\/\\/',
  '          \\  \\        /  /',
  '           \\  \\      /  /',
  '      .-----\\  \\----/  /-----.',
  '     /  .----\\  \\--/  /----.  \\',
  '    /  /      \\        /    \\  \\',
  '   |  |   ()   \\    /   ()  |  |',
  '   |  |         \\  /        |  |',
  '    \\  \\        /  \\       /  /',
  '     \\  `------/ /\\ \\-----\'  /',
  '      \\  .----/ /  \\ \\----.  /',
  '       \\/     / /    \\ \\    \\/',
  '             / /      \\ \\',
  '            / /        \\ \\',
  '           `-\'          `-\'',
];

// KKCLAW 大字标题 — 简洁方块风格
const TITLE = [
  ' _  ___  _____ _        _ __        __',
  '| |/ / |/ / __| |   __ | |\\ \\      / /',
  '| \' /| \' / (__| |_ / _`| | \\ \\ /\\ / / ',
  '| . \\| . \\___| __| (_| | |  \\ V  V /  ',
  '|_|\\_\\_|\\_\\   |_|  \\__,_|_|   \\_/\\_/   ',
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
  console.log(c.gray + '-'.repeat(width) + c.reset);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * 打印启动 Hero Banner（带逐行动画）
 * @param {string} version - 版本号
 * @param {boolean} animate - 是否使用动画效果
 */
async function printHero(version, animate = true) {
  const delay = animate ? 20 : 0;
  const info = getSystemInfo(version);

  console.log('');

  // 打印龙虾 — 整行统一红色
  for (let i = 0; i < LOBSTER.length; i++) {
    const color = rowColors[i % rowColors.length];
    console.log(color + '  ' + LOBSTER[i] + c.reset);
    if (delay) await sleep(delay);
  }

  console.log('');

  // 打印大字标题 — 统一亮红色 + 粗体
  for (const line of TITLE) {
    console.log(c.bRed + c.bold + line + c.reset);
    if (delay) await sleep(delay);
  }

  // 副标题
  console.log('');
  console.log(c.gray + '  ' + c.reset + c.white + c.bold +
    'Desktop Pet  x  OpenClaw Gateway  x  Live Console' + c.reset);
  console.log('');

  printSeparator();

  // 系统信息面板
  const label = (l) => c.gray + '  ' + l.padEnd(12) + c.reset;
  const val = (v) => c.white + v + c.reset;
  const hi = (v) => c.bCyan + c.bold + v + c.reset;

  console.log(label('Version') + hi(`v${info.version}`));
  console.log(label('Electron') + val(`v${info.electron}`) + c.gray + '  |  ' + c.reset + label('Node') + val(`v${info.node}`));
  console.log(label('Platform') + val(info.platform));
  console.log(label('CPU') + val(info.cpu));
  console.log(label('Memory') + val(info.memory));

  printSeparator();

  // 状态行
  console.log(c.yellow + '  >> ' + c.reset + 'Initializing modules...');
  console.log('');
}

/**
 * 打印模块加载完成状态
 */
function printReady(port = 18789) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  printSeparator();
  console.log('');
  console.log(c.bGreen + c.bold + '  [OK] KKClaw is ready!' + c.reset);
  console.log('');
  console.log(c.gray + '  Gateway   ' + c.reset + c.green + c.bold + `http://127.0.0.1:${port}` + c.reset);
  console.log(c.gray + '  Started   ' + c.reset + c.white + time + c.reset);
  console.log(c.gray + '  Logs      ' + c.reset + c.dim + 'Gateway output will appear below' + c.reset);
  console.log('');
  printSeparator();
  console.log('');
}

module.exports = { printHero, printReady };
