import * as assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium, _electron } from 'playwright';
import { compileSesiForBrowser } from '../src/browser-compiler';

const fixture = `
allow "std/web" in as UI

fn Counter(props, ui) {
  let count = ui.state("count", 0)
  fn add(value) { return value + 1 }
  fn twice(event) {
    harness.clicks = harness.clicks + 1
    count.update(add)
    count.update(add)
  }
  return UI.element("button", {on_click: twice}, [str(count.value)])
}

fn Wrapper(props, ui) {
  let visible = ui.state("visible", true)
  fn flip(value) { return !value }
  fn toggle(event) { visible.update(flip) }
  let counter = null
  if visible.value { counter = UI.child(props.counter, {}, "nested") }
  return UI.element("section", {}, [
    UI.element("button", {id: "toggle", on_click: toggle}, ["Toggle"]),
    UI.element("div", {id: "nested"}, [counter])
  ])
}

fn Race(props, ui) {
  let mode = ui.state("mode", "base")
  let label = mode.value
  if label != "base" {
    let staged = ui.state("staged", label)
    label = harness.load(label, staged.value)
  }
  fn slow(event) { mode.set("slow") }
  fn fast(event) { mode.set("fast") }
  fn fail(event) { mode.set("fail") }
  return UI.element("section", {}, [
    UI.element("p", {id: "label"}, [label]),
    UI.element("button", {id: "slow", on_click: slow}, ["Slow"]),
    UI.element("button", {id: "fast", on_click: fast}, ["Fast"]),
    UI.element("button", {id: "fail", on_click: fail}, ["Fail"])
  ])
}

UI.mount("#first", Wrapper, {counter: Counter})
UI.mount("#second", Counter, {})
harness.race = UI.mount("#race", Race, {})
`;

const pages = `
allow "std/web" in as Web

export fn Layout(props, ui) {
  let theme = ui.state("theme", "light")
  fn dark() { theme.set("dark") }
  fn watch_theme() {
    harness.theme.push(theme.value)
    fn cleanup() { harness.theme.push("cleanup " + theme.value) }
    return cleanup
  }
  ui.effect("theme", [theme.value], watch_theme)
  ui.provide("theme", theme.value)
  return Web.element("main", {}, [
    Web.element("button", {id: "theme", on_click: dark}, [theme.value]),
    Web.link("/issues/one", {}, ["One"]),
    Web.link("/issues/two?q=test", {}, ["Two"]),
    props.page
  ])
}

export fn Issue(props, ui) {
  let id = props.params.id
  let label = ui.state("label", "Loading")
  fn setup() {
    let text = harness.load(id)
    label.set(text)
    fn cleanup() { harness.cleaned.push(id) }
    return cleanup
  }
  fn missing() { ui.navigate("/missing") }
  ui.effect("load", [id], setup)
  return Web.element("section", {}, [
    Web.element("h1", {}, [id]),
    Web.element("p", {id: "value"}, [label.value]),
    Web.element("p", {id: "context"}, [ui.context("theme", "none")]),
    Web.element("p", {id: "query"}, [props.query.q]),
    Web.element("button", {on_click: missing}, ["Missing"])
  ])
}
`;

async function checkDesktop(entry: string): Promise<void> {
  const directory = path.dirname(entry);
  fs.mkdirSync(path.join(directory, 'public'));
  fs.writeFileSync(path.join(directory, 'public', 'example.txt'), 'Bundled asset');
  fs.writeFileSync(path.join(directory, 'index.html'), `
    <div id="app"></div>
    <script>globalThis.harness = {theme: [], cleaned: [], load: id => 'Loaded ' + id}</script>
    <script type="module" src="/app.js"></script>`);
  const cli = path.join(__dirname, '..', 'bin', 'sesi.js');
  const output = execFileSync(process.execPath, [cli, 'build', entry, '--desktop'], {
    encoding: 'utf8', timeout: 120000,
  });
  const artifact = output.match(/^Desktop application: (.+)$/m)?.[1];
  assert.ok(artifact, output);
  const executablePath = artifact.endsWith('.app')
    ? path.join(artifact, 'Contents', 'MacOS', path.basename(artifact, '.app'))
    : artifact;
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const desktop = await _electron.launch({ executablePath, args: [], env });
  try {
    await desktop.context().route(/^https?:/, route => route.abort());
    const window = await desktop.firstWindow();
    window.setDefaultTimeout(5000);
    await window.getByRole('link', { name: 'Two', exact: true }).click();
    await window.getByText('Loaded two').waitFor();
    assert.equal(window.url(), 'app://local/issues/two?q=test');
    await window.reload();
    await window.getByText('Loaded two').waitFor();
    assert.equal(await window.evaluate(async () => (await fetch('/example.txt')).text()), 'Bundled asset');
    assert.equal(await window.evaluate(async () => (await fetch('/missing.js')).status), 404);
    assert.equal(await window.evaluate(() => typeof (globalThis as any).require), 'undefined');
    console.log('Desktop web build passed');
  } finally {
    await desktop.close();
  }
}

async function main(): Promise<void> {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sesi-ui-'));
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    const entry = path.join(directory, 'fixture.sesi');
    fs.writeFileSync(entry, fixture);
    const compiled = compileSesiForBrowser(entry, path.join(directory, 'fixture.js'));
    fs.writeFileSync(path.join(directory, 'pages.sesi'), pages);
    const app = path.join(directory, 'app.sesi');
    fs.writeFileSync(app, `allow "std/web" in as Web
import {Layout, Issue} from "pages"
Web.app("#app", {routes: [{path: "/issues/:id", component: Issue}], layout: Layout})`);
    const routed = compileSesiForBrowser(app, path.join(directory, 'app.js'));
    const example = path.join(__dirname, '..', 'examples', 'ui');
    const board = compileSesiForBrowser(path.join(example, 'issue-board.sesi'), path.join(directory, 'issue-board.js'));
    const executable = chromium.executablePath();
    browser = await chromium.launch(fs.existsSync(executable) ? {} : { channel: 'chrome' });
    const page = await browser.newPage();
    page.setDefaultTimeout(5000);
    const errors: string[] = [];
    const uncaught: Error[] = [];
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', error => uncaught.push(error));
    await page.setContent('<div id="first"></div><div id="second"></div><div id="race"></div>');
    await page.evaluate(() => {
      const pending: ((label: string) => void)[] = [];
      (globalThis as any).harness = {
        clicks: 0, pending,
        load(mode: string, staged: string) {
          if (mode === 'slow') return new Promise<string>(resolve => pending.push(resolve));
          if (mode === 'fail') throw new Error('Expected render failure');
          return `Ready: ${staged}`;
        },
      };
    });
    await page.addScriptTag({ type: 'module', content: fs.readFileSync(compiled.javascript, 'utf8') });

    const nested = page.locator('#nested button');
    await nested.click();
    await page.waitForFunction(() => document.querySelector('#nested button')?.textContent === '2');
    assert.equal(await page.locator('#second button').textContent(), '0');
    const oldButton = await nested.elementHandle();
    await page.locator('#toggle').click();
    await nested.waitFor({ state: 'detached' });
    await oldButton!.evaluate(button => (button as HTMLButtonElement).click());
    assert.equal(await page.evaluate(() => (globalThis as any).harness.clicks), 1);
    await page.locator('#toggle').click();
    await page.waitForFunction(() => document.querySelector('#nested button')?.textContent === '0');

    await page.locator('#slow').click();
    await page.waitForFunction(() => (globalThis as any).harness.pending.length === 1);
    await page.locator('#fast').click();
    await page.waitForFunction(() => document.querySelector('#label')?.textContent === 'Ready: fast');
    await page.evaluate(async () => {
      (globalThis as any).harness.pending.shift()('Old render');
      await new Promise(requestAnimationFrame);
    });
    assert.equal(await page.locator('#label').textContent(), 'Ready: fast');
    await Promise.all([
      page.waitForEvent('console', { predicate: message => message.text().includes('Expected render failure') }),
      page.locator('#fail').click(),
    ]);
    assert.equal(await page.locator('#label').textContent(), 'Ready: fast');
    await page.locator('#slow').click();
    await page.waitForFunction(() => (globalThis as any).harness.pending.length === 1);
    await page.evaluate(async () => {
      const harness = (globalThis as any).harness;
      harness.race.unmount();
      harness.pending.shift()('Unmounted render');
      await new Promise(requestAnimationFrame);
    });
    assert.equal(await page.locator('#race').innerHTML(), '');
    assert.equal(errors.filter(message => message.includes('Expected render failure')).length, 1);
    assert.equal(errors.length, 1, errors.join('\n'));
    assert.deepEqual(uncaught, []);

    await page.route('http://sesi-ui.test/**', route => {
      if (route.request().url().endsWith('/issue-board.js')) {
        return route.fulfill({ path: board.javascript, contentType: 'text/javascript' });
      }
      return route.fulfill({ path: path.join(example, 'index.html'), contentType: 'text/html' });
    });
    await page.goto('http://sesi-ui.test/');
    const search = page.getByRole('searchbox', { name: 'Filter issues' });
    await search.pressSequentially('loading');
    await page.waitForFunction(() => document.querySelectorAll('[data-issue]').length === 1);
    assert.equal(await page.locator('[data-issue]').getAttribute('data-issue'), 'UI-102');
    assert.equal(await search.evaluate(input => input === document.activeElement), true);
    await search.fill('');
    const card = page.locator('[data-issue="UI-101"]');
    await card.getByRole('button', { name: 'Details' }).click();
    await card.getByText('Issue UI-101').waitFor();
    const cardNode = await card.elementHandle();
    const reorder = card.getByRole('button', { name: 'Move to end' });
    await reorder.click();
    await page.waitForFunction(() => document.querySelector('[data-column="open"] li:last-child')
      ?.getAttribute('data-issue') === 'UI-101');
    assert.equal(await cardNode!.evaluate(node => node === document.querySelector('[data-issue="UI-101"]')), true);
    assert.equal(await reorder.evaluate(button => button === document.activeElement), true);
    assert.equal(await card.getByText('Issue UI-101').count(), 1);

    await card.getByRole('button', { name: 'Edit' }).click();
    const draft = page.getByRole('textbox', { name: 'Editing UI-101' });
    await draft.fill('Draft survives the move');
    await card.getByRole('button', { name: 'Move to done' }).evaluate(button => (button as HTMLButtonElement).click());
    await page.locator('[data-column="done"] [data-issue="UI-101"]').waitFor();
    assert.equal(await draft.inputValue(), 'Draft survives the move');
    assert.equal(await draft.evaluate(input => input === document.activeElement), true);
    await page.getByRole('button', { name: 'Save' }).click();
    await card.getByRole('heading', { name: 'Draft survives the move' }).waitFor();
    assert.deepEqual(uncaught, []);
    assert.equal(errors.length, 1, errors.join('\n'));

    await page.addInitScript(() => {
      (globalThis as any).harness = {
        cleaned: [], theme: [], pending: null,
        load(id: string) {
          if (id === 'two') return 'Loaded two';
          return new Promise<string>(resolve => { (globalThis as any).harness.pending = resolve; });
        },
      };
    });
    await page.route('http://sesi-routes.test/**', route => route.fulfill({
      contentType: 'text/html',
      body: `<div id="app"></div><script type="module">${fs.readFileSync(routed.javascript, 'utf8')}</script>`,
    }));
    await page.goto('http://sesi-routes.test/issues/one');
    await page.getByRole('heading', { name: 'one', exact: true }).waitFor();
    await page.waitForFunction(() => (globalThis as any).harness.pending);
    await page.locator('#theme').click();
    await page.waitForFunction(() => document.querySelector('#context')?.textContent === 'dark');
    await page.waitForFunction(() => (globalThis as any).harness.theme.join(',') === 'light,cleanup light,dark');
    await page.getByRole('link', { name: 'Two', exact: true }).click();
    await page.getByText('Loaded two').waitFor();
    assert.equal(await page.locator('#query').textContent(), 'test');
    assert.equal(await page.locator('#context').textContent(), 'dark');
    await page.evaluate(() => (globalThis as any).harness.pending('Old page'));
    await page.waitForFunction(() => (globalThis as any).harness.cleaned.includes('one'));
    assert.equal(await page.locator('#value').textContent(), 'Loaded two');
    await page.getByRole('button', { name: 'Missing' }).click();
    await page.getByRole('heading', { name: 'Page not found' }).waitFor();
    await page.waitForFunction(() => (globalThis as any).harness.cleaned.includes('two'));
    await page.goBack();
    await page.getByText('Loaded two').waitFor();
    await page.goForward();
    await page.getByRole('heading', { name: 'Page not found' }).waitFor();
    assert.equal(await page.locator('#theme').textContent(), 'dark');
    assert.deepEqual(uncaught, []);
    assert.equal(errors.length, 1, errors.join('\n'));
    console.log('Browser UI tests passed');
    if (process.env.SESI_TEST_DESKTOP === '1') await checkDesktop(app);
  } finally {
    await browser?.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
