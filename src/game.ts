import * as fs from 'fs';
import * as path from 'path';
import { createRequire } from 'module';
import type { Interpreter } from './interpreter';
import { RuntimeFunction, RuntimeValue, SesiRuntimeError } from './types';
import { bindNativeMethod, createNativeObject } from './native-object';

export const SESI_GAME_API_VERSION = 2;
export const SESI_GAME_VERSION = '2.0.1';

interface GameAddon {
  SESI_GAME_API_VERSION: number;
  VERSION?: string;
  createRuntime(context: GameHostContext): Record<string, RuntimeValue>;
  launchGameHost?(options: {
    entry: string;
    coreRoot: string;
    allowedRoots: string[];
    args?: string[];
    debug?: boolean;
    bytecodeBundle?: string;
  }): Promise<void>;
}

export interface GameHostContext {
  apiVersion: number;
  coreRoot: string;
  projectRoot: string;
  allowedRoots: string[];
  createNativeObject: typeof createNativeObject;
  bindMethod: typeof bindNativeMethod;
  error(type: string, message: string, data?: RuntimeValue): SesiRuntimeError;
  invokeCallback(fn: RuntimeFunction, args: RuntimeValue[], synchronous?: boolean): Promise<RuntimeValue>;
}

function addonInstallError(detail?: string): SesiRuntimeError {
  const suffix = detail ? ` (${detail})` : '';
  return new SesiRuntimeError(
    'GameAddonError',
    `std/game requires the optional @misterscan/sesi-game package${suffix}. Install it with: npm install @misterscan/sesi-game`,
  );
}

function isCorePackageRoot(candidate: string): boolean {
  const manifestPath = path.join(candidate, 'package.json');
  const entryPath = path.join(candidate, 'dist', 'index.js');
  if (!fs.existsSync(manifestPath) || !fs.existsSync(entryPath)) return false;
  try {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { name?: string };
    return manifest.name === '@misterscan/sesi';
  } catch {
    return false;
  }
}

function packageRootFor(resolvedEntry: string): string | undefined {
  let cursor = path.dirname(path.resolve(resolvedEntry));
  while (cursor !== path.dirname(cursor)) {
    if (isCorePackageRoot(cursor)) return cursor;
    cursor = path.dirname(cursor);
  }
  return undefined;
}

function findCorePackageAncestor(start: string): string | undefined {
  let cursor = path.resolve(start);
  if (fs.existsSync(cursor) && !fs.statSync(cursor).isDirectory()) cursor = path.dirname(cursor);
  while (cursor !== path.dirname(cursor)) {
    if (isCorePackageRoot(cursor)) return cursor;
    cursor = path.dirname(cursor);
  }
  return undefined;
}

/**
 * Resolve a real filesystem copy of the Sesi core for the Electron game host.
 * A pkg executable's __dirname points into its private snapshot, which child
 * processes such as Electron cannot read.
 */
export function resolveGameHostCoreRoot(
  projectRoot: string,
  bundledCoreRoot = path.resolve(__dirname, '..'),
  packaged = Boolean((process as any).pkg),
): string {
  const override = process.env.SESI_GAME_CORE_PATH;
  if (override) {
    const resolvedOverride = path.resolve(override);
    if (isCorePackageRoot(resolvedOverride)) return resolvedOverride;
    throw new SesiRuntimeError(
      'GameHostError',
      `SESI_GAME_CORE_PATH does not point to an installed @misterscan/sesi package: ${resolvedOverride}`,
    );
  }

  const projectManifest = path.join(projectRoot, 'package.json');
  const localRequire = createRequire(fs.existsSync(projectManifest) ? projectManifest : path.join(projectRoot, '__sesi_core__.js'));
  try {
    const installed = packageRootFor(localRequire.resolve('@misterscan/sesi'));
    if (installed) return installed;
  } catch {
    // A source checkout can provide the core directly instead of through node_modules.
  }

  const projectCheckout = findCorePackageAncestor(projectRoot);
  if (projectCheckout) return projectCheckout;
  const workingCheckout = findCorePackageAncestor(process.cwd());
  if (workingCheckout) return workingCheckout;

  const executableDirectory = path.dirname(process.execPath);
  for (const candidate of [
    executableDirectory,
    path.join(executableDirectory, 'runtime'),
    path.join(executableDirectory, 'node_modules', '@misterscan', 'sesi'),
  ]) {
    if (isCorePackageRoot(candidate)) return candidate;
  }

  if (!packaged && isCorePackageRoot(bundledCoreRoot)) return bundledCoreRoot;
  throw new SesiRuntimeError(
    'GameHostError',
    'The Electron game host needs a filesystem-installed Sesi core; the standalone executable snapshot cannot be loaded by Electron. Install @misterscan/sesi in this project or set SESI_GAME_CORE_PATH to its package directory.',
  );
}

function loadAddon(projectRoot: string): GameAddon {
  if (process.env.SESI_GAME_DISABLE_ADDON === '1') throw addonInstallError();
  const projectManifest = path.join(projectRoot, 'package.json');
  const localRequire = createRequire(fs.existsSync(projectManifest) ? projectManifest : path.join(projectRoot, '__sesi_game__.js'));
  let resolved: string | undefined;
  if (process.env.SESI_GAME_ADDON_PATH) {
    resolved = path.resolve(process.env.SESI_GAME_ADDON_PATH);
  } else try {
    // Keep the optional desktop runtime out of standalone Sesi executables.
    // pkg treats a literal require.resolve specifier as a bundled dependency.
    const addonPackageName = ['@misterscan', 'sesi-game'].join('/');
    resolved = localRequire.resolve(addonPackageName);
  } catch {
    const workspacePackage = path.resolve(__dirname, '..', 'packages', 'sesi-game');
    if (fs.existsSync(path.join(workspacePackage, 'package.json'))) resolved = workspacePackage;
  }
  if (!resolved) throw addonInstallError();

  let addon: GameAddon;
  try {
    addon = localRequire(resolved) as GameAddon;
  } catch (error: any) {
    throw addonInstallError(error?.message ?? 'could not load package');
  }
  if (addon.SESI_GAME_API_VERSION !== SESI_GAME_API_VERSION || typeof addon.createRuntime !== 'function') {
    throw addonInstallError(
      `incompatible API: core requires ${SESI_GAME_API_VERSION}, package provides ${String(addon.SESI_GAME_API_VERSION ?? 'unknown')}`,
    );
  }
  return addon;
}

export async function launchGameFileHost(options: {
  entry: string;
  allowedRoots: string[];
  args?: string[];
  debug?: boolean;
  bytecodeBundle?: string;
}): Promise<void> {
  const projectRoot = path.dirname(path.resolve(options.entry));
  const addon = loadAddon(projectRoot);
  if (typeof addon.launchGameHost !== 'function') {
    throw addonInstallError('package does not provide the Electron host launcher');
  }
  await addon.launchGameHost({
    ...options,
    coreRoot: resolveGameHostCoreRoot(projectRoot),
  });
}

export function sourceGraphUsesGame(entry: string): boolean {
  let usesGame = false;
  collectLiteralSesiModules(entry, specifier => {
    if (specifier === 'std/game') usesGame = true;
  });
  return usesGame;
}

function resolveLiteralSesiModule(fromFile: string, specifier: string): string | null {
  if (specifier.startsWith('std/')) return null;
  const bases = path.isAbsolute(specifier)
    ? [specifier]
    : [
        path.resolve(path.dirname(fromFile), specifier),
        path.resolve(process.cwd(), specifier),
        path.resolve(process.cwd(), 'sesi_modules', specifier),
      ];
  for (const base of bases) {
    const candidates = path.extname(base)
      ? [base]
      : [`${base}.sesi`, path.join(base, 'index.sesi')];
    const match = candidates.find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (match) return match;
  }
  return null;
}

export function collectLiteralSesiModules(
  entry: string,
  onSpecifier?: (specifier: string, fromFile: string) => void,
): string[] {
  const seen = new Set<string>();
  const files: string[] = [];
  const visit = (file: string): void => {
    const resolved = path.resolve(file);
    if (seen.has(resolved)) return;
    seen.add(resolved);
    files.push(resolved);
    const source = fs.readFileSync(resolved, 'utf8');
    const modulePattern = /(?:allow|import(?:\s+\{[^}]*\}\s+from)?)\s*["']([^"']+)["']/g;
    for (const match of source.matchAll(modulePattern)) {
      const specifier = match[1];
      onSpecifier?.(specifier, resolved);
      const child = resolveLiteralSesiModule(resolved, specifier);
      if (child) visit(child);
    }
  };
  visit(entry);
  return files;
}

function builtin(
  name: string,
  params: string[],
  call: (...args: RuntimeValue[]) => RuntimeValue | Promise<RuntimeValue>,
): RuntimeFunction {
  return bindNativeMethod(name, params, call);
}

function asBuiltinFunction(value: RuntimeValue | undefined, exportName: string): RuntimeFunction {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    (value as any).type !== 'function' ||
    typeof (value as RuntimeFunction).builtin !== 'function'
  ) {
    throw addonInstallError(`missing ${exportName} export`);
  }
  return value as RuntimeFunction;
}

export function createGameModule(interpreter: Interpreter): Map<string, RuntimeValue> {
  // Development-time filesystem builtins resolve relative paths from the
  // process working directory. Use that same root for game assets and builds
  // so a generated path can be registered without being rewritten when the
  // entry script lives in a subdirectory. Packaged games remain rooted at the
  // staged bytecode directory, independent of how the application is launched.
  const projectRoot = process.env.SESI_GAME_PACKAGED === '1'
    ? (interpreter.getScriptDirectory() ?? process.cwd())
    : process.cwd();
  let runtimeExports: Record<string, RuntimeValue> | undefined;

  const ensureRuntime = (): Record<string, RuntimeValue> => {
    if (interpreter.safeMode) {
      throw new SesiRuntimeError(
        'SecurityError',
        'std/game development runs and builds require local mode. Run the script with sesi -l.',
      );
    }
    if (!runtimeExports) {
      const addon = loadAddon(projectRoot);
      runtimeExports = addon.createRuntime({
        apiVersion: SESI_GAME_API_VERSION,
        coreRoot: path.resolve(__dirname, '..'),
        projectRoot,
        allowedRoots: interpreter.allowedPaths.map(root => path.resolve(root)),
        createNativeObject,
        bindMethod: bindNativeMethod,
        error: (type, message, data) => new SesiRuntimeError(type, message, data),
        invokeCallback: (fn, args, synchronous = false) => interpreter.invokeNativeCallback(fn, args, synchronous),
      });
    }
    return runtimeExports;
  };

  const exports = new Map<string, RuntimeValue>();
  exports.set('VERSION', SESI_GAME_VERSION);
  for (const [name, arity] of [['vec2', 2], ['vec3', 3], ['quat', 4], ['color', 4]] as const) {
    exports.set(name, builtin(name, Array.from({ length: arity }, (_, index) => `v${index}`), (...args) => {
      return asBuiltinFunction(ensureRuntime()[name], name).builtin!(...args);
    }));
  }
  exports.set('create', builtin('create', ['config'], (config = null) => {
    return asBuiltinFunction(ensureRuntime().create, 'create').builtin!(config);
  }));
  return exports;
}
