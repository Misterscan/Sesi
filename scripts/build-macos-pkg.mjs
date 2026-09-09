import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const packageJsonPath = path.join(repoRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const version = packageJson.version;
const releasesDir = path.join(repoRoot, 'releases');

function removeAppleDoubleFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.name.startsWith('._')) {
      fs.rmSync(entryPath, { recursive: entry.isDirectory(), force: true });
    } else if (entry.isDirectory()) {
      removeAppleDoubleFiles(entryPath);
    }
  }
}

function payloadStats(directory) {
  let numberOfFiles = 0;
  let bytes = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    numberOfFiles += 1;
    if (entry.isDirectory()) {
      const child = payloadStats(entryPath);
      numberOfFiles += child.numberOfFiles;
      bytes += child.bytes;
    } else if (entry.isFile()) {
      bytes += fs.statSync(entryPath).size;
    }
  }
  return { numberOfFiles, bytes };
}

function sanitizePackagePayload(packagePath) {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-pkg-clean-'));
  const expanded = path.join(temporary, 'expanded');
  const payloadRoot = path.join(temporary, 'payload-root');
  const payloadArchive = path.join(temporary, 'Payload.cpio');
  const cleanArchive = path.join(temporary, 'Payload.clean.cpio');
  const cleanPackage = path.join(temporary, 'clean.pkg');

  try {
    fs.mkdirSync(payloadRoot, { recursive: true });
    execFileSync('pkgutil', ['--expand', packagePath, expanded], { stdio: 'ignore' });
    fs.writeFileSync(payloadArchive, zlib.gunzipSync(fs.readFileSync(path.join(expanded, 'Payload'))));
    execFileSync('/usr/bin/bsdtar', ['-xf', payloadArchive, '-C', payloadRoot], { stdio: 'ignore' });
    removeAppleDoubleFiles(payloadRoot);

    execFileSync('/usr/bin/mkbom', [payloadRoot, path.join(expanded, 'Bom')], { stdio: 'ignore' });
    execFileSync(
      '/usr/bin/bsdtar',
      ['--format', 'cpio', '--no-xattrs', '--no-acls', '-cf', cleanArchive, '-C', payloadRoot, '.'],
      { stdio: 'ignore' }
    );
    fs.writeFileSync(path.join(expanded, 'Payload'), zlib.gzipSync(fs.readFileSync(cleanArchive)));

    const stats = payloadStats(payloadRoot);
    const packageInfoPath = path.join(expanded, 'PackageInfo');
    const packageInfo = fs.readFileSync(packageInfoPath, 'utf8').replace(
      /<payload numberOfFiles="\d+" installKBytes="\d+"\/>/,
      `<payload numberOfFiles="${stats.numberOfFiles}" installKBytes="${Math.ceil(stats.bytes / 1024)}"/>`
    );
    fs.writeFileSync(packageInfoPath, packageInfo);

    execFileSync('pkgutil', ['--flatten', expanded, cleanPackage], { stdio: 'ignore' });
    fs.copyFileSync(cleanPackage, packagePath);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}

if (process.platform !== 'darwin') {
  console.error('build:mac:pkg must be run on macOS (pkgbuild is only available there).');
  process.exit(1);
}

const binaryCandidates = [
  { arch: 'arm64', file: 'sesi.bundled-arm64' },
  { arch: 'arm64', file: 'sesi.bundled-macos-arm64' },
  { arch: 'x64', file: 'sesi.bundled-x64' },
  { arch: 'x64', file: 'sesi.bundled-macos-x64' },
  { arch: 'x64', file: 'sesi.bundled-macos' }
];

const binaries = binaryCandidates
  .map((candidate) => ({ ...candidate, absPath: path.join(releasesDir, candidate.file) }))
  .filter((candidate) => fs.existsSync(candidate.absPath))
  .filter((candidate, index, arr) => arr.findIndex((c) => c.arch === candidate.arch) === index);

if (binaries.length === 0) {
  console.error('No macOS binary found in releases/. Run npm run build:exe first.');
  process.exit(1);
}

try {
  execFileSync('which', ['pkgbuild'], { stdio: 'ignore' });
} catch {
  console.error('pkgbuild was not found. Install Xcode Command Line Tools and try again.');
  process.exit(1);
}

for (const binary of binaries) {
  const stageRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-pkg-'));
  const installBinDir = path.join(stageRoot, 'usr', 'local', 'bin');
  const stagedBinary = path.join(installBinDir, 'sesi');
  const outputPkg = path.join(releasesDir, `sesi-${version}-macos-${binary.arch}.pkg`);

  try {
    fs.mkdirSync(installBinDir, { recursive: true });
    fs.copyFileSync(binary.absPath, stagedBinary);
    fs.chmodSync(stagedBinary, 0o755);

    // External macOS volumes can attach provenance/resource metadata while
    // copying. pkgbuild serializes that metadata as `._*` payload entries and
    // may emit `write: Permission denied`, so package only the real files.
    execFileSync('/usr/bin/xattr', ['-cr', stageRoot], { stdio: 'ignore' });
    removeAppleDoubleFiles(stageRoot);

    const pkgbuild = spawnSync(
      'pkgbuild',
      [
        '--root',
        stageRoot,
        '--identifier',
        `com.misterscan.sesi.${binary.arch}`,
        '--version',
        version,
        '--install-location',
        '/',
        outputPkg
      ],
      {
        encoding: 'utf8',
        env: { ...process.env, COPYFILE_DISABLE: '1' }
      }
    );

    if (pkgbuild.stdout) process.stdout.write(pkgbuild.stdout);
    if (pkgbuild.status !== 0) {
      if (pkgbuild.stderr) process.stderr.write(pkgbuild.stderr);
      throw pkgbuild.error || new Error(`pkgbuild exited with code ${String(pkgbuild.status)}`);
    }
    const remainingStderr = (pkgbuild.stderr || '')
      .split(/\r?\n/)
      .filter(line => line.trim() !== '' && line.trim() !== 'write: Permission denied')
      .join('\n');
    if (remainingStderr) process.stderr.write(`${remainingStderr}\n`);

    sanitizePackagePayload(outputPkg);

    console.log(`Created ${outputPkg}`);
  } finally {
    fs.rmSync(stageRoot, { recursive: true, force: true });
  }
}
