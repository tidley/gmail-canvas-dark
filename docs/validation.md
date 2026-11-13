# Qualification and manual Firefox validation

## Fixed candidate gates

Supervisor runs at root: `node --test`,
`python3 scripts/package.py --check`, `git diff --check HEAD --`.
The worker did not run these reserved commands. Check results and candidate
snapshot identity must be recorded externally. Then obtain two independent
read-only exact-candidate reviews: (1) original behavioural contracts,
correctness/state/observer lifecycle/errors/security/Firefox compatibility;
(2) tests/regressions/benchmark validity/minimality/scope/licensing/reproducibility.
Fix demonstrated findings in a bounded revision and rerun checks AND both
reviews on the new fixed candidate. Execution success is not review approval.

The configured local skills directory could not be read (external-directory
permission denied). No permission/configuration change or private PAVE access
was attempted to work around that limitation.

No reviews or candidate qualification have yet occurred. No commit, local
integration, push, merge, publication, signature, installation or Gmail access
was performed. The input hashes/source equivalence and Node benchmark output
are worker evidence, not the supervisor's candidate qualification.

## Synthetic Firefox investigation

Firefox executable was found at `/usr/bin/firefox`. No browser or dependency was
installed. Browser automation was not exercised in this worker's permitted
checks; no live browser result exists. With approval, open
`tests/fixtures/newsletter.html?version=original`, `supplied`, `candidate`, and
`css-only` in separate clean Firefox tabs (local file, synthetic content only).
If local-file script restrictions intervene, serve the repository using Python's
standard library HTTP server bound to 127.0.0.1, after permission. Do not expose
the server beyond loopback. The fixture loads only local source/data images,
does not install the extension, and cannot test actual manifest injection timing.

Compare nested table surfaces, coloured panels, text, links, native banner/sidebar,
compose, menus, chat and the image/gradient. After 2 seconds 300 synthetic tables
are inserted, including below the fold; after 3 seconds style/class is changed.
Scroll through all cells; inspect for visible missed patches and persistent
observer loops. Compare the css-only case to the original stylesheet with JS
disabled: it should not generically recolour unmarked mail content.
Use browser performance tools for repeated synthetic runs of identical source,
viewport and fixtures; count mutation callback entries, style recalculations,
layout, long tasks and scripting duration. Report profiling overhead and avoid
equating synthetic Firefox data with Gmail data.

## Live Gmail — user-approved, private session only

Separate approval is mandatory before loading an extension or accessing Gmail.
Use Firefox Debian >=140 and native Gmail dark theme, identical viewport/zoom,
one variant enabled at a time. Keep profiles/screenshots private; share only
redacted measurements with no mail, account IDs, URLs containing private IDs,
labels, subjects or sender data. Do not use private data as a fixture.

1. Establish original v1.0.4 baseline first; record Firefox/OS/version/theme,
   source/package hash and profiling settings. Disable conflicting extensions.
2. Open/close the same messages at least 30 times. Include plain mail, inline
   important white HTML, deeply nested newsletters, saturated brand blocks,
   transparent PNG/logos, background images, inline SVG and offscreen tables.
   Check dark levels, muted/dark text, links, borders, controls and image fidelity.
3. Rapidly navigate inbox/message/back/forward, threads and SPA settings routes.
   Test reused main/list wrappers, open/close menus and keyboard menus, compose
   button/window, settings shallow tabs, dialogs and chat. Verify inbox theme
   translucency, navigation and native banners stay unchanged. Test class/style-
   only reveals, no new-node interactions, hidden tab/resume and detached views.
4. Capture cold load and repeated dynamic opens with frame-by-frame video or a
   browser paint recording. Measure insertion-to-first-dark-paint and count white
   frames relative to original. Record refresh rate and tooling limitations.
   Test document_start CSS separately from idle JS; no blanket hiding is used.
   No white-flash claim is valid without this measurement.
5. Profile matched repeated workloads (same 30 actions, same mail, same warmup).
   Compare scripting CPU, observer callback frequency, selector/style/layout cost,
   frame time and long tasks. Attribute extension work separately where tools
   allow; Gmail and network variance must not be called extension improvements.
6. For a long-session heap investigation, use an isolated approved profile and
   repeated cycles over 1–2 hours. Record JS heap and process memory after a fixed
   idle period at baseline and each cycle. Take private heap snapshots, inspect
   detached DOM retaining paths, compare before/after tool-triggered GC where
   supported, and document instrumentation effects. Queued roots may remain
   until rAF resumes in a background tab. Cache growth, delayed GC or Gmail's own
   heap growth alone is not proof of an extension leak. Retention must be traced
   to this extension and reproduced. Never enable unsafe GC/signature flags.

User must validate actual visual parity and acceptable performance before
integration approval. Failure to establish a safe improvement means retain
reference behaviour or document the unsupported condition; not declare success.

## Packaging and publication status

The worker verified `/mnt/fastbuild` is mounted and read its policy. No generic
central storage adapter is exposed to the worker; no output directory mapping
was invented. No candidate XPI was created. Supervisor must obtain an approved
adapter output directory and run normal packaging on the qualified snapshot,
retain the printed absolute path and SHA-256, then verify those exact bytes for
temporary testing. Signing/permanent installation/publication remain separately
gated, including unresolved licence provenance and name/ID review.
