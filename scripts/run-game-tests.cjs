'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-game-test-')));
const environment = {
  ...process.env, TMPDIR: root, TMP: root, TEMP: root,
  TSX_DISABLE_CACHE: '1', SESI_GAME_TEST_ROOT: root,
  SESI_GAME_USER_DATA: path.join(root, 'electron-profile'),
  ELECTRON_CACHE: path.join(root, 'electron-downloads'),
  XDG_CACHE_HOME: path.join(root, 'cache'),
  npm_config_cache: path.join(root, 'npm-cache'),
};
let child;
let interrupted = false;
let interruptionTimer;
function signalChild(signal) {
  if (!child?.pid) return;
  try { process.kill(process.platform === 'win32' ? child.pid : -child.pid, signal); }
  catch (error) { if (error.code !== 'ESRCH') throw error; }
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => {
  interrupted = true;
  signalChild('SIGTERM');
  interruptionTimer ||= setTimeout(() => signalChild('SIGKILL'), 3000);
});

async function reapGroup() {
  signalChild('SIGKILL');
  if (process.platform === 'win32' || !child?.pid) return;
  const deadline = Date.now() + 5000;
  while (true) {
    try { process.kill(-child.pid, 0); }
    catch (error) { if (error.code === 'ESRCH') return; throw error; }
    if (Date.now() >= deadline) throw new Error(`Owned process group ${child.pid} did not exit.`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

async function run(command, args) {
  if (interrupted) throw new Error('Test run interrupted.');
  let timedOut = false;
  child = spawn(command, args, {
    cwd: process.cwd(), env: environment, stdio: 'inherit', detached: process.platform !== 'win32',
  });
  const timer = setTimeout(() => { timedOut = true; signalChild('SIGTERM'); }, Number(process.env.SESI_GAME_TEST_TIMEOUT_MS) || 240000);
  const killTimer = setTimeout(() => signalChild('SIGKILL'), (Number(process.env.SESI_GAME_TEST_TIMEOUT_MS) || 240000) + 3000);
  try {
    const result = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', (code, signal) => resolve({ code, signal }));
    });
    if (interrupted || timedOut || result.code !== 0) throw new Error(`Test command failed (${interrupted ? 'interrupted' : timedOut ? 'timeout' : result.code ?? result.signal}): ${command} ${args.join(' ')}`);
  } finally {
    clearTimeout(timer);
    clearTimeout(killTimer);
    clearTimeout(interruptionTimer);
    await reapGroup();
    child = null;
  }
}

(async () => {
  try {
    const args = process.argv.slice(2);
    if (args[0] === '--') await run(args[1], args.slice(2));
    else for (const file of args.length ? args : ['tests/game.test.ts', 'tests/std-game-runtime.test.ts', 'tests/std-game-expanded.test.ts', 'tests/std-game-input.test.ts', 'tests/game-backend.test.ts']) {
      await run(process.execPath, ['--import', 'tsx', file]);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  } finally {
    await reapGroup();
    await fs.promises.rm(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
    if (fs.existsSync(root)) throw new Error(`Test cleanup failed: ${root}`);
    console.log('✓ Test processes reaped; temporary root removed');
  }
})();
