#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const process = require('process');
const pkg = require('../package.json');
const { openTerminal } = require('../scripts/open-terminal');
const openClawDetector = require('../utils/openclaw-detector');
const backendCompat = require('../utils/backend-compat');
const pathResolver = require('../utils/path-resolver');

function formatHelp() {
  return [
    `Petclaw ${pkg.version}`,
    '',
    'Usage:',
    '  petclaw gateway',
    '  petclaw gateway start',
    '  petclaw gateway open',
    '  petclaw gateway status [--json]',
    '  petclaw gateway logs [--tail <n>] [--err]',
    '  petclaw gateway stop',
    '  petclaw gateway restart',
    '  petclaw doctor [--json]',
    '  petclaw status',
    '  petclaw dashboard [backend-dashboard-args]',
    '  petclaw console',
    '  petclaw --version',
    '',
    'Commands:',
    '  gateway        Launch the animated Petclaw terminal and choose a compatible backend (OpenClaw/Hermes/Auto)',
    '  doctor         Run a Petclaw-oriented health check',
    '  status         Alias for petclaw gateway status',
    '  dashboard      Open the active backend dashboard or API endpoint',
    '  console        Alias for petclaw gateway',
    '',
    'Examples:',
    '  petclaw gateway',
    '  petclaw gateway status',
    '  petclaw gateway logs --tail 80',
    '  petclaw doctor --json',
    '  petclaw dashboard --no-open',
    '',
    'Compatibility:',
    '  Set PETCLAW_COMPAT_MODE=hermes to drive Hermes as the active compatible backend.',
    '  You can set {"compatMode":"openclaw|hermes|auto"} in pet-config.json.',
    '  The terminal launcher also remembers your last selected backend.',
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
  const compat = backendCompat.resolve();
  const active = compat.active;
  const configDir = active.configDir
    || (pathResolver.getOpenClawConfigDir
      ? pathResolver.getOpenClawConfigDir()
      : path.dirname(pathResolver.getOpenClawConfigPath()));
  const parsedPort = Number.parseInt(active.apiHost?.split(':').pop(), 10);
  const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 18789;
  return {
    backend: active.mode,
    backendLabel: active.label,
    port,
    host: active.apiHost || `http://127.0.0.1:${port}`,
    dashboardUrl: active.mode === 'hermes'
      ? active.apiHost || `http://127.0.0.1:${port}`
      : `http://127.0.0.1:${port}/dashboard`,
    configPath: active.configPath || pathResolver.getOpenClawConfigPath(),
    logs: active.logPaths || {
      out: path.join(configDir, 'logs', 'gateway.log'),
      err: path.join(configDir, 'logs', 'gateway.err.log'),
    },
  };
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

function isPetclawProcessCommand(command) {
  return (
    command.includes('/node_modules/.bin/electron .') ||
    command.includes('/node_modules/electron/dist/Electron.app/Contents/MacOS/Electron .') ||
    command.includes('Petclaw Desktop Pet') ||
    (command.includes('Electron Helper') && command.includes('openclaw-petclaw'))
  );
}

function listPetclawProcesses() {
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
        return isPetclawProcessCommand(entry.command);
      });
  } catch {
    return [];
  }
}

async function gatherStatus() {
  const gateway = getGatewayConfig();
  const compat = backendCompat.resolve();
  const [openclaw, gatewayHttp] = await Promise.all([
    openClawDetector.detect(),
    backendCompat.probeGateway(),
  ]);

  const listeners = listPortListeners(gateway.port);
  const petclawProcesses = listPetclawProcesses();
  const primaryPetclawPid = petclawProcesses[0]?.pid ?? null;
  const managedByPetclaw =
    listeners.length === 0
      ? null
      : listeners.some((listener) => petclawProcesses.some((entry) => entry.pid === listener.pid));
  const externalHermesService =
    compat.active.mode === 'hermes'
      && Boolean(gatewayHttp.ok)
      && listeners.length > 0
      && managedByPetclaw === false;

  return {
    ok: Boolean(compat.active.installed),
    version: pkg.version,
    projectRoot: pathResolver.getProjectRoot(),
    backend: {
      mode: compat.active.mode,
      label: compat.active.label,
      preference: compat.preference.mode,
      preferenceSource: compat.preference.source,
      installed: compat.active.installed,
      cliPath: compat.active.cliPath,
      configPath: compat.active.configPath,
      configExists: Boolean(compat.active.configPath && fs.existsSync(compat.active.configPath)),
      apiServerEnabled: compat.active.mode === 'hermes' ? compat.active.apiServerEnabled : true,
      apiServerRequired: compat.active.mode === 'hermes',
    },
    openclaw,
    gateway: {
      ...gateway,
      http: gatewayHttp,
      listeners,
      managedByPetclaw,
      externalHermesService,
    },
    petclaw: {
      running: petclawProcesses.length > 0,
      processes: petclawProcesses,
      primaryPid: primaryPetclawPid,
    },
  };
}

function printStatus(status) {
  const backendLine = `${status.backend.label} (${status.backend.mode})`;
  const openclawLine = status.openclaw.installed
    ? `${status.openclaw.version || 'installed'}${status.openclaw.cliPath ? ` (${status.openclaw.cliPath})` : ''}`
    : 'missing';
  const gatewayProbeLine = status.gateway.http.ok
    ? status.gateway.http.source === 'http'
      ? `reachable over HTTP (${status.gateway.http.status})`
      : `running (${status.gateway.http.detail || status.gateway.http.source || 'probe ok'})`
    : `${status.gateway.http.source || 'probe'} failed (${status.gateway.http.error})`;
  const listenerLine = status.gateway.listeners.length > 0
    ? status.gateway.listeners.map((entry) => `${entry.command || 'pid'}:${entry.pid}`).join(', ')
    : 'none';
  const processLine = status.petclaw.running
    ? summarizeProcessList(status.petclaw.processes)
    : 'none';

  console.log('Petclaw Gateway Status');
  console.log(`- Petclaw: ${status.version}`);
  console.log(`- Project: ${status.projectRoot}`);
  console.log(`- Compat backend: ${backendLine}`);
  console.log(`- Active CLI: ${status.backend.cliPath || 'missing'}`);
  console.log(`- ${status.backend.mode === 'hermes' ? 'Companion compatibility CLI (OpenClaw)' : 'Compatibility CLI (OpenClaw)'}: ${openclawLine}`);
  console.log(`- Gateway host: ${status.gateway.host}`);
  console.log(`- Gateway probe: ${gatewayProbeLine}`);
  console.log(`- Listeners: ${listenerLine}`);
  console.log(`- Dashboard: ${status.gateway.dashboardUrl}`);
  console.log(`- Logs: ${status.gateway.logs.out}`);
  console.log(`- Petclaw processes: ${processLine}`);
  if (status.backend.mode === 'hermes' && !status.backend.apiServerEnabled) {
    console.log('- Warning: Hermes gateway is available, but the chat API server is disabled. Enable `API_SERVER_ENABLED=true` for full Petclaw chat compatibility.');
  }
  if (status.gateway.externalHermesService) {
    console.log('- Info: Hermes gateway is already running as an external service and Petclaw will reuse it.');
  } else if (status.gateway.managedByPetclaw === false) {
    console.log('- Warning: the gateway port is active, but the listener does not look like a Petclaw-managed process.');
  } else if (status.gateway.managedByPetclaw === null) {
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
      entry.command.includes('Petclaw Desktop Pet')
    );
  });

  const selected = primary.length > 0 ? primary : processes;
  const summary = selected.map((entry) => entry.pid).join(', ');
  const helperCount = processes.length - selected.length;
  return helperCount > 0 ? `${summary} (+${helperCount} helpers)` : summary;
}

function printDoctor(status) {
  const gatewayProbeDetail = status.gateway.http.ok
    ? status.gateway.http.source === 'http'
      ? `${status.gateway.host} (${status.gateway.http.status})`
      : `${status.gateway.host} (${status.gateway.http.detail || status.gateway.http.source || 'probe ok'})`
    : `${status.gateway.host} (${status.gateway.http.error})`;
  const backendCliDetail = status.backend.installed
    ? `${status.backend.cliPath || 'detected'}${status.backend.mode === 'openclaw' && status.openclaw.version ? ` @ ${status.openclaw.version}` : ''}`
    : 'not found';
  const checks = [
    {
      name: 'Compatibility backend',
      ok: Boolean(status.backend.installed),
      detail: `${status.backend.label} (${status.backend.mode}) via ${status.backend.preferenceSource}:${status.backend.preference}`,
    },
    {
      name: `${status.backend.label} CLI`,
      ok: Boolean(status.backend.installed),
      detail: backendCliDetail,
    },
    {
      name: `${status.backend.label} config`,
      ok: Boolean(status.backend.configExists),
      detail: status.backend.configPath || 'not found',
    },
    {
      name: 'Gateway endpoint',
      ok: Boolean(status.gateway.http.ok),
      detail: gatewayProbeDetail,
    },
    {
      name: 'Hermes API server',
      ok: !status.backend.apiServerRequired || Boolean(status.backend.apiServerEnabled),
      detail: status.backend.apiServerRequired
        ? status.backend.apiServerEnabled
          ? 'enabled for Petclaw chat requests'
          : 'disabled; set API_SERVER_ENABLED=true to expose /v1/chat/completions'
        : 'not required for OpenClaw mode',
    },
    {
      name: 'Gateway ownership',
      ok: status.gateway.externalHermesService || status.gateway.managedByPetclaw !== false,
      detail: status.gateway.externalHermesService
        ? 'Hermes gateway is already running as an external service and can be reused'
        : status.gateway.managedByPetclaw === null
        ? 'no active listener on the configured gateway port'
        : status.gateway.managedByPetclaw
        ? 'listener matches the running Petclaw app'
        : 'port is occupied by a process outside the current Petclaw runtime',
    },
    {
      name: 'Dashboard URL',
      ok: true,
      detail: status.gateway.dashboardUrl,
    },
    {
      name: 'Petclaw runtime',
      ok: Boolean(status.petclaw.running),
      detail: status.petclaw.running
        ? `running (${summarizeProcessList(status.petclaw.processes)})`
        : 'not running',
    },
  ];

  console.log('Petclaw Doctor');
  for (const check of checks) {
    console.log(`- ${check.ok ? 'OK' : 'FAIL'} ${check.name}: ${check.detail}`);
  }

  if (!status.gateway.http.ok) {
    console.log('- Hint: run `petclaw gateway` to launch the animated Petclaw console.');
  }
  if (status.backend.mode === 'hermes' && !status.backend.apiServerEnabled) {
    console.log('- Hint: Hermes compat mode needs `API_SERVER_ENABLED=true` before Petclaw can send chat requests through `/v1/chat/completions`.');
  }
  if (status.gateway.externalHermesService) {
    console.log('- Hint: Hermes service reuse is active; Petclaw does not need to relaunch the gateway.');
  } else if (status.gateway.managedByPetclaw === false) {
    console.log('- Hint: another process owns the gateway port. Use `petclaw gateway stop` before relaunching Petclaw.');
  } else if (status.gateway.managedByPetclaw === null) {
    console.log(`- Hint: no gateway listener is active yet. Launch the animated console or start ${status.backend.label} separately.`);
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
  const invocation = backendCompat.resolve().active.invocation(args);
  if (!invocation) {
    throw new Error('Compatible backend CLI not found');
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

function openUrlInBrowser(url) {
  if (!url) {
    return false;
  }

  try {
    if (process.platform === 'darwin') {
      execSync(`open ${JSON.stringify(url)}`, { stdio: 'ignore' });
    } else if (process.platform === 'win32') {
      execSync(`start "" ${JSON.stringify(url)}`, { stdio: 'ignore', shell: true });
    } else {
      execSync(`xdg-open ${JSON.stringify(url)}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
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
  const shouldPreserveExternalHermes =
    initialStatus.backend.mode === 'hermes'
    && initialStatus.gateway.managedByPetclaw === false;

  if (!shouldPreserveExternalHermes && (initialStatus.gateway.http.ok || initialStatus.gateway.listeners.length > 0 || initialStatus.backend.mode === 'hermes')) {
    try {
      const stopCode = await runOpenClawCommand(['gateway', 'stop']);
      if (stopCode === 0) {
        console.log(`Requested installed ${initialStatus.backend.label} gateway stop.`);
      }
    } catch (error) {
      console.warn(`${initialStatus.backend.label} gateway stop failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    await sleep(1000);
  }

  const status = await gatherStatus();
  const pids = new Set();

  for (const processInfo of status.petclaw.processes) {
    if (isPetclawProcessCommand(processInfo.command)) {
      pids.add(processInfo.pid);
    }
  }
  const preserveExternalHermesAfterStop =
    status.backend.mode === 'hermes'
    && status.gateway.managedByPetclaw === false;

  if (!preserveExternalHermesAfterStop) {
    for (const listener of status.gateway.listeners) {
      pids.add(listener.pid);
    }
  }

  if (pids.size === 0 && preserveExternalHermesAfterStop) {
    console.log('Hermes gateway is running separately; Petclaw left the external service untouched.');
    return 0;
  }

  if (pids.size === 0 && !status.gateway.http.ok) {
    console.log('Petclaw gateway is not running.');
    return 0;
  }

  for (const pid of pids) {
    killPid(pid);
  }

  await sleep(1000);

  const remaining = await gatherStatus();
  const preserveRemainingExternalHermes =
    remaining.backend.mode === 'hermes'
    && remaining.gateway.managedByPetclaw === false;
  if (remaining.petclaw.running || (!preserveRemainingExternalHermes && remaining.gateway.listeners.length > 0)) {
    for (const processInfo of remaining.petclaw.processes) {
      try {
        process.kill(processInfo.pid, 'SIGKILL');
      } catch (_) {}
    }
    if (!preserveRemainingExternalHermes) {
      for (const listener of remaining.gateway.listeners) {
        try {
          process.kill(listener.pid, 'SIGKILL');
        } catch (_) {}
      }
    }
    await sleep(500);
  }

  const finalStatus = await gatherStatus();
  const preserveFinalExternalHermes =
    finalStatus.backend.mode === 'hermes'
    && finalStatus.gateway.managedByPetclaw === false;
  if (preserveFinalExternalHermes && !finalStatus.petclaw.running) {
    console.log('Stopped Petclaw processes and left the external Hermes gateway running.');
    return 0;
  }
  if (finalStatus.gateway.http.ok || finalStatus.gateway.listeners.length > 0) {
    console.error('Failed to stop all gateway listeners.');
    return 1;
  }

  console.log('Stopped Petclaw gateway processes.');
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
      console.log(`Petclaw ${pkg.version}`);
      return 0;
    case 'gateway-start':
      console.log('Launching Petclaw animated console...');
      await openTerminal();
      return 0;
    case 'gateway-open': {
      const compat = backendCompat.resolve();
      if (compat.active.mode === 'hermes') {
        const url = compat.active.apiHost || null;
        if (openUrlInBrowser(url)) {
          console.log(`Opened ${compat.active.label} endpoint: ${url}`);
          return 0;
        }
        console.log(url || 'No Hermes API endpoint configured.');
        return url ? 0 : 1;
      }
      return runOpenClawCommand(['dashboard']);
    }
    case 'gateway-status': {
      const status = await gatherStatus();
      if (command.json) {
        console.log(JSON.stringify(status, null, 2));
      } else {
        printStatus(status);
      }
      return status.backend.installed ? 0 : 1;
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
      console.log('Restarting Petclaw animated console...');
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
      return status.backend.installed ? 0 : 1;
    }
    case 'dashboard': {
      const compat = backendCompat.resolve();
      if (compat.active.mode === 'hermes') {
        const url = compat.active.apiHost || null;
        if (openUrlInBrowser(url)) {
          console.log(`Opened ${compat.active.label} endpoint: ${url}`);
          return 0;
        }
        console.log(url || 'No Hermes API endpoint configured.');
        return url ? 0 : 1;
      }
      return runOpenClawCommand(['dashboard', ...command.args]);
    }
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
