import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { chromium, _electron } from 'playwright';
import { compileSesiForBrowser } from '../src/browser-compiler';

async function main(): Promise<void> {
  const root = path.resolve(__dirname, '..');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-icons-'));
  const icons = fs.readdirSync(path.join(root, 'sesi-icons')).filter(file => file.endsWith('.svg')).sort();
  const names = icons.map(file => path.basename(file, '.svg'));
  const exports = names.map(name => name.split('-').map(part =>
    part === 'ai' ? 'AI' : part[0].toUpperCase() + part.slice(1)).join(''));
  const imports = names.map((name, index) =>
    `import {${exports[index]}} from ${JSON.stringify(path.join(root, 'sesi-icons', name))}`).join('\n');
  const source = `allow "std/web" in as Web
${imports}

fn Gallery() {
  return Web.element("div", {}, [
    ${exports.map((name, index) => `Web.child(${name}, {}, "${names[index]}")`).join(',\n    ')}
  ])
}

fn PaletteDemo(props, ui) {
  let active = ui.state("active", false)
  fn flip() { active.set(true) }
  let icon_props = {size: 32, label: "Search"}
  if active.value {
    icon_props = {size: 48, class: "themed", palette: {outline: "#123456", surface: "#abcdef", accent: "#654321"}, stroke_width: 2}
  }
  return Web.element("div", {}, [
    Web.element("button", {on_click: flip}, ["Customize"]),
    Web.child(Search, icon_props)
  ])
}

fn HtmlLabel() { return Web.element("div", {id: "html-label"}, ["HTML inside SVG"]) }
fn SvgTree() {
  return Web.element("svg", {viewBox: "0 0 64 64"}, [
    Web.element("defs", {}, [Web.element("circle", {id: "dot", cx: 4, cy: 4, r: 2})]),
    Web.element("use", {"xlink:href": "#dot"}),
    Web.element("foreignObject", {width: 64, height: 64}, [Web.child(HtmlLabel)])
  ])
}
fn SvgChild() { return Web.element("circle", {cx: 8, cy: 8, r: 4}) }
Web.mount("#gallery", Gallery)
Web.mount("#custom", PaletteDemo)
Web.mount("#tree", SvgTree)
Web.mount("#svg-root", SvgChild)
`;
  const entry = path.join(directory, 'app.sesi');
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    fs.writeFileSync(entry, source);
    const build = compileSesiForBrowser(entry, path.join(directory, 'app.js'));
    const single = path.join(directory, 'single.sesi');
    fs.writeFileSync(single, `allow "std/web" in as Web
import {Search} from ${JSON.stringify(path.join(root, 'sesi-icons/search'))}
Web.mount("#app", Search)`);
    compileSesiForBrowser(single, path.join(directory, 'single.js'));
    assert.ok(!fs.readFileSync(path.join(directory, 'single.js'), 'utf8').includes('globe-location'));
    const html = '<div id="gallery"></div><div id="custom"></div><div id="tree"></div><svg id="svg-root"></svg>';
    browser = await chromium.launch(fs.existsSync(chromium.executablePath()) ? {} : { channel: 'chrome' });
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.setContent(html);
    await page.addScriptTag({ type: 'module', content: fs.readFileSync(build.javascript, 'utf8') });
    await page.waitForFunction(count => document.querySelectorAll('#gallery > div > svg').length === count, icons.length);
    const sources = icons.map(file => fs.readFileSync(path.join(root, 'sesi-icons', file), 'utf8'));
    const differences = await page.evaluate(originals => {
      const differences: string[] = [];
      const rendered = document.querySelectorAll('#gallery > div > svg');
      originals.forEach((source, index) => {
        const original = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement;
        const actual = rendered[index];
        if (actual.getAttribute('viewBox') !== original.getAttribute('viewBox')) differences.push(`${index}: viewBox`);
        if (actual.getAttribute('width') !== '24') differences.push(`${index}: default size`);
        if (actual.getAttribute('aria-hidden') !== 'true') differences.push(`${index}: decorative accessibility`);
        const before = [...original.children], after = [...actual.children];
        if (before.length !== after.length) differences.push(`${index}: shape count`);
        before.forEach((shape, child) => {
          const node = after[child];
          if (!node || node.namespaceURI !== 'http://www.w3.org/2000/svg' || node.localName !== shape.localName) {
            differences.push(`${index}: shape namespace/type`);
            return;
          }
          for (const attribute of shape.attributes) {
            if (node.getAttribute(attribute.name) !== attribute.value) differences.push(`${index}: ${attribute.name}`);
          }
        });
      });
      return differences;
    }, sources);
    assert.deepEqual(differences, []);
    const customized = page.locator('#custom svg');
    await page.getByRole('img', { name: 'Search', exact: true }).waitFor();
    const originalNode = await customized.elementHandle();
    await page.getByRole('button', { name: 'Customize' }).click();
    await page.waitForFunction(() => document.querySelector('#custom svg')?.getAttribute('width') === '48');
    assert.equal(await originalNode!.evaluate(node => node === document.querySelector('#custom svg')), true);
    assert.equal(await customized.getAttribute('aria-label'), null);
    assert.equal(await customized.getAttribute('aria-hidden'), 'true');
    assert.equal(await customized.getAttribute('class'), 'themed');
    assert.equal(await customized.locator('circle').first().getAttribute('fill'), '#abcdef');
    assert.equal(await customized.locator('path').first().getAttribute('fill'), '#654321');
    assert.equal(await customized.locator('circle').first().getAttribute('stroke'), '#123456');
    assert.equal(await customized.locator('circle').first().getAttribute('stroke-width'), '2');
    assert.equal(await customized.locator('circle').first().getAttribute('vector-effect'), 'non-scaling-stroke');
    assert.equal(await page.locator('#html-label').evaluate(node => node.namespaceURI), 'http://www.w3.org/1999/xhtml');
    assert.equal(await page.locator('#svg-root circle').evaluate(node => node.namespaceURI), 'http://www.w3.org/2000/svg');
    assert.equal(await page.locator('#tree use').evaluate(node =>
      node.getAttributeNS('http://www.w3.org/1999/xlink', 'href')), '#dot');
    assert.deepEqual(errors, []);
    console.log(`Rendered and verified all ${icons.length} icons in Chrome.`);

    await page.goto(pathToFileURL(path.join(root, 'examples/ui/icons.html')).href);
    await page.getByRole('button', { name: 'Project brief.md', exact: true }).waitFor();
    await page.getByRole('searchbox', { name: 'Search files' }).fill('concept');
    await page.waitForFunction(() => document.querySelectorAll('.file').length === 1);
    await page.getByRole('button', { name: 'Delete Homepage concepts.png' }).click();
    await page.getByText('No matching files', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'New document' }).click();
    await page.getByRole('button', { name: 'Untitled 4.md', exact: true }).waitFor();
    assert.deepEqual(errors, []);
    console.log('Standalone icon example passed direct file opening.');

    if (process.env.SESI_TEST_DESKTOP === '1') {
      fs.writeFileSync(path.join(directory, 'index.html'), html + '<script type="module" src="/app.js"></script>');
      const output = execFileSync(process.execPath, [path.join(root, 'bin/sesi.js'), 'build', entry, '--desktop'], {
        encoding: 'utf8', timeout: 120000,
      });
      const artifact = output.match(/^Desktop application: (.+)$/m)?.[1];
      assert.ok(artifact, output);
      const executablePath = artifact.endsWith('.app')
        ? path.join(artifact, 'Contents/MacOS', path.basename(artifact, '.app')) : artifact;
      const env = { ...process.env };
      delete env.ELECTRON_RUN_AS_NODE;
      const desktop = await _electron.launch({ executablePath, args: [], env });
      try {
        const window = await desktop.firstWindow();
        await window.waitForFunction(count => document.querySelectorAll('#gallery > div > svg').length === count, icons.length);
        assert.equal(await window.locator('#gallery svg').first().evaluate(node => node.namespaceURI), 'http://www.w3.org/2000/svg');
        await window.getByRole('button', { name: 'Customize' }).click();
        await window.waitForFunction(() => document.querySelector('#custom svg')?.getAttribute('width') === '48');
        console.log('Icon desktop build passed.');
      } finally { await desktop.close(); }
    }
  } finally {
    await browser?.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
