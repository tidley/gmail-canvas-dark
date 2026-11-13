const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
test('packaging storage guard fails closed on the configured machine', () => {
  const result = spawnSync('python3', ['-B', 'tests/package_storage.py'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.error?.message || result.stderr || result.stdout);
});
test('immutable inputs and equivalent supplied payloads', () => {
  const hashes = {
    'gmail_canvas_dark-1.0.4.xpi': '910448a7726fab215e2f52b7b540cde76f6d27cdea026d5b714ac5beb0eae958',
    'gmail-canvas-dark-optimised-unsigned.xpi': 'b48687475d7ea4d78dc93261278576fc082abd8596ecd0bb67b07ba06b2eaf3f',
    'gmail_canvas_dark_optimised_v1_0_5_source.zip': 'b59a8a7ca2b4018eaef50cfeb240fd820154db9c63337e33e0d520e15d06fd6e'
  };
  for (const [file, hash] of Object.entries(hashes)) assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'), hash);
  for (const file of ['LICENSE', 'README.md', 'manifest.json', 'content/theme.js', 'content/theme.css', 'icons/icon-48.png', 'icons/icon-96.png']) {
    assert.deepEqual(fs.readFileSync('reference/supplied-1.0.5-xpi/' + file), fs.readFileSync('reference/supplied-1.0.5-source/gmail-canvas-dark-optimised/' + file));
  }
});
test('candidate retains exact original CSS, icons and licence; identity is distinct', () => {
  for (const file of ['LICENSE', 'content/theme.css', 'icons/icon-48.png', 'icons/icon-96.png']) assert.deepEqual(fs.readFileSync('extension/' + file), fs.readFileSync('reference/original-1.0.4/' + file));
  const m = JSON.parse(fs.readFileSync('extension/manifest.json'));
  assert.equal(m.manifest_version, 3); assert.equal(m.permissions, undefined); assert.equal(m.host_permissions, undefined);
  assert.equal(m.browser_specific_settings.gecko.id, 'gmail-canvas-dark-audit@tidley.invalid');
  assert.equal(m.content_scripts[0].run_at, 'document_start'); assert.equal(m.content_scripts[1].run_at, 'document_idle');
  for (const s of m.content_scripts) { assert.deepEqual(s.matches, ['https://mail.google.com/*']); assert.equal(s.all_frames, true); }
});
