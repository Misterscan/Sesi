/// <reference lib="dom" />

type Key = string | number;
type Props = Record<string, unknown>;
type Component = (props: Props, ui: Context) => unknown;
type Action = (event: Event) => unknown;
type Change = { value: unknown } | { update: (value: unknown) => unknown };
type Slot = { value: unknown; changes: Change[]; busy: boolean };
type EffectSpec = { dependencies: readonly unknown[]; setup: () => unknown };
type Effect = { dependencies: readonly unknown[]; stopped: boolean; cleanup?: () => unknown };
type Instance = { active: boolean; slots: Map<string, Slot>; effects: Map<string, Effect> };
type Route = { path: string; component: Component };
type AppConfig = { routes: Route[]; layout?: Component; not_found?: Component };
type Context = {
  state(name: string, initial: unknown): {
    value: unknown;
    set(value: unknown): void;
    update(fn: (value: unknown) => unknown): void;
  };
  provide(name: string, value: unknown): void;
  context(name: string, fallback?: unknown): unknown;
  effect(name: string, dependencies: readonly unknown[], setup: () => unknown): void;
  navigate(to: string): void;
};
type View = string | null | ElementView | ComponentView;
type ElementView = { kind: 'element'; tag: string; props: Props; children: readonly unknown[] };
type ComponentView = { kind: 'component'; component: Component; props: Props; key: Key | null };
type Draft = {
  instance: Instance;
  slots: Map<string, Slot>;
  providers: Map<string, unknown>;
  effects: Map<string, EffectSpec>;
  ready: boolean;
};
type Live = {
  view: View;
  node: Node;
  children: Live[];
  instance?: Instance;
  listeners?: Map<string, { action: Action; listener: EventListener }>;
};
type Render = { view: View; previous?: Live; children: Render[]; draft?: Draft };

/** Serialized into browser builds that import std/web. Keep runtime dependencies inside this factory. */
export function createBrowserUi(functionIdentity: (fn: Component) => Function = fn => fn) {
  const mounts = new WeakSet<Element>();
  const stale = Symbol('stale render');
  const report = (error: unknown) => console.error('[std/web]', error);
  const validTag = /^[a-z][a-z0-9-]*$/i;
  const validAttribute = /^[a-z_][a-z0-9_.:-]*$/i;
  const eventName = (name: string) => name.slice(3);
  const controlled = new Set(['value', 'checked', 'selected']);
  const htmlNamespace = 'http://www.w3.org/1999/xhtml';
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const xlinkNamespace = 'http://www.w3.org/1999/xlink';

  function element(tag: string, props: Props | null = null, children: readonly unknown[] = []): ElementView {
    return { kind: 'element', tag, props: { ...props }, children: [...children] };
  }

  function child(component: Component, props: Props | null = null, key: Key | null = null): ComponentView {
    return { kind: 'component', component, props: { ...props }, key };
  }

  function asView(value: unknown): View {
    if (value == null || typeof value === 'string') return value ?? null;
    if (typeof value === 'object' && 'kind' in value) {
      if (value.kind === 'component') {
        const view = value as ComponentView;
        if (typeof view.component === 'function' &&
            (view.key === null || typeof view.key === 'string' ||
              (typeof view.key === 'number' && Number.isFinite(view.key)))) return view;
      } else if (value.kind === 'element') {
        const view = value as ElementView;
        if (typeof view.tag === 'string' && validTag.test(view.tag) && Array.isArray(view.children)) {
          for (const [name, prop] of Object.entries(view.props)) {
            if (name.startsWith('on_')) {
              if (!/^[a-z][a-z0-9]*$/.test(eventName(name)) || (prop != null && typeof prop !== 'function')) {
                throw new Error(`Invalid UI event handler: ${name}`);
              }
            } else if (!validAttribute.test(name) || /^on/i.test(name) ||
                (prop != null && !['string', 'number', 'boolean'].includes(typeof prop))) {
              throw new Error(`Invalid UI attribute: ${name}`);
            }
          }
          return view;
        }
      }
    }
    throw new Error('Expected a UI element, component, string or null');
  }

  function keyOf(view: View): Key | null {
    return view && typeof view === 'object' && view.kind === 'component' ? view.key : null;
  }

  function matches(view: View, previous: View): boolean {
    if (view === null || previous === null) return view === previous;
    if (typeof view === 'string' || typeof previous === 'string') {
      return typeof view === 'string' && typeof previous === 'string';
    }
    if (view.kind === 'element') return previous.kind === 'element' && previous.tag === view.tag;
    return previous.kind === 'component' && previous.key === view.key &&
      functionIdentity(previous.component) === functionIdentity(view.component);
  }

  async function stopEffect(effect: Effect): Promise<void> {
    effect.stopped = true;
    const cleanup = effect.cleanup;
    effect.cleanup = undefined;
    try { if (cleanup) await Promise.resolve().then(cleanup); }
    catch (error) { report(error); }
  }

  function commitEffects(draft: Draft): void {
    const effects = draft.instance.effects;
    for (const [name, effect] of effects) {
      if (!draft.effects.has(name)) {
        effects.delete(name);
        void stopEffect(effect);
      }
    }
    for (const [name, { dependencies, setup }] of draft.effects) {
      const old = effects.get(name);
      if (old && old.dependencies.length === dependencies.length &&
          dependencies.every((value, index) => Object.is(value, old.dependencies[index]))) continue;
      const effect: Effect = { dependencies, stopped: false };
      effects.set(name, effect);
      void (async () => {
        if (old) await stopEffect(old);
        if (effect.stopped) return;
        try {
          const cleanup = await setup();
          if (typeof cleanup === 'function') {
            if (effect.stopped) await cleanup();
            else effect.cleanup = cleanup as () => unknown;
          }
        } catch (error) { report(error); }
      })();
    }
  }

  function release(live: Live): void {
    if (live.instance) {
      live.instance.active = false;
      live.instance.slots.clear();
      for (const effect of live.instance.effects.values()) void stopEffect(effect);
      live.instance.effects.clear();
    }
    if (live.listeners) {
      for (const [name, entry] of live.listeners) live.node.removeEventListener(name, entry.listener);
      live.listeners.clear();
    }
    for (const child of live.children) release(child);
  }

  function place(parent: Element, previous: Live[], next: Live[]): void {
    const retained = new Set(next.map(item => item.node));
    for (const item of previous) {
      if (!retained.has(item.node) && item.node.parentNode === parent) parent.removeChild(item.node);
    }
    // Reorder around the focused branch. Moving that branch through insertBefore would blur it.
    const active = parent.getRootNode() as Document | ShadowRoot;
    const focused = active.activeElement && next.find(item =>
      item.node.parentNode === parent && item.node.contains(active.activeElement));
    let anchor: Node | null = null;
    for (let index = next.length - 1; index >= 0; index--) {
      const item = next[index];
      const node = item.node;
      if (item !== focused && (node.parentNode !== parent || node.nextSibling !== anchor)) {
        parent.insertBefore(node, anchor);
      }
      anchor = node;
    }
  }

  function patchProps(node: Element, before: Props, after: Props, listeners: NonNullable<Live['listeners']>): void {
    for (const name of new Set([...Object.keys(before), ...Object.keys(after)])) {
      const value = after[name];
      if (name.startsWith('on_')) {
        const event = eventName(name);
        const old = listeners.get(event);
        if (old?.action === value) continue;
        if (old) {
          node.removeEventListener(event, old.listener);
          listeners.delete(event);
        }
        if (typeof value === 'function') {
          const action = value as Action;
          const listener = (input: Event) => {
            try { void Promise.resolve(action(input)).catch(report); }
            catch (error) { report(error); }
          };
          listeners.set(event, { action, listener });
          node.addEventListener(event, listener);
        }
      } else if (controlled.has(name) && name in node) {
        const target = node as unknown as Record<string, unknown>;
        const next = name === 'value' ? String(value ?? '') : Boolean(value);
        if (target[name] !== next) target[name] = next;
      } else if (!Object.is(before[name], value)) {
        const literalBoolean = name.startsWith('aria-') || name.startsWith('data-');
        if (name.startsWith('xlink:') && node.namespaceURI === svgNamespace) {
          if (value == null) node.removeAttributeNS(xlinkNamespace, name.slice(6));
          else node.setAttributeNS(xlinkNamespace, name, String(value));
        } else if (value == null || (value === false && !literalBoolean)) node.removeAttribute(name);
        else node.setAttribute(name, value === true && !literalBoolean ? '' : String(value));
      }
    }
  }

  function mountRoot(selector: string, component: Component, props: Props | null, routed = false) {
    if (typeof document === 'undefined') throw new Error('std/web requires a browser document');
    const match = document.querySelector(selector);
    if (!match) throw new Error(`UI mount target not found: ${selector}`);
    const target = match;
    if (mounts.has(target)) throw new Error(`UI mount target already in use: ${selector}`);
    mounts.add(target);
    const doc = target.ownerDocument;
    const root = child(component, props);
    let current: Live | undefined;
    let generation = 0;
    let scheduled = false;
    let mounted = true;

    function schedule(): void {
      generation++;
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        if (mounted) void render(generation);
      });
    }

    async function drain(instance: Instance, slot: Slot): Promise<void> {
      if (slot.busy) return;
      slot.busy = true;
      try {
        while (instance.active && slot.changes.length) {
          const change = slot.changes.shift()!;
          try {
            const value = 'update' in change ? await change.update(slot.value) : change.value;
            if (instance.active && !Object.is(slot.value, value)) {
              slot.value = value;
              schedule();
            }
          } catch (error) { if (instance.active) report(error); }
        }
      } finally {
        slot.busy = false;
        if (!instance.active) slot.changes.length = 0;
      }
    }

    function context(draft: Draft, inherited: ReadonlyMap<string, unknown>): Context {
      const { instance, slots } = draft;
      const snapshot = new Map([...instance.slots].map(([name, slot]) => [name, slot.value]));
      return {
        provide(name, value) { if (!draft.ready) draft.providers.set(name, value); },
        context(name, fallback = null) { return inherited.has(name) ? inherited.get(name) : fallback; },
        effect(name, dependencies, setup) {
          if (draft.ready) throw new Error('Web effects must be declared during rendering');
          if (typeof name !== 'string' || !name || !Array.isArray(dependencies) || typeof setup !== 'function') {
            throw new Error('Expected effect(name, dependencies, setup)');
          }
          if (draft.effects.has(name)) throw new Error(`Duplicate web effect: ${name}`);
          draft.effects.set(name, { dependencies: [...dependencies], setup });
        },
        navigate(to) {
          if (!routed) throw new Error('Navigation requires Web.app');
          if (draft.ready && instance.active) navigate(to);
        },
        state(name, initial) {
          if (typeof name !== 'string' || !name) throw new Error('UI state requires a nonempty name');
          let slot = instance.slots.get(name) ?? slots.get(name);
          if (!slot) slots.set(name, slot = { value: initial, changes: [], busy: false });
          const state = slot;
          const enqueue = (change: Change) => {
            if (!draft.ready || !instance.active) return;
            state.changes.push(change);
            void drain(instance, state);
          };
          return {
            value: snapshot.has(name) ? snapshot.get(name) : state.value,
            set: value => enqueue({ value }),
            update: update => enqueue({ update }),
          };
        },
      };
    }

    async function resolve(view: View, previous: Live | undefined, ticket: number,
      inherited: ReadonlyMap<string, unknown>): Promise<Render> {
      if (!mounted || ticket !== generation) throw stale;
      const old = previous && matches(view, previous.view) ? previous : undefined;
      const result: Render = { view, previous: old, children: [] };
      if (view === null || typeof view === 'string') return result;
      if (view.kind === 'component') {
        const instance = old?.instance ?? { active: false, slots: new Map(), effects: new Map() };
        const draft: Draft = { instance, slots: new Map(), providers: new Map(), effects: new Map(), ready: false };
        const output = await view.component(view.props, context(draft, inherited));
        if (!mounted || ticket !== generation) throw stale;
        result.draft = draft;
        const provided = draft.providers.size ? new Map([...inherited, ...draft.providers]) : inherited;
        result.children.push(await resolve(asView(output), old?.children[0], ticket, provided));
      } else {
        const previousChildren = old?.children ?? [];
        const keyed = new Map(previousChildren.flatMap(item => {
          const key = keyOf(item.view);
          return key === null ? [] : [[key, item] as const];
        }));
        const keys = new Set<Key>();
        const children = view.children.map(asView);
        result.children = await Promise.all(children.map((item, index) => {
          const key = keyOf(item);
          if (key !== null) {
            if (keys.has(key)) throw new Error(`Duplicate UI child key: ${key}`);
            keys.add(key);
            return resolve(item, keyed.get(key), ticket, inherited);
          }
          const atIndex = previousChildren[index];
          return resolve(item, atIndex && keyOf(atIndex.view) === null ? atIndex : undefined, ticket, inherited);
        }));
      }
      return result;
    }

    function commit(plan: Render, committed: Draft[], inheritedNamespace = htmlNamespace): Live {
      const { view, previous, draft } = plan;
      const isElement = view !== null && typeof view === 'object' && view.kind === 'element';
      const namespace = isElement && view.tag === 'svg' ? svgNamespace : inheritedNamespace;
      const childNamespace = isElement && view.tag === 'foreignObject' && namespace === svgNamespace
        ? htmlNamespace : namespace;
      const children = plan.children.map(item => commit(item, committed, childNamespace));
      const reused = new Set(plan.children.map(item => item.previous));
      for (const item of previous?.children ?? []) {
        if (!reused.has(item)) release(item);
      }
      if (draft) {
        const { instance, slots } = draft;
        for (const [name, slot] of slots) instance.slots.set(name, slot);
        instance.active = draft.ready = true;
        committed.push(draft);
        return { view, node: children[0].node, children, instance };
      }
      if (view === null) return { view, node: previous?.node ?? doc.createComment(''), children };
      if (typeof view === 'string') {
        const node = previous?.node ?? doc.createTextNode(view);
        if (node.nodeValue !== view) node.nodeValue = view;
        return { view, node, children };
      }
      if (view.kind !== 'element') throw new Error('Missing UI component instance');
      const node = (previous?.node as Element | undefined) ?? (namespace === svgNamespace
        ? doc.createElementNS(svgNamespace, view.tag) : doc.createElement(view.tag));
      const listeners: NonNullable<Live['listeners']> = previous?.listeners ?? new Map();
      const before = previous?.view as ElementView | undefined;
      place(node, previous?.children ?? [], children);
      patchProps(node, before?.props ?? {}, view.props, listeners);
      return { view, node, children, listeners };
    }

    async function render(ticket: number): Promise<void> {
      try {
        const plan = await resolve(asView(root), current, ticket, new Map());
        if (!mounted || ticket !== generation) return;
        const committed: Draft[] = [];
        const namespace = target.namespaceURI === svgNamespace && target.localName !== 'foreignObject'
          ? svgNamespace : htmlNamespace;
        const next = commit(plan, committed, namespace);
        if (current) place(target, [current], [next]);
        else target.replaceChildren(next.node);
        current = next;
        for (const draft of committed) commitEffects(draft);
      } catch (error) {
        if (mounted && ticket === generation && error !== stale) report(error);
      }
    }

    if (routed) {
      window.addEventListener('popstate', schedule);
      window.addEventListener('sesi:web:navigate', schedule);
    }
    schedule();
    return {
      unmount() {
        if (!mounted) return;
        mounted = false;
        if (routed) {
          window.removeEventListener('popstate', schedule);
          window.removeEventListener('sesi:web:navigate', schedule);
        }
        mounts.delete(target);
        if (!current) return;
        release(current);
        if (current.node.parentNode === target) target.removeChild(current.node);
        current = undefined;
      },
    };
  }

  function mount(selector: string, component: Component, props: Props | null = null) {
    return mountRoot(selector, component, props);
  }

  function localPath(to: string): string {
    if (typeof to !== 'string' || !/^\/(?!\/)[^\\\u0000-\u0020]*$/.test(to)) {
      throw new Error('Web navigation expects a root-relative path');
    }
    return to;
  }

  function navigate(to: string): void {
    window.history.pushState(null, '', localPath(to));
    window.dispatchEvent(new Event('sesi:web:navigate'));
  }

  function link(to: string, props: Props | null = null, children: readonly unknown[] = []): ElementView {
    const href = localPath(to);
    const action = props?.on_click as Action | undefined;
    return element('a', { ...props, href, on_click(event: MouseEvent) {
      const result = action?.(event);
      if (!event.defaultPrevented && event.button === 0 &&
          !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
          (!props?.target || props.target === '_self') && (props?.download == null || props.download === false)) {
        event.preventDefault();
        navigate(href);
      }
      return result;
    } }, children);
  }

  function app(selector: string, config: AppConfig) {
    const segments = (path: string) => path.replace(/\/$/, '').slice(1).split('/');
    const routes = config.routes.map(route => {
      const pattern = segments(localPath(route.path));
      const names = pattern.filter(part => part.startsWith(':')).map(part => part.slice(1));
      if (typeof route.component !== 'function' || /[?#]/.test(route.path) ||
          names.some(name => !/^[a-z_][a-z0-9_]*$/i.test(name)) || new Set(names).size !== names.length) {
        throw new Error(`Invalid web route: ${route.path}`);
      }
      return { ...route, pattern };
    });
    const defaultNotFound: Component = () => element('h1', null, ['Page not found']);
    return mountRoot(selector, () => {
      const { pathname: path, search } = window.location;
      const query = Object.assign(Object.create(null), Object.fromEntries(new URLSearchParams(search)));
      const parts = segments(path);
      let params: Record<string, string> = Object.create(null);
      let component = config.not_found ?? defaultNotFound;
      let key = `missing:${path}`;
      for (const [index, route] of routes.entries()) {
        if (route.pattern.length !== parts.length) continue;
        const candidate: Record<string, string> = Object.create(null);
        const match = route.pattern.every((part, offset) => {
          if (!part.startsWith(':')) return part === parts[offset];
          if (!parts[offset]) return false;
          try { candidate[part.slice(1)] = decodeURIComponent(parts[offset]); }
          catch { return false; }
          return true;
        });
        if (!match) continue;
        params = candidate;
        component = route.component;
        key = `${index}:${JSON.stringify(Object.values(params))}`;
        break;
      }
      const routeProps = { path, query, params };
      const page = child(component, routeProps, key);
      return config.layout ? child(config.layout, { ...routeProps, page }) : page;
    }, null, true);
  }

  return { element, child, mount, app, link };
}
