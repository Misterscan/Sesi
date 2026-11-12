'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');

function dependency(name, root) {
  try {
    return createRequire(path.join(root, 'package.json')).resolve(name, { paths: [root, __dirname] });
  } catch {
    throw new Error('Desktop builds require Electron and Electron Packager. Install them in the project with npm install -D electron @electron/packager.');
  }
}

async function buildDesktop(entry, compile) {
  const root = path.dirname(entry);
  const output = path.join(root, 'dist', 'desktop');
  const name = path.basename(root).replace(/[^a-z0-9 _-]/gi, '').trim() || 'Sesi Web App';
  const staging = await fs.mkdtemp(path.join(os.tmpdir(), 'sesi-web-desktop-'));
  try {
    const content = path.join(staging, 'web');
    await fs.mkdir(content);
    const publicDirectory = path.join(root, 'public');
    const assets = await fs.lstat(publicDirectory).catch(error => {
      if (error.code !== 'ENOENT') throw error;
    });
    if (assets) {
      if (!assets.isDirectory()) throw new Error('Expected public/ to be a directory.');
      await fs.cp(publicDirectory, content, {
        recursive: true,
        async filter(source) {
          if ((await fs.lstat(source)).isSymbolicLink()) {
            throw new Error(`Desktop asset must not be a symlink: ${path.relative(root, source)}`);
          }
          return true;
        },
      });
    }
    await fs.copyFile(path.join(root, 'index.html'), path.join(content, 'index.html'));
    const javascript = path.join(content, path.basename(entry).replace(/\.sesi$/, '.js'));
    const result = compile(entry, javascript);
    if (result.worker) throw new Error('Desktop builds expect a frontend entry point. Move listen() to a separate server script.');
    const electronVersion = require(dependency('electron/package.json', root)).version;
    const { packager } = await import(pathToFileURL(dependency('@electron/packager', root)).href);
    const host = await fs.readFile(path.join(__dirname, '..', 'bin', 'web-desktop-host.cjs'));
    await fs.writeFile(path.join(staging, 'main.cjs'), host);
    await fs.writeFile(path.join(staging, 'package.json'), JSON.stringify({
      name: 'sesi-web-app', productName: name, version: '1.0.0', main: 'main.cjs',
    }));
    const [artifact] = await packager({
      dir: staging, out: output, name, electronVersion, platform: process.platform, arch: process.arch,
      asar: true, prune: false, overwrite: false, quiet: true,
    });
    if (!artifact) throw new Error(`Desktop application already exists in ${output}`);
    return process.platform === 'darwin' || process.platform === 'mas'
      ? path.join(artifact, `${name}.app`)
      : path.join(artifact, process.platform === 'win32' ? `${name}.exe` : name);
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

module.exports = { buildDesktop };
