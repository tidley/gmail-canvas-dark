# Pre-implementation audit — issue #1

## Inputs and provenance

The three root files are immutable. Safely extracted complete archives (including
original Mozilla signature material) are under `reference/`. Paths were checked
for traversal, absolute names and symlinks before extraction.

`reference/.gitattributes` disables only Git's `blank-at-eof` whitespace check
for the three original text signature manifests. Their terminal blank lines
are preserved byte for byte, not cleaned up; all other whitespace checks remain
enabled. This repository metadata is not an extracted archive member.

| Input | SHA-256 |
|---|---|
| gmail_canvas_dark-1.0.4.xpi | 910448a7726fab215e2f52b7b540cde76f6d27cdea026d5b714ac5beb0eae958 |
| gmail-canvas-dark-optimised-unsigned.xpi | b48687475d7ea4d78dc93261278576fc082abd8596ecd0bb67b07ba06b2eaf3f |
| gmail_canvas_dark_optimised_v1_0_5_source.zip | b59a8a7ca2b4018eaef50cfeb240fd820154db9c63337e33e0d520e15d06fd6e |

Original download supplied by the task:
https://addons.mozilla.org/firefox/downloads/file/5066782/gmail_canvas_dark-1.0.4.xpi
Its recomputed hash matches the task's AMO-verified hash. This is not an
independent cryptographic verification of the Mozilla signature.

All seven regular files of the supplied source (after removing its enclosing
directory) match the supplied XPI byte for byte; neither has extra regular files.
Complete JS, CSS, manifests, README and licence text were inspected. CSS, icons
and LICENSE are byte-identical between versions. `supplied.diff` is the exact
unified text diff for common source files (including manifest newline difference).
The diff also includes the complete added supplied README, using zero context
and explicit missing-newline markers.
The supplied archive adds README and omits original META-INF signatures.

Read-only GitHub research: issue #1 was read with `gh issue view --json`.
`gh search repos 'gmail canvas dark user:Lobbyx3'` returned no repositories;
`gh search repos 'user:Lobbyx3'` returned invalid/unavailable user. No verified
Lobbyx3 upstream GitHub repository was established. This is not proof none exists,
nor proof that a similarly named account owns the extension. Attribution to
Lobbyx3 is supplied provenance, not newly verified GitHub identity.

## Architecture and security (both versions)

MV3, Firefox >=140, only `https://mail.google.com/*`, all matching frames,
document_idle CSS/JS; no background worker, storage or extra API permissions.
JS reads DOM text (compose labels), attributes, geometry and computed styles;
therefore it can observe sensitive mail DOM, but contains no collection,
serialization, logging, fetch/XHR/WebSocket/beacon, remote script, eval, telemetry
or extension-originated network calls. Images/backgrounds remain Gmail's
responsibility, not extension network operations. No runtime dependencies.

Discovery preserves visible inbox theme, handles compose, message bodies plus
conversation ancestors, semantic main/dialog/chat/settings/menu/listbox roots,
settings tabs, then geometry-based central surface fallback. Two passes darken
neutral light backgrounds/borders then repair neutral text against final dark
backgrounds. Media and theme/navigation are protected with explicit compose and
popup exceptions. Inline important styles beat sender important declarations.
WeakMap stores original styles; a Set holds pending roots until rAF. Original
observes child additions only and supplements with input/route/startup timers.
The supplied fork changes only scheduling, not visual algorithms.

## Ranked demonstrated findings

1. **High — supplied interaction regression.** Supplied
   `content/theme.js:538-556` observes childList only but removes original
   `content/theme.js:523-533` click/key rescans. Class/style-only UI changes have
   no processing trigger. Removing listeners alone does not preserve behaviour.
2. **Medium — missed nested updates, both.** Original `:512-521`, supplied
   `:538-547` queue added elements only. A plain child inserted inside an existing
   `.a3s` is not itself a message root and discovery does not seek its message
   ancestor (`original :458-496`); aggressive offscreen newsletter processing can
   be missed until a full scan.
3. **Medium — stale inbox protection, both.** Original `:242` sets
   `data-gcd-preserve-theme` but does not clear it when a reused list wrapper
   becomes message content; `:159` then excludes it. Scope-sensitive route
   restoration needs regression coverage.
4. **Medium — repeated whole-document work, original.** `:523-540` schedules two
   document scans per click/navigation key and three delayed scans per route.
   `:499-509` retains nested/detached roots and processes them redundantly.
   Supplied `:501-535` bounds root count to 24 and skips detached roots, but that
   bounds queue size, NOT traversal time: overflow scans the whole document.
5. **Medium — stale restoration, both.** Original `:173-205` remembers only the
   first inline value. Later Gmail inline updates can be overwritten by restoring
   that old snapshot. Restoration must respect changes not owned by us.
6. **Low — redundant reads/writes, both.** Original `:291-369` repeats computed
   style/protection/visibility queries and writes identical important values
   (`:186-189`). Reusing live CSSStyleDeclaration objects across writes or
   caching ancestors across passes would be unsafe; avoid speculative caching.

References above are relative to `reference/original-1.0.4/` or
`reference/supplied-1.0.5-xpi/` as labelled. These are source findings, not measured
Gmail CPU or memory improvements. Strong queued references until rAF and normal
browser cache/GC growth are not by themselves demonstrated leaks.

## Licence and identity

Both original and supplied `LICENSE:1-21` say MIT, copyright 2026 Gmail Canvas
Dark contributors. Task-supplied AMO metadata says MPL-2.0; supplied README:3,23
also claims MPL despite its MIT LICENSE. Preserve both archives and notices;
do not claim a resolved licence or invent Lobbyx3 copyright. Publication needs
provenance/licensing clarification. Candidate must use a distinct name and ID,
explicit unofficial attribution, and must not carry original Mozilla signatures.

## Chosen optimisation direction (recorded before implementation)

Start from 1.0.4, retain all rendering algorithms and CSS. Bound/deduplicate queued
discovery roots, skip detached nodes, process mutations in their existing message
or semantic context, handle relevant attributes without reacting forever to our
own writes, avoid identical writes, and replace input polling-like rescans with
actual mutation signals. Retain route events. Add synthetic tests first.
Do not rewrite into global CSS, invert media, drop settings/chat/compose, or cache
computed styles across mutations. Large scans remain synchronous; incremental
time-slicing would change two-pass rendering semantics and requires browser data.

Implementation decision after inspection: retain original click/key and delayed
startup/route fallbacks until pseudo-class and late-stylesheet cases have Firefox
evidence. Attribute observation alone cannot replace those contracts safely.
The optimisation is narrower than the initial direction above, intentionally.
The candidate changes are recorded in `original-to-candidate.diff`; unchanged
binary assets and every extracted member have hashes in `reference-sha256.json`.

### Early paint decision

Original CSS contains only variables and extension-marker rules; without JS it
does not darken arbitrary message surfaces. Injecting this identical CSS at
document_start is safe and makes marker rules available before JS writes. Keep
JS document_idle to avoid speculative geometry on incomplete Gmail. It cannot
beat existing sender inline important backgrounds before processing; a dynamic
insertion may paint before idle/rAF. No hiding, global colour overrides or layout
changes are justified. White flash elimination and visual parity require live
Firefox frame capture; source reasoning cannot establish them.
