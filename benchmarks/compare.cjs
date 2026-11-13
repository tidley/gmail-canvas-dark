// Actual source executed in a Node VM with tests/dom.cjs, NOT browser metrics.
const { performance } = require('node:perf_hooks');
const { Element, load } = require('../tests/dom.cjs');
const versions = ['reference/original-1.0.4/content/theme.js', 'reference/supplied-1.0.5-xpi/content/theme.js', 'extension/content/theme.js'];
const size = Number(process.argv[2] || 500);
if (!Number.isInteger(size) || size < 1 || size > 10000) throw Error('size must be 1..10000');
for (const file of versions) {
  for (const workload of ['nested-root-burst', 'newsletter', 'nested-insertion', 'style-only']) {
    const h = load(file); h.flush(); h.reset();
    const mail = h.document.body.append(new Element('div', { class: 'a3s' }));
    mail.rect.height = 300;
    const cells = []; let parent = mail;
    for (let i = 0; i < size; i++) {
      const cell = parent.append(new Element(i % 2 ? 'td' : 'table')); cell.bg = 'white'; cells.push(cell);
      // Bounded nesting depth, rather than recursive harness stack exhaustion.
      parent = i % 5 === 4 ? mail : cell;
    }
    const start = performance.now();
    if (workload === 'nested-root-burst') { h.hooks.queue(mail); for (const cell of cells) h.hooks.queue(cell); }
    if (workload === 'newsletter') h.hooks.queue(h.document);
    if (workload === 'nested-insertion') h.mutate([{ type: 'childList', target: mail, addedNodes: cells }]);
    if (workload === 'style-only') h.mutate([{ type: 'attributes', attributeName: 'style', target: mail }]);
    h.flush();
    const durationMs = performance.now() - start;
    console.log(JSON.stringify({ file, workload, nodes: size + 1, maximumNesting: 6, durationMs, ...h.stats,
      styledNodes: cells.filter(c => c.values['background-color']).length,
      styleWrites: [mail, ...cells].reduce((n, c) => n + c.writes, 0), pendingFrames: h.frames.length }));
  }
}
