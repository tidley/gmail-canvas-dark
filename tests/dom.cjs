// Deliberately small DOM simulation, not a CSS/layout/browser implementation.
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
  constructor(tag = 'div', attrs = {}, children = []) {
    this.tag = tag; this.attrs = { ...attrs }; this.children = []; this.parentElement = null;
    this.dataset = new Proxy({}, {
      get: (_, k) => this.attrs['data-' + k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())],
      set: (_, k, v) => (this.attrs['data-' + k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())] = v, true),
      deleteProperty: (_, k) => (delete this.attrs['data-' + k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())], true)
    });
    this.values = {}; this.priorities = {}; this.writes = 0; this.textContent = ''; this.events = {};
    this.style = {
      getPropertyValue: p => this.values[p] || '',
      getPropertyPriority: p => this.priorities[p] || '',
      setProperty: (p, v, priority = '') => { this.values[p] = v; this.priorities[p] = priority; this.writes++; },
      removeProperty: p => { delete this.values[p]; delete this.priorities[p]; this.writes++; }
    };
    this.rect = { left: 200, top: 100, width: 800, height: 200, right: 1000, bottom: 300 };
    children.forEach(c => this.append(c));
  }
  append(c) { c.parentElement = this; this.children.push(c); return c; }
  remove() { this.parentElement.children = this.parentElement.children.filter(c => c !== this); this.parentElement = null; }
  get isConnected() { return this.tag === '#document' || Boolean(this.parentElement?.isConnected); }
  contains(c) { for (; c; c = c.parentElement) if (c === this) return true; return false; }
  getAttribute(k) { if (k === 'style') return Object.keys(this.values).sort().map(p => `${p}:${this.values[p]}!${this.priorities[p]}`).join(';'); return this.attrs[k] ?? null; }
  matches(selector) {
    return selector.split(',').some(s => {
      s = s.trim(); if (s === '*') return true;
      let ok = true;
      s = s.replace(/\[([^\s=*\]]+)(\*=|=)?(?:"([^"]*)"|([^\]\s]+))?(?:\s+(i))?\]/g, (_, k, op, a, b, insensitive) => {
        let v = this.getAttribute(k), wanted = a ?? b;
        if (insensitive) { v = v?.toLowerCase(); wanted = wanted?.toLowerCase(); }
        ok &&= op === '=' ? v === wanted : op === '*=' ? Boolean(v?.includes(wanted)) : v !== null;
        return '';
      });
      s = s.replace(/\.([\w-]+)/g, (_, c) => { ok &&= (this.attrs.class || '').split(/\s+/).includes(c); return ''; });
      return ok && (!s || s === this.tag);
    });
  }
  closest(s) { for (let e = this; e; e = e.parentElement) if (e.matches(s)) return e; return null; }
  querySelectorAll(s) { const out = []; for (const c of this.children) { if (c.matches(s)) out.push(c); out.push(...c.querySelectorAll(s)); } return out; }
  querySelector(s) { return this.querySelectorAll(s)[0] || null; }
  getBoundingClientRect() { return this.rect; }
  addEventListener(k, f) { this.events[k] = f; }
}
class Document extends Element { constructor() { super('#document'); this.documentElement = this.append(new Element('html')); this.body = this.documentElement.append(new Element('body')); this.readyState = 'complete'; } }
function rgb(v) { return ({ '#15171a': 'rgb(21,23,26)', '#1b1d21': 'rgb(27,29,33)', '#202328': 'rgb(32,35,40)', '#e7e9ec': 'rgb(231,233,236)', '#bdc1c7': 'rgb(189,193,199)', '#3c4047': 'rgb(60,64,71)', white: 'rgb(255,255,255)', black: 'rgb(0,0,0)' })[v] || v; }
function load(file = 'extension/content/theme.js') {
  const document = new Document(), frames = [], timers = [], events = {}, stats = { discoveries: 0, styleReads: 0, callbacks: 0 };
  let observer;
  const context = { Element, Document, document, location: { hash: '#inbox' },
    window: { innerWidth: 1400, innerHeight: 900, addEventListener: (k, f) => events[k] = f },
    requestAnimationFrame: f => frames.push(f), setTimeout: f => (timers.push(f), timers.length), clearTimeout() {},
    getComputedStyle: e => { stats.styleReads++; return {
      backgroundImage: e.values['background-image'] || e.image || 'none',
      backgroundColor: rgb(e.values['background-color'] || e.bg || 'transparent'),
      color: rgb(e.values.color || e.fg || 'black'),
      ...Object.fromEntries(['Top', 'Right', 'Bottom', 'Left'].map(s => ['border' + s + 'Color', rgb(e.values['border-color'] || e.border || 'black')]))
    }; },
    MutationObserver: class { constructor(f) { this.callback = f; observer = this; } observe(_, options) { this.options = options; } },
    __stats: stats
  };
  let source = fs.readFileSync(file, 'utf8');
  source = source.replace('function discoverAndProcess(start = document) {', 'function discoverAndProcess(start = document) { __stats.discoveries++;');
  source = source.replace(/\}\)\(\);\s*$/, 'globalThis.hooks = { queue, scanRoot, discoverAndProcess, restoreInlineStyles, setImportant, preserveMailListTheme }; })();');
  vm.runInNewContext(source, context, { filename: file });
  return { document, frames, timers, events, stats, location: context.location, hooks: context.hooks, observer,
    flush() { const work = frames.splice(0); work.forEach(f => f()); },
    mutate(records) { stats.callbacks++; observer.callback(records); },
    reset() { frames.length = 0; timers.length = 0; for (const k in stats) stats[k] = 0; }
  };
}
module.exports = { Element, load };
