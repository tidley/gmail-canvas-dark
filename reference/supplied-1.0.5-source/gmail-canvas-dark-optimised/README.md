# Gmail Canvas Dark (Optimised)

Unofficial performance fork of Gmail Canvas Dark 1.0.4 by Lobbyx3. Licensed under MPL-2.0; see LICENSE. Not affiliated with the original developer.

## Changes
- Deduplicate queued DOM mutation roots by ancestor containment.
- Bound pending roots to 24, falling back to one document scan.
- Skip detached DOM elements before processing.
- Remove two full-document rescans on every click and navigation key press.
- Reduce initial delayed rescans from three to one; retain MutationObserver and route-change handling.

## Testing
These are static improvements, not a browser-validated fix. Test message opening, inbox navigation, compose, settings, menus, and chat. Some Gmail interactions that change only CSS classes or inline styles without adding DOM nodes may require a page reload, because click-triggered rescans were removed.

## Firefox temporary installation
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on** and select `manifest.json` from the extracted folder (or select the unsigned `.xpi`).
3. Disable the original extension first to avoid conflicting styles.

Temporary add-ons disappear when Firefox restarts. The `.xpi` is **unsigned** and cannot be installed permanently in standard Firefox without Mozilla signing. For publication, submit a new add-on for signing; do not reuse the original developer's extension ID.

## Development
Inspect and edit `content/theme.js` and `content/theme.css`. Keep the MPL-2.0 licence and original attribution.
