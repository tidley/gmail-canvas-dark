const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Element, load } = require('./dom.cjs');

test('nested roots coalesce, document supersedes, detached roots skipped', () => {
  const h = load(); h.flush(); h.reset();
  const parent = h.document.body.append(new Element()); const child = parent.append(new Element());
  h.hooks.queue(child); h.hooks.queue(parent); h.hooks.queue(child);
  assert.equal(h.frames.length, 1); h.flush(); assert.equal(h.stats.discoveries, 1);
  h.hooks.queue(parent); parent.remove(); h.flush(); assert.equal(h.stats.discoveries, 1);
  h.hooks.queue(h.document.body); h.hooks.queue(h.document); h.flush(); assert.equal(h.stats.discoveries, 2);
});
test('queue overflow is bounded to one document discovery', () => {
  const h = load(); h.flush(); h.reset();
  for (let i = 0; i < 100; i++) h.hooks.queue(h.document.body.append(new Element()));
  h.flush(); assert.equal(h.stats.discoveries, 1);
});
test('nested insertion processes existing message, including offscreen tables', () => {
  const h = load(); h.flush(); h.reset();
  const mail = h.document.body.append(new Element('div', { class: 'a3s' }));
  const cell = mail.append(new Element('td')); cell.bg = 'white'; cell.rect.top = 2000;
  h.mutate([{ type: 'childList', target: mail, addedNodes: [cell] }]); h.flush();
  assert.equal(cell.values['background-color'], '#1b1d21'); assert.equal(cell.values.color, '#e7e9ec');
});
test('nested semantic roots do not mask the enclosing aggressive message scan', () => {
  for (const role of ['main', 'dialog']) {
    const h = load(); h.flush(); h.reset();
    const mail = h.document.body.append(new Element('div', { class: 'a3s' }));
    const nested = mail.append(new Element('div', { role }));
    const cell = nested.append(new Element('td')); cell.bg = 'white'; cell.rect.top = 2000;
    h.mutate([{ type: 'childList', target: nested, addedNodes: [cell] }]); h.flush();
    assert.equal(cell.values['background-color'], '#1b1d21');
    assert.equal(cell.values.color, '#e7e9ec');
    assert.equal(h.stats.discoveries, 1);
  }
});
test('row removal clears preservation outside nested semantic roots', () => {
  for (const withMain of [true, false]) {
    const h = load(); h.flush(); h.reset();
    const container = withMain ? h.document.body.append(new Element('main', { role: 'main' })) : h.document.body;
    const wrapper = container.append(new Element());
    const dialog = wrapper.append(new Element('div', { role: 'dialog' }));
    const grid = dialog.append(new Element('table', { role: 'grid' }));
    const row = grid.append(new Element('tr', { class: 'zA' }));
    h.hooks.discoverAndProcess(h.document);
    assert.equal(wrapper.dataset.gcdPreserveTheme, '1');
    assert.equal(dialog.dataset.gcdPreserveTheme, '1');
    grid.remove();
    const mail = dialog.append(new Element('div', { class: 'a3s' }));
    const cell = mail.append(new Element('td')); cell.bg = 'white'; cell.rect.top = 2000;
    h.reset();
    h.mutate([{ type: 'childList', target: dialog, removedNodes: [grid], addedNodes: [mail] }]); h.flush();
    assert.equal(wrapper.dataset.gcdPreserveTheme, undefined);
    assert.equal(dialog.dataset.gcdPreserveTheme, undefined);
    assert.equal(grid.contains(row), true);
    assert.equal(cell.values['background-color'], '#1b1d21');
    assert.equal(cell.values.color, '#e7e9ec');
    assert.equal(h.stats.discoveries, 1);
  }
});
test('attribute updates handled; own style mutations do not reschedule', () => {
  const h = load(); h.flush(); h.reset();
  assert.equal(h.observer.options.attributes, true);
  const mail = h.document.body.append(new Element('div', { class: 'a3s' }));
  const cell = mail.append(new Element('td')); cell.bg = 'white';
  h.mutate([{ type: 'attributes', attributeName: 'class', target: cell }]); h.flush();
  assert.equal(cell.values.color, '#e7e9ec');
  h.mutate([{ type: 'attributes', attributeName: 'style', target: cell }]);
  assert.equal(h.frames.length, 0);
  cell.style.setProperty('background-color', 'white');
  h.mutate([{ type: 'attributes', attributeName: 'style', target: cell }]); h.flush();
  assert.equal(cell.values['background-color'], '#1b1d21');
});
test('two-pass colours, images, coloured surfaces and identical writes', () => {
  const h = load(); h.flush();
  const mail = h.document.body.append(new Element('div', { class: 'a3s' }));
  const table = mail.append(new Element('table')); table.bg = 'white'; table.border = 'white';
  const cell = table.append(new Element('td')); const image = cell.append(new Element('img'));
  const logo = cell.append(new Element()); logo.image = 'url(synthetic-logo)'; logo.bg = 'white';
  const colour = cell.append(new Element()); colour.bg = 'rgb(255,0,0)';
  h.hooks.scanRoot(mail, { forceRoot: true, aggressive: true });
  assert.equal(table.values['background-color'], '#1b1d21'); assert.equal(cell.values.color, '#e7e9ec');
  assert.equal(table.values['border-color'], '#3c4047'); assert.deepEqual(image.values, {});
  assert.equal(logo.values['background-color'], undefined); assert.equal(colour.values['background-color'], undefined);
  const before = mail.writes; h.hooks.scanRoot(mail, { forceRoot: true, aggressive: true }); assert.equal(mail.writes, before);
});
test('restoration does not overwrite newer Gmail style and remembers updated originals', () => {
  const h = load(); const e = h.document.body.append(new Element());
  e.style.setProperty('color', 'black'); h.hooks.setImportant(e, 'color', '#e7e9ec');
  e.style.setProperty('color', 'red'); h.hooks.restoreInlineStyles(e); assert.equal(e.values.color, 'red');
  h.hooks.setImportant(e, 'color', '#e7e9ec'); h.hooks.restoreInlineStyles(e); assert.equal(e.values.color, 'red');
});
test('reused inbox wrapper loses stale protection after rows disappear', () => {
  const h = load(); const main = h.document.body.append(new Element('main', { role: 'main' }));
  const wrapper = main.append(new Element()); const grid = wrapper.append(new Element('table'));
  const row = grid.append(new Element('tr', { class: 'zA' }));
  h.hooks.discoverAndProcess(h.document); assert.equal(wrapper.dataset.gcdPreserveTheme, '1');
  row.remove(); wrapper.attrs.class = 'a3s'; h.hooks.discoverAndProcess(h.document);
  assert.equal(wrapper.dataset.gcdPreserveTheme, undefined); assert.equal(wrapper.values['background-color'], '#15171a');
});
test('compose, popups, settings navigation, chat and route triggers retained', () => {
  const h = load(); const nav = h.document.body.append(new Element('nav')); nav.rect.left = 0;
  const compose = nav.append(new Element('button', { gh: 'cm' }));
  const popup = nav.append(new Element('div', { role: 'menu' }));
  const chat = h.document.body.append(new Element('div', { role: 'dialog', 'aria-label': 'chat' }));
  h.hooks.discoverAndProcess(h.document);
  assert.equal(compose.values['background-color'], '#202328'); assert.equal(nav.values['background-color'], undefined);
  assert.equal(popup.values['background-color'], '#15171a'); assert.equal(chat.values['background-color'], '#15171a');
  assert.equal(typeof h.events.hashchange, 'function'); assert.equal(typeof h.events.popstate, 'function');
});
test('reference interaction and late paint fallbacks retained without polling', () => {
  const h = load(); assert.equal(h.timers.length, 3); h.flush(); h.reset();
  h.document.events.click(); assert.equal(h.timers.length, 2);
  h.document.events.keydown({ key: 'x' }); assert.equal(h.timers.length, 2);
  h.document.events.keydown({ key: 'Enter' }); assert.equal(h.timers.length, 4);
  h.timers.splice(0).forEach(f => f()); assert.equal(h.frames.length, 1);
});
test('background image root, native banner, dark and saturated text remain intact', () => {
  const h = load(); const banner = h.document.body.append(new Element('div', { role: 'banner' })); banner.bg = 'white';
  h.hooks.scanRoot(banner, { forceRoot: true, aggressive: true }); assert.deepEqual(banner.values, {});
  const mail = h.document.body.append(new Element('div', { class: 'a3s' })); mail.image = 'url(synthetic)'; mail.bg = 'white';
  h.hooks.scanRoot(mail, { forceRoot: true, aggressive: true }); assert.equal(mail.values['background-color'], undefined);
  const e = h.document.body.append(new Element()); e.bg = 'rgb(20,20,20)'; e.fg = 'rgb(0,50,255)';
  h.hooks.scanRoot(e, { aggressive: true }); assert.equal(e.values.color, undefined); assert.equal(e.values['background-color'], undefined);
});
test('settings shallow navigation is retained', () => {
  const h = load(); h.location.hash = '#settings/general';
  const nav = h.document.body.append(new Element('nav')); nav.bg = 'white'; nav.rect.height = 40;
  h.hooks.discoverAndProcess(h.document); assert.equal(nav.values['background-color'], '#15171a');
});
test('static rendering fixture agrees with original important properties', () => {
  function render(file) {
    const h = load(file); const main = h.document.body.append(new Element('main', { role: 'main' }));
    const mail = main.append(new Element('div', { class: 'a3s' }));
    const table = mail.append(new Element('table')); table.bg = 'white';
    const cell = table.append(new Element('td')); cell.border = 'white';
    const link = cell.append(new Element('a')); const image = cell.append(new Element('img'));
    const button = main.append(new Element('button')); button.bg = 'white';
    h.hooks.discoverAndProcess(h.document);
    return [main, mail, table, cell, link, image, button].map(e => ({ ...e.values }));
  }
  assert.deepEqual(render('extension/content/theme.js'), render('reference/original-1.0.4/content/theme.js'));
});
test('normalised CSS values are idempotent and re-applied ownership captures Gmail edits', () => {
  const h = load(); const e = h.document.body.append(new Element());
  const set = e.style.setProperty;
  e.style.setProperty = (p, v, priority) => set(p, v === '#e7e9ec' ? 'rgb(231, 233, 236)' : v, priority);
  e.style.setProperty('color', 'black'); h.hooks.setImportant(e, 'color', '#e7e9ec');
  const writes = e.writes; h.hooks.setImportant(e, 'color', '#e7e9ec'); assert.equal(e.writes, writes);
  e.style.setProperty('color', 'red'); h.hooks.setImportant(e, 'color', '#e7e9ec');
  h.hooks.restoreInlineStyles(e); assert.equal(e.values.color, 'red');
});
