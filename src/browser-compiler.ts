import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { transformSync } from 'esbuild';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { Compiler } from './compiler';
import { SesiJavaScriptEmitter } from './js-emitter';
import { browserJsRuntime } from './browser-js-runtime';
import { browserLaunchPage, browserServiceWorker, collectBrowserAssets, externalizeBrowserCredentials,
  hasBrowserServer, type BrowserAsset } from './browser-deployment';
import type { Program, Statement } from './types';

type ModuleReference = Extract<Statement, { type: 'ImportStatement' | 'AllowStatement' }>;

interface BrowserModule {
  program: Program;
  exports: string[];
  references: ModuleReference[];
  dependencies: Record<string, string>;
}

function resolveModule(source: string, fromFile: string): string {
  const fromDir = path.dirname(fromFile);
  const search = [fromDir, process.cwd(), path.join(process.cwd(), 'sesi_modules')];
  const extra = process.env.SESI_PATH?.split(path.delimiter).filter(Boolean) ?? [];
  search.push(...extra, path.join(os.homedir(), '.sesi', 'lib'));
  const bases = path.isAbsolute(source) ? [source] : search.map(dir => path.resolve(dir, source));
  for (const base of bases) {
    for (const file of [base, `${base}.sesi`, path.join(base, 'index.sesi'), path.join(base, 'main.sesi')]) {
      if (file.endsWith('.sesi') && fs.existsSync(file) && fs.statSync(file).isFile()) return fs.realpathSync(file);
    }
  }
  throw new Error(`${fromFile}: Cannot resolve Sesi module "${source}"`);
}

/** Compile a Sesi entry and its imported modules to minified browser JavaScript. */
export function compileSesiForBrowser(entryFile: string, outputFile: string): {
  javascript: string; launchPage?: string; worker?: string; assets?: string; credentials: string[];
} {
  const entry = fs.realpathSync(path.resolve(entryFile));
  const output = path.resolve(outputFile);
  if (!entry.endsWith('.sesi') || !output.endsWith('.js')) throw new Error('Expected a .sesi entry and a .js output.');

  const modules = new Map<string, BrowserModule>();
  const assets: Record<string, BrowserAsset> = Object.create(null);
  const credentials = new Set<string>();
  let server = false;
  const visiting = new Set<string>();
  const visit = (file: string): void => {
    if (visiting.has(file)) throw new Error(`${file}: Circular browser imports are not supported`);
    if (modules.has(file)) return;
    visiting.add(file);
    const parser = new Parser(new Lexer(fs.readFileSync(file, 'utf8')).scanTokens());
    const program = parser.parse();
    if (parser.errors.length) throw new Error(`${file}: ${parser.errors.join('; ')}`);
    collectBrowserAssets(program, file, assets, path.dirname(entry));
    externalizeBrowserCredentials(program, credentials);
    server ||= hasBrowserServer(program);
    const compiler = new Compiler();
    compiler.compileProgram(program);
    if (compiler.errors.length) throw new Error(`${file}: ${compiler.errors.join('; ')}`);

    const references = program.statements.filter((statement): statement is ModuleReference =>
      statement.type === 'ImportStatement' || statement.type === 'AllowStatement');
    const dependencies: Record<string, string> = Object.create(null);
    for (const reference of references) {
      if (!reference.source.startsWith('std/')) dependencies[reference.source] = resolveModule(reference.source, file);
    }
    modules.set(file, {
      program,
      exports: program.statements.filter(statement => statement.type === 'ExportStatement')
        .map(statement => statement.statement.name),
      references,
      dependencies,
    });
    for (const dependency of Object.values(dependencies)) visit(dependency);
    visiting.delete(file);
  };
  visit(entry);

  for (const [file, module] of modules) {
    for (const reference of module.references) {
      if (reference.source.startsWith('std/')) continue;
      const dependency = modules.get(module.dependencies[reference.source])!;
      const names = reference.type === 'ImportStatement' ? reference.names
        : Array.isArray(reference.binding) ? reference.binding : [];
      for (const name of names) {
        if (!dependency.exports.includes(name)) {
          throw new Error(`${file}:${reference.line}: Module ${reference.source} does not export ${name}`);
        }
      }
    }
  }

  const ids = new Map([...modules.keys()].map((file, index) => [file, `m${index}`]));
  const emitted: string[] = [];
  for (const [file, module] of modules) {
    const dependencies = Object.fromEntries(Object.entries(module.dependencies)
      .map(([source, target]) => [source, ids.get(target)!]));
    const code = new SesiJavaScriptEmitter(file, dependencies).emit(module.program);
    emitted.push(`__sesiModules[${JSON.stringify(ids.get(file))}] = async function () {\n${code}\n};`);
  }
  const stem = output.slice(0, -3);
  const worker = stem + '.worker.js', launchPage = stem + '.html', assetFile = stem + '.assets.json';
  const options = { assetsUrl: Object.keys(assets).length ? './' + path.basename(assetFile) : undefined,
    workerUrl: server ? './' + path.basename(worker) : undefined };
  const body = [
    `// Generated from Sesi source: ${path.basename(entry)}`,
    'const __name = target => target;',
    `const __sesi = (${browserJsRuntime.toString()})({ ...${JSON.stringify(options)}, baseUrl: __sesiBase });`,
    'const __sesiModules = Object.create(null);',
    'const __sesiCache = Object.create(null);',
    'function __sesiLoad(id) { return __sesiCache[id] ??= __sesiModules[id](); }',
    ...emitted,
    `await __sesiLoad(${JSON.stringify(ids.get(entry))});`,
    '',
  ].join('\n');
  const js = `const __sesiBase = ${server || Object.keys(assets).length
    ? 'new URL(".", import.meta.url).href' : 'undefined'};\n` + body;
  const minify = (code: string): string => transformSync(code, {
    loader: 'js', target: 'es2022', minify: true, keepNames: true, legalComments: 'none',
    supported: { 'template-literal': false },
  }).code;
  const javascript = minify(js);
  const workerCode = server ? minify(`const __name = target => target;\n(${browserServiceWorker.toString()})(async () => {\n`
    + 'const __sesiBase = new URL(".", globalThis.location.href).href;\n' + body + '\n}, '
    + JSON.stringify({ bypass: [path.basename(output), path.basename(worker), path.basename(launchPage), path.basename(assetFile)] }) + ');\n') : undefined;
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, javascript);
  if (Object.keys(assets).length) fs.writeFileSync(assetFile, JSON.stringify(assets));
  if (server) {
    fs.writeFileSync(worker, workerCode!);
    fs.writeFileSync(launchPage, browserLaunchPage(path.basename(output), [...credentials]));
  }
  return { javascript: output, ...(server ? { launchPage, worker } : {}),
    ...(Object.keys(assets).length ? { assets: assetFile } : {}), credentials: [...credentials] };
}
