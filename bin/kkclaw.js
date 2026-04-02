#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const process = require('process');
const pkg = require('../package.json');
const { openTerminal } = require('../scripts/open-terminal');
const configManager = require('../utils/config-manager');
const openClawDetector = require('../utils/openclaw-detector');
const pathResolver = require('../utils/path-resolver');

function formatHelp() {
  return [
    `KKClaw ${pkg.version}`,
    '',
    'Usage:',
    '  kkclaw gateway',
    '  kkclaw gateway start',
    '  kkclaw gateway open',
    '  kkclaw gateway status [--json]',
    '  kkclaw gateway logs [--tail <n>] [--err]',
    '  kkclaw gateway stop',
    '  kkclaw gateway restart',
    '  kkclaw doctor [--json]',
    '  kkclaw status',
    '  kkclaw dashboard [openclaw-dashboard-args]',
    '  kkclaw console',
    '  kkclaw --version',
    '',
    'Commands:',
    '  gateway        Launch the animated KKClaw terminal (same experience as npm start)',
    '  doctor         Run a KKClaw-oriented health check',
    '  status         Alias for kkclaw gateway status',
    '  dashboard      Forward to openclaw dashboard',
    '  console        Alias for kkclaw gateway',
    '',
    'Examples:',
    '  kkclaw gateway',
    '  kkclaw gateway status',
    '  kkclaw gateway logs --tail 80',
    '  kkclaw doctor --json',
    '  kkclaw dashboard --no-open',
  ].join('\n');
}

function parseTailCount(args, fallback = 50) {
  const index = args.findIndex((arg) => arg === '--tail');
  if (index === -1) {
    return fallback;
  }
  const raw = args[index + 1];
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseArgs(argv) {
  const args = [...argv];
  const first = args[0];

  if (!first || first === 'help' || first === '--help' || first === '-h') {
    return { type: 'help' };
  }

  if (first === '--version' || first === '-v' || first === 'version') {
    return { type: 'version' };
  }

  if (first === 'console') {
    return { type: 'gateway-start' };
  }

  if (first === 'status') {
    return { type: 'gateway-status', json: args.includes('--json') };
  }

  if (first === 'doctor') {
    return { type: 'doctor', json: args.includes('--json') };
  }

  if (first === 'dashboard') {
    return { type: 'dashboard', args: args.slice(1) };
  }

  if (first === 'gateway') {
    const sub = args[1];
    if (!sub || sub === 'start') {
      return { type: 'gateway-start' };
    }
    if (sub === 'open') {
      return { type: 'gateway-open' };
    }
    if (sub === 'status') {
      return { type: 'gateway-status', json: args.includes('--json') };
    }
    if (sub === 'logs') {
      return {
        type: 'gateway-logs',
        err: args.includes('--err'),
        json: args.includes('--json'),
        tail: parseTailCount(args.slice(2)),
      };
    }
    if (sub === 'stop') {
      return { type: 'gateway-stop' };
    }
    if (sub === 'restart') {
      return { type: 'gateway-restart' };
    }
    if (sub === '--help' || sub === '-h' || sub === 'help') {
      return { type: 'help' };
    }
    return { type: 'help', error: `Unknown gateway subcommand: ${sub}` };
  }

  return { type: 'help', error: `Unknown command: ${first}` };
}

function getGatewayConfig() {
  const config = configManager.getConfig() || {};
  const parsedPort = Number.parseInt(config.gateway?.port, 10);
  const configDir = pathResolver.getOpenClawConfigDir
    ? pathResolver.getOpenClawConfigDir()
    : path.dirname(pathResolver.getOpenClawConfigPath());
  const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 18789;
  return {
    port,
    host: `http://127.0.0.1:${port}`,
    dashboardUrl: `http://127.0.0.1:${port}/dashboard`,
    configPath: pathResolver.getOpenClawConfigPath(),
    logs: {
      out: path.join(configDir, 'logs', 'gateway.log'),
      err: path.join(configDir, 'logs', 'gateway.err.log'),
    },
  };
}

async function checkGatewayHttp(host) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch(host, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return {
      ok: true,
      status: response.status,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function listPortListeners(port) {
  try {
    if (process.platform === 'win32') {
      const output = execSync(`netstat -ano -p tcp | findstr LISTENING | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
      if (!output) {
        return [];
      }
      const listeners = output
        .split(/\r?\n/)
        .map((line) => line.trim().split(/\s+/))
        .filter((parts) => parts.length >= 5)
        .map((parts) => ({
          pid: Number(parts[parts.length - 1]),
          address: parts[1],
          command: 'unknown',
        }))
        .filter((entry) => Number.isInteger(entry.pid));
      return dedupeListeners(listeners);
    }

    const output = execSync(`lsof -Pan -iTCP:${port} -sTCP:LISTEN`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (!output) {
      return [];
    }

    const listeners = output
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim().split(/\s+/))
      .filter((parts) => parts.length >= 9)
      .map((parts) => ({
        command: parts[0],
        pid: Number(parts[1]),
        address: parts[8],
      }))
      .filter((entry) => Number.isInteger(entry.pid));
    return dedupeListeners(listeners);
  } catch {
    return [];
  }
}

function dedupeListeners(listeners) {
  return [...new Map(listeners.map((entry) => [`${entry.command}:${entry.pid}`, entry])).values()];
}

function isKkclawProcessCommand(command) {
  return (
    command.includes('/node_modules/.bin/electron .') ||
    command.includes('/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron .') ||
    command.includes('KKClaw Desktop Pet') ||
    (command.includes('Electron Helper') && command.includes('openclaw-kkclaw'))
  );
}

function listKkclawProcesses() {
  if (process.platform === 'win32') {
    return [];
  }

  try {
    const output = execSync('ps -Ao pid=,command=', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });

    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(\d+)\s+(.*)$/);
        if (!match) {
          return null;
        }
        return {
          pid: Number(match[1]),
          command: match[2],
        };
      })
      .filter((entry) => entry && Number.isInteger(entry.pid))
      .filter((entry) => {
        if (entry.pid === process.pid) {
          return false;
        }
        return isKkclawProcessCommand(entry.command);
      });
  } catch {
    return [];
  }
}

async function gatherStatus() {
  const gateway = getGatewayConfig();
  const [openclaw, gatewayHttp] = await Promise.all([
    openClawDetector.detect(),
    checkGatewayHttp(gateway.host),
  ]);

  const listeners = listPortListeners(gateway.port);
  const kkclawProcesses = listKkclawProcesses();
  const primaryKkclawPid = kkclawProcesses[0]?.pid ?? null;
  const managedByKkclaw =
    listeners.length === 0
      ? null
      : listeners.some((listener) => kkclawProcesses.some((entry) => entry.pid === listener.pid));

  return {
    ok: Boolean(openclaw.installed),
    version: pkg.version,
    projectRoot: pathResolver.getProjectRoot(),
    openclaw,
    gateway: {
      ...gateway,
      http: gatewayHttp,
      listeners,
      managedByKkclaw,
    },
    kkclaw: {
      running: kkclawProcesses.length > 0,
      processes: kkclawProcesses,
      primaryPid: primaryKkclawPid,
    },
  };
}

function printStatus(status) {
  const openclawLine = status.openclaw.installed
    ? `${status.openclaw.version || 'installed'}${status.openclaw.cliPath ? ` (${status.openclaw.cliPath})` : ''}`
    : 'missing';
  const gatewayLine = status.gateway.http.ok
    ? `reachable (${status.gateway.http.status})`
    : `unreachable (${status.gateway.http.error})`;
  const listenerLine = status.gateway.listeners.length > 0
    ? status.gateway.listeners.map((entry) => `${entry.command || 'pid'}:${entry.pid}`).join(', ')
    : 'none';
  const processLine = status.kkclaw.running
    ? summarizeProcessList(status.kkclaw.processes)
    : 'none';

  console.log('KKClaw Gateway Status');
  console.log(`- KKClaw: ${status.version}`);
  console.log(`- Project: ${status.projectRoot}`);
  console.log(`- OpenClaw CLI: ${openclawLine}`);
  console.log(`- Gateway host: ${status.gateway.host}`);
  console.log(`- Gateway http: ${gatewayLine}`);
  console.log(`- Listeners: ${listenerLine}`);
  console.log(`- Dashboard: ${status.gateway.dashboardUrl}`);
  console.log(`- Logs: ${status.gateway.logs.out}`);
  console.log(`- KKClaw processes: ${processLine}`);
  if (status.gateway.managedByKkclaw === false) {
    console.log('- Warning: the gateway port is active, but the listener does not look like a KKClaw-managed process.');
  } else if (status.gateway.managedByKkclaw === null) {
    console.log('- Warning: no gateway listener is active on the configured port.');
  }
}

function summarizeProcessList(processes) {
  if (!processes.length) {
    return 'none';
  }

  const primary = processes.filter((entry) => {
    return (
      entry.command.includes('/Electron.app/Contents/MacOS/Electron .') ||
      entry.command.includes('/node_modules/.bin/electron .') ||
      entry.command.includes('KKClaw Desktop Pet')
    );
  });

  const selected = primary.length > 0 ? primary : processes;
  const summary = selected.map((entry) => entry.pid).join(', ');
  const helperCount = processes.length - selected.length;
  return helperCount > 0 ? `${summary} (+${helperCount} helpers)` : summary;
}

function printDoctor(status) {
  const checks = [
    {
      name: 'OpenClaw CLI',
      ok: Boolean(status.openclaw.installed),
      detail: status.openclaw.installed
        ? `${status.openclaw.version || 'installed'}${status.openclaw.cliPath ? ` @ ${status.openclaw.cliPath}` : ''}`
        : 'not found',
    },
    {
      name: 'OpenClaw config',
      ok: Boolean(status.openclaw.configFile?.exists),
      detail: status.openclaw.configFile?.path || status.gateway.configPath,
    },
    {
      name: 'Gateway endpoint',
      ok: Boolean(status.gateway.http.ok),
      detail: status.gateway.http.ok
        ? `${status.gateway.host} (${status.gateway.http.status})`
        : `${status.gateway.host} (${status.gateway.http.error})`,
    },
    {
      name: 'Gateway ownership',
      ok: status.gateway.managedByKkclaw !== false,
      detail: status.gateway.managedByKkclaw === null
        ? 'no active listener on the configured gateway port'
        : status.gateway.managedByKkclaw
        ? 'listener matches the running KKClaw app'
        : 'port is occupied by a process outside the current KKClaw runtime',
    },
    {
      name: 'Dashboard URL',
      ok: true,
      detail: status.gateway.dashboardUrl,
    },
    {
      name: 'KKClaw runtime',
      ok: Boolean(status.kkclaw.running),
      detail: status.kkclaw.running
        ? `running (${summarizeProcessList(status.kkclaw.processes)})`
        : 'not running',
    },
  ];

  console.log('KKClaw Doctor');
  for (const check of checks) {
    console.log(`- ${check.ok ? 'OK' : 'FAIL'} ${check.name}: ${check.detail}`);
  }

  if (!status.gateway.http.ok) {
    console.log('- Hint: run `kkclaw gateway` to launch the animated KKClaw console.');
  }
  if (status.gateway.managedByKkclaw === false) {
    console.log('- Hint: another process owns the gateway port. Use `kkclaw gateway stop` before relaunching KKClaw.');
  } else if (status.gateway.managedByKkclaw === null) {
    console.log('- Hint: no gateway listener is active yet. Launch the animated console or start OpenClaw separately.');
  }
}

function readLogFile(logPath, tail = 50) {
  try {
    const content = require('fs').readFileSync(logPath, 'utf8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    return {
      ok: true,
      path: logPath,
      lines: lines.slice(-tail),
    };
  } catch (error) {
    return {
      ok: false,
      path: logPath,
      error: error instanceof Error ? error.message : String(error),
      lines: [],
    };
  }
}

function waitForChild(child) {
  return new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code) => resolve(code ?? 0));
  });
}

async function runOpenClawCommand(args) {
  const invocation = require('../utils/openclaw-path-resolver').resolveOpenClawInvocation(args);
  if (!invocation) {
    throw new Error('OpenClaw CLI not found');
  }
  const child = require('child_process').spawn(invocation.command, invocation.args, {
    cwd: invocation.cwd,
    stdio: 'inherit',
    shell: invocation.shell ?? process.platform === 'win32',
  });
  return waitForChild(child);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killPid(pid) {
  if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) {
    return false;
  }

  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /PID ${pid} /F /T`, {
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      return true;
    }

    process.kill(pid, 'SIGTERM');
    return true;
  } catch {
    return false;
  }
}

async function stopGatewayProcesses() {
  const initialStatus = await gatherStatus();

  if (initialStatus.gateway.http.ok || initialStatus.gateway.listeners.length > 0) {
    try {
      const stopCode = await runOpenClawCommand(['gateway', 'stop']);
      if (stopCode === 0) {
        console.log('Requested installed OpenClaw gateway stop.');
      }
    } catch (error) {
      console.warn(`OpenClaw gateway stop failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    await sleep(1000);
  }

  const status = await gatherStatus();
  const pids = new Set();

  for (const processInfo of status.kkclaw.processes) {
    if (isKkclawProcessCommand(processInfo.command)) {
      pids.add(processInfo.pid);
    }
  }
  for (const listener of status.gateway.listeners) {
    pids.add(listener.pid);
  }

  if (pids.size === 0 && !status.gateway.http.ok) {
    console.log('KKClaw gateway is not running.');
    return 0;
  }

  for (const pid of pids) {
    killPid(pid);
  }

  await sleep(1000);

  const remaining = await gatherStatus();
  if (remaining.kkclaw.running || remaining.gateway.listeners.length > 0) {
    for (const processInfo of remaining.kkclaw.processes) {
      try {
        process.kill(processInfo.pid, 'SIGKILL');
      } catch (_) {}
    }
    for (const listener of remaining.gateway.listeners) {
      try {
        process.kill(listener.pid, 'SIGKILL');
      } catch (_) {}
    }
    await sleep(500);
  }

  const finalStatus = await gatherStatus();
  if (finalStatus.gateway.http.ok || finalStatus.gateway.listeners.length > 0) {
    console.error('Failed to stop all gateway listeners.');
    return 1;
  }

  console.log('Stopped KKClaw gateway processes.');
  return 0;
}

async function run(command) {
  if (command.error) {
    console.error(command.error);
    console.error('');
  }

  switch (command.type) {
    case 'help':
      console.log(formatHelp());
      return command.error ? 1 : 0;
    case 'version':
      console.log(`KKClaw ${pkg.version}`);
      return 0;
    case 'gateway-start':
      console.log('Launching KKClaw animated console...');
      await openTerminal();
      return 0;
    case 'gateway-open':
      return runOpenClawCommand(['dashboard']);
    case 'gateway-status': {
      const status = await gatherStatus();
      if (command.json) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        printStatus(status);
      }
      return status.openclaw.installed ? 0 : 1;
    }
    case 'gateway-logs': {
      const status = await gatherStatus();
      const targetPath = command.err ? status.gateway.logs.err : status.gateway.logs.out;
      const result = readLogFile(targetPath, command.tail);
      if (command.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.ok) {
        console.log(`Showing last ${result.lines.length} lines from ${targetPath}`);
        for (const line of result.lines) {
          console.log(line);
        }
      } else {
        console.error(`Failed to read ${targetPath}: ${result.error}`);
        return 1;
      }
      return 0;
    }
    case 'gateway-stop':
      return stopGatewayProcesses();
    case 'gateway-restart': {
      const stopCode = await stopGatewayProcesses();
      if (stopCode !== 0) {
        return stopCode;
      }
      console.log('Restarting KKClaw animated console...');
      await openTerminal();
      return 0;
    }
    case 'doctor': {
      const status = await gatherStatus();
      if (command.json) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        printDoctor(status);
      }
      return status.openclaw.installed ? 0 : 1;
    }
    case 'dashboard':
      return runOpenClawCommand(['dashboard', ...command.args]);
    default:
      console.log(formatHelp());
      return 1;
  }
}

module.exports = {
  formatHelp,
  gatherStatus,
  parseArgs,
  run,
};

if (require.main === module) {
  run(parseArgs(process.argv.slice(2)))
    .then((code) => {
      process.exit(code);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exit(1);
    });
}
