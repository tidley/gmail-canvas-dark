# Candidate architecture and optimisation

## Contracts

The original two-pass background/border then text algorithm, colour thresholds,
link CSS, geometry heuristics, media/image protections, settings/chat/compose,
popup exceptions and Gmail-only matching are retained. CSS is byte-identical:
no-JS behaviour remains marker-based, not generic message recolouring. Only CSS
injection moves to document_start; JS remains document_idle in matching frames.
This supplies early marker rules but does not promise an unpainted white frame.

The bounded Set coalesces ancestor/descendant discovery requests, substitutes one
document scan after 24 disjoint roots, and drops detached nodes at enqueue and
flush. Per-frame root count is bounded, traversal cost and mutation delivery count
are NOT. A background tab may retain at most 24 roots until rAF resumes (or the
document on overflow). WeakMaps hold restoration state and last owned style
attribute strings without independently retaining their DOM keys.

Child additions/removals queue their existing message/semantic context, falling
back to document when unknown. Relevant class/style/visibility/role changes are
observed. Extension data attributes are excluded. A style record equal to the
last extension-written serialized style is ignored. Native serialization of
applied values is recorded so equivalent repeated writes can be skipped even
when Firefox normalizes hex to rgb. Gmail edits to an owned property are not
blindly restored to an old snapshot; a later override captures the new value.

Inbox preservation markers are recomputed each discovery scope. Updates inside
preserved regions escalate outside the outermost marked ancestor, then select an
enclosing message, semantic ancestor, or document. Otherwise enclosing messages
take precedence over nearer semantic roots, preserving aggressive offscreen cell
processing. This prevents stale outer wrappers on SPA reuse. Route listeners remain. The original
click/key and delayed-start/route rescans are deliberately retained: pseudo-class
and stylesheet-only changes cannot reliably be inferred from mutation records.
They are not intervals, but they still create whole-document work. Removing them
is deferred pending Firefox coverage, rather than repeating v1.0.5's regression.

Security posture remains DOM-only: no telemetry, network calls, remote code,
storage, background worker or new permission. The observer watches only the
matching Gmail document; it still has access to sensitive page content. Never
record private mail in tests, profiles shared publicly, screenshots or logs.

## Deliberately not optimised

Each scan still queries descendants and can revisit nested semantic roots;
the two passes still read styles/geometry repeatedly. No cross-pass computed
style cache or permanent processed-node flag is used: inline overrides and Gmail
state changes invalidate those assumptions. No task slicing, aggressive DOM
reordering, global CSS surface rewrite, hiding or inversion was introduced.
Very large newsletters can still block a frame; measure before introducing a
more complex scheduler. Native stylesheet-only state changes outside reference
fallback timing, frame document replacement, and Gmail DOM heuristic drift remain
browser-validation risks, not solved conditions.

## Repeatable simulation

`node benchmarks/compare.cjs 100` runs all three actual scripts in isolated Node
VMs using `tests/dom.cjs`. Data is synthetic. Workloads: nested queued-root burst,
whole newsletter discovery, insertion under an existing message, and style-only
notification. The generated structure contains 101 nodes, alternating table/td
tags, maximum nesting 6, neutral white surfaces, fixed central geometry, no main
ancestor. Run with 500/1000/5000 for scale (can be slow); repeat processes and
record Node version, machine load and all results, not just fastest samples.

It counts actual discovery calls, simulated getComputedStyle calls, style writes,
styled nodes, callbacks explicitly delivered by the harness, pending frames, and
wall duration around queue/mutation plus flush. Observer callback counts are NOT
browser delivery frequency: the harness does not automatically deliver writes.
Timers are not advanced in measured workloads. Initial processing is excluded.
DOM construction and VM startup are excluded. No CPU/heap/GC/layout/paint/Gmail
metrics are measured. Selector implementation and fixed geometry differ greatly
from Firefox. Faster runs that fail to style cells are not improvements.

One worker run, 100 cells (milliseconds, noisy single samples):

| Workload | Original discoveries / styled / ms | Supplied discoveries / styled / ms | Candidate discoveries / styled / ms |
|---|---|---|---|
| Nested roots | 101 / 100 / 109.83 | 1 / 100 / 85.27 | 1 / 100 / 91.81 |
| Newsletter | 1 / 100 / 81.79 | 1 / 100 / 90.49 | 1 / 100 / 77.85 |
| Insertion | 100 / 70 / 47.66 | 20 / 70 / 41.93 | 1 / 100 / 80.26 |
| Style-only | 0 / 0 / 0.03 | 0 / 0 / 0.01 | 1 / 100 / 79.25 |

Nested-root style reads were 1312/1112/1112; writes 203/203/202.
Candidate fixes do MORE work in the previously missed insertion/style workloads.
Raw output from the worker's post-implementation run is retained in
`benchmark-sample.jsonl`; event/timer fallbacks are not driven by this benchmark.
No real-browser performance gain,
long-session heap stability, complete visual parity or eliminated flash is claimed.

## Evidence and remaining gates

Tests were authored before candidate implementation, but red/green execution is
supervisor-owned; no passing tests are claimed by the worker. Synthetic fixture
coverage includes queue bounding/dedup/detachment, two-pass styles/media,
attribute handling/self-write suppression, restoration ownership, SPA reuse,
compose/popup/chat/settings, input/route fallbacks, input hashes and packaging
contracts. Real CSS cascade/inheritance, browser observer delivery and rendering
are NOT reproduced by the Node simulation. Firefox is present on PATH but no
browser test was run. `validation.md` describes the required next measurements.

## Recorded-review revision (qualification pending)

The prior candidate's two context-selection findings and missing-mount packaging
finding have source fixes and focused regression tests. The new fixtures cover
offscreen cells beneath semantic roots inside messages, removal of inbox grids
inside nested dialogs (with and without a main ancestor), and storage rejection
when the configured machine's mount is absent, unmounted, or bypassed by a system
output path. Storage detection uses the existing machine-local shared-rules file
independently of mount existence; outside that environment normal output paths
remain supported when no fastbuild path exists. No configuration is changed.

These new tests have not been executed by this worker. The supervisor must run
the three approved qualification commands and obtain both independent reviews
on the exact revised candidate. Prior benchmark samples are historical, not a
measurement of this context-selection revision. No unsigned package was produced
or live Gmail/browser validation performed for this revision.
