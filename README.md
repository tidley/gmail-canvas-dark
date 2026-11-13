# Gmail Canvas Dark — unofficial audit candidate

Local work for [tidley/gmail-canvas-dark#1](https://github.com/tidley/gmail-canvas-dark/issues/1).
Based on v1.0.4 attributed to Lobbyx3; not affiliated or endorsed. Modifications
are not Lobbyx3's work. Firefox 140+ on Debian, Gmail's native dark theme, Gmail
only. This is unreviewed source, not an approved or published release.

- `reference/`: complete immutable-input extractions, including original assets,
  notices and signatures. Never install two variants together.
- `extension/`: unsigned MV3 fork with a distinct name and ID; original rendering
  logic/CSS/assets retained, bounded coalescing, nested/attribute mutation handling,
  idempotent style writes and ownership-aware restoration.
- [Audit/provenance/defects](docs/audit.md), [architecture and measurements](docs/architecture.md),
  [manual validation](docs/validation.md), and exact diffs in `docs/`.

## Development and qualification

No dependency installation, transpilation or build framework. Node 24 and Python
standard library suffice. At repository root:

```sh
node --test
python3 scripts/package.py --check
git diff --check HEAD --
node benchmarks/compare.cjs 100
```

In this managed workflow the supervisor, not the worker, runs the first three
commands on a fixed candidate, then obtains two independent exact-candidate
reviews. Authored tests are not passing-test evidence. No CI workflow or retained
release artifacts existed at bootstrap; do not create a second build to publish.
The Node benchmark is a simulation; see limitations in `docs/architecture.md`.

## Unsigned packaging

`--check` validates the explicit seven-file extension-only allowlist, exact
Firefox manifest, ZIP contents and reproducible bytes twice in memory; writes
nothing. Packaging uses sorted fixed members, fixed timestamp/mode, ZIP_STORED
(no zlib version dependency), no signature material. References, docs, tests,
Git and personal files cannot enter the XPI. The archive carries LICENSE/NOTICE.

For an actual retained XPI, first use the configured central build-storage
adapter to obtain an existing output directory, then run:

```sh
python3 scripts/package.py --output-dir /PATH/REPORTED/BY/APPROVED/ADAPTER
```

The script reports the exact artifact path and SHA-256, verifies read-back, and
refuses to overwrite differing artifacts. On this machine `/mnt/fastbuild` must
be mounted and output must be there; do not invent a mapping or silently use
the source/system filesystem. The existing machine-local shared-rules file
identifies this environment even when the mount path is absent; packaging must
then fail closed. No central generic packaging adapter is exposed
to this worker, so **no candidate XPI has been retained yet**. The existing root
unsigned XPI is the supplied v1.0.5, NOT this candidate. Supervisor must resolve
the adapter output path and produce the final reviewed candidate's XPI.

## Installation and publication (not authorised here)

With separate user approval, disable other variants, open
`about:debugging#/runtime/this-firefox`, Load Temporary Add-on, and select the
candidate manifest or unsigned XPI. Temporary loading disappears on restart.
No installation or Gmail access was performed for this task.

Standard Firefox permanent installation requires Mozilla signing: AMO listed
distribution includes a public listing; unlisted signing supports independent
distribution but still requires AMO review/policies and signatures. Neither
means this fork inherits the original's approval. Do not bypass enforcement.
Before signing/publication, resolve licensing, choose/confirm an owned unique
extension ID and clear unofficial display name, preserve credits, and get approval.
The local `.invalid` ID is distinct, not a claim of AMO name/ID availability.

## Licensing limitation

Both supplied LICENSE files say MIT; AMO metadata and supplied README say
MPL-2.0. Original MIT notices are preserved verbatim, without claiming a legal
resolution or dual licence. See `NOTICE` and the audit. No verified Lobbyx3
GitHub upstream repository was found. All work stays local pending approval.
