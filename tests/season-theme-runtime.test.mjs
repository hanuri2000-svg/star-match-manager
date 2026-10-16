import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const engine = fs.readFileSync(new URL('../season-theme.js', import.meta.url), 'utf8');
const dataKey = name => name.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());

// A deliberately small DOM fixture exercises the production engine without a
// browser dependency. Browser geometry remains a separate visual QA check.
class Element {
  constructor(tag) {
    this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {};
    this.events = {}; this.className = ''; this.textContent = ''; this.hidden = false;
    this.style = new Map();
    this.style.setProperty = this.style.set.bind(this.style);
    this.style.removeProperty = this.style.delete.bind(this.style);
  }
  appendChild(child) { child.parent = this; this.children.push(child); return child; }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  insertBefore(child, before) {
    child.parent = this;
    const i = this.children.indexOf(before);
    this.children.splice(i < 0 ? this.children.length : i, 0, child);
  }
  get firstChild() { return this.children[0] || null; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  setAttribute(name, value) {
    if (name.startsWith('data-')) this.dataset[dataKey(name)] = value;
    else this.attributes[name] = value;
  }
  hasAttribute(name) { return name.startsWith('data-') ? dataKey(name) in this.dataset : name in this.attributes; }
  addEventListener(type, fn) { this.events[type] = fn; }
  focus() {}
  contains(node) { return node === this || this.children.some(child => child.contains(node)); }
  matches(selector) {
    if (selector.startsWith('.')) return this.className.split(/\s+/).includes(selector.slice(1));
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('[')) return this.hasAttribute(selector.slice(1, -1));
    return this.tagName === selector;
  }
  querySelectorAll(selector) {
    const [first, ...rest] = selector.split(' ');
    const all = this.children.flatMap(child => [child, ...child.querySelectorAll('*')]);
    if (selector === '*') return all;
    const matches = all.filter(child => child.matches(first));
    return rest.length ? matches.flatMap(child => child.querySelectorAll(rest.join(' '))) : matches;
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function fixture(mode = 'auto') {
  const root = new Element('html'), body = new Element('body'), app = new Element('main');
  app.id = 'app'; root.append(body); body.append(app);
  const head = new Element('header'), actions = new Element('div');
  head.className = 'head'; actions.className = 'actions'; head.append(actions); app.append(head);
  const toolbar = new Element('div'), title = new Element('h2');
  toolbar.className = 'schedule-toolbar'; toolbar.append(title); app.append(toolbar);
  const oldHero = new Element('div'); oldHero.className = 'season-hero-badge'; head.append(oldHero);
  const stored = new Map([['dorang-season-theme.v1', JSON.stringify({mode, effect: 'subtle'})]]);
  const events = {}, observers = [];
  const document = {
    documentElement: root, body,
    createElement: tag => new Element(tag),
    getElementById: id => root.querySelector('#' + id),
    querySelector: selector => root.querySelector(selector),
    querySelectorAll: selector => root.querySelectorAll(selector),
    addEventListener: (event, fn) => { events[event] = fn; }
  };
  const window = {addEventListener: (event, fn) => { events[event] = fn; }};
  vm.runInNewContext(engine, {
    document, window, location: {search: ''}, URLSearchParams, Intl, Date,
    localStorage: {getItem: key => stored.get(key), setItem: (key, value) => stored.set(key, value)},
    MutationObserver: class { constructor(fn) { observers.push(fn); } observe() {} },
    setInterval() {}
  });
  const switchMode = value => {
    document.querySelector('[data-season-theme-open]').events.click();
    const select = document.querySelector('[data-season-mode]');
    select.value = value; select.events.change();
  };
  return {root, body, head, app, title, document, window, events, observers, stored, switchMode};
}

for (let month = 1; month <= 12; month++) {
  test(`${month}월: announcement card stays absent through startup, rerender, and reload`, () => {
    const f = fixture(String(month));
    assert.equal(f.window.DorangSeasonTheme.getMonth(), String(month));
    assert.equal(f.document.querySelector('.season-hero-badge'), null);
    assert.ok(f.root.style.get('--season-bg'));
    assert.match(f.root.style.get('--season-banner-image'), new RegExp(`${String(month).padStart(2, '0')}\\.svg`));
    assert.equal(f.title.querySelector('.season-calendar-symbol').dataset.month, String(month));
    assert.equal(f.document.getElementById('season-scene').children.length, 6);
    const stale = new Element('div'); stale.className = 'season-hero-badge'; f.head.append(stale);
    f.observers.forEach(fn => fn());
    assert.equal(f.document.querySelector('.season-hero-badge'), null);
    f.events.pageshow();
    assert.equal(f.document.querySelectorAll('.season-calendar-symbol').length, 1);
    const reload = fixture(JSON.parse(f.stored.get('dorang-season-theme.v1')).mode);
    assert.equal(reload.document.querySelector('.season-hero-badge'), null);
  });
}

test('all manual months, off, and automatic mode switch without reviving the card', () => {
  const f = fixture('off');
  assert.equal(f.document.querySelector('.season-hero-badge'), null);
  for (let month = 1; month <= 12; month++) {
    f.switchMode(String(month));
    assert.equal(f.window.DorangSeasonTheme.getMonth(), String(month));
    assert.equal(f.document.querySelector('.season-hero-badge'), null);
    assert.equal(f.document.querySelectorAll('.season-calendar-symbol').length, 1);
  }
  f.switchMode('off');
  assert.equal(f.window.DorangSeasonTheme.getMonth(), null);
  assert.equal(f.document.querySelector('.season-calendar-symbol'), null);
  assert.equal(f.document.getElementById('season-scene'), null);
  f.switchMode('auto');
  const month = String(Number(new Intl.DateTimeFormat('en-US', {timeZone: 'Asia/Seoul', month: 'numeric'}).format(new Date())));
  assert.equal(f.window.DorangSeasonTheme.getMonth(), month);
  assert.equal(f.document.querySelector('.season-hero-badge'), null);
});
