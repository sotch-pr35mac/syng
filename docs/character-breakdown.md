# Character breakdown

Accepted implementation direction, 2026-10-25. Preston authorized implementation
following the design exploration. The 2026-10-26 refinement removes automatic
opening from every surface. This document records the resulting content contract
and maintenance workflow.

## Content contract

- Formation and component notes are the pinned Dong Chinese `hint` strings, trimmed
  only. Component roles use the source terminology, including **Iconic**. There are
  no generated explanations and no inline dictionary-gloss fallbacks.
- A whole character record is verified only when `isVerified === true` upstream.
  Unverified formation/role data is available manually, labeled “Unverified by Dong
  Chinese”. That status does not qualify independently sourced dictionary entries.
- Exact matches in the installed dictionary determine link availability. Prefix
  matches cannot make a component/radical linkable. Full meanings live in the
  dictionary lookup, including all exact senses of 青.
- `◎` denotes an unnamed component; show its source strokes when mapped. Never
  invent a component name. Empty/deleted fragments can still have a source role or
  note. Invalid mappings disable highlighting, without discarding the text.
- Preserve each source's rights and attribution separately. The data manifest and
  notices accompany the app and appear in Settings → Acknowledgements.
  Dong Chinese (CC BY-SA 4.0) and Make Me a Hanzi dictionary data (LGPL-3.0-or-later)
  have separate expandable entries with source-specific notices and full license
  texts. The existing Arphic graphics acknowledgement is separate. Source links
  appear inside the expanded entries so they do not hide the license text.

## Interaction contract

Blocks follows Brush in the existing entry action bar. Desktop Search/Bookmarks
use a companion within DictionaryContent below the route's action bar. At widths
of at least 38.75rem, the Blocks button opens the sidebar manually. An explicitly
opened sidebar follows subsequent entries without reanimating. Once closed, it
stays closed until Blocks is clicked again. Only visibility changes animate.
On iPad, narrowing an open companion into a replacement view adds its Back steps;
widening removes those steps while preserving the open panel and selection.
History traversals are serialized so rapid size changes do not close the panel.

Popup dictionaries replace their content in the existing 420×380 popup or mobile
sheet, with Back. They never open breakdown automatically or create a second
sheet. Nested component lookups retain a stack of entry/breakdown views, script,
character index, pinned component, result index, scroll and focus. The sheet's
existing snap position remains in place. Mobile full entries use `/breakdown`;
Back, edge swipe and browser/native back return to the origin. Revealed study
answers use manual replacement; nothing is added to unrevealed prompts.
Popover and nested lookups share one resolver: canonical lexical IDs select their
referenced entry, while text-only references use Chinese lookup. Component/radical
availability uses the same resolver with exact matching. Opening a breakdown
focuses its first control after the lazy panel mounts, without stealing focus if
the view has since closed or changed.

Internal chevrons retain repeated and unsupported characters; the whole navigation
row is omitted for single-character entries. Formation and component prose link
Chinese text to dictionary lookups without rewriting the source. Component and
radical controls use blue without underlining; other links keep their usual style.
Source links and license texts live in Settings → Acknowledgements. Initial script is
the dictionary preference (Both starts simplified); the local form switch keeps
the index where possible and clears component selection. Component controls stay
in two columns and note height is reserved across hover changes. The whole glyph
resolves to the nearest mapped stroke median with boundary tolerance. Component
selection and dictionary lookup have separate buttons.

The Search-icon “Look up this character” action beneath the enlarged glyph looks
up the selected character and script, including when formation data is unavailable.
It opens the popup from a sidebar or a mobile breakdown screen, keeping the
breakdown and selection underneath. Mobile study breakdown links also use their
existing popup dictionary. Within a popup, lookups use its nested entry/Back flow.
These rules also apply to component, radical and description links. Exact matching
excludes prefix results for component/radical and selected-character lookups.
Both the app tour and dictionary/search tour spotlight Blocks after Brush;
opening breakdown pauses the guide, which can resume at the same step.

Stroke playback, the earlier Explore section, wider popup experiment, generated
prose, persistent preferences and dataset updates at runtime are outside this
feature. Stroke count remains a static fact. The existing Brush action is intact.

## Rebuild the offline data

Initialize the pinned `src/views/resources/hanzi-writer-data` submodule. Obtain the
Dong JSONL and Make Me a Hanzi dictionary from the URLs in
[`manifest.json`](../src/views/resources/character-breakdown/manifest.json).
The importer verifies both complete-file SHA-256 hashes and the graphics revision
before writing output. A changed upstream file is rejected; do not silently update
the checksum. Retain/download the exact version when reproducing an older bundle.

```sh
node scripts/prepare-character-breakdown.mjs /path/to/dictionary_char_2025-12-27.jsonl /path/to/dictionary.txt
npm run test:character-data
```

Only selected fields and eligible modern vector sources are imported. A small
index supplies record availability and verified-content flags; individual hexadecimal filenames
load on demand. Exact matching bundled geometry is reused. Other source geometry
is retained with its mapping, preventing indices from being applied to the wrong
outline. No network request is needed to use breakdown.

The pinned output has 9,923 records, 3,499 records flagged for verified formation/components, 235 retained vector
sets and 154 disabled source mappings. See the manifest for the full report.
The code adds about 27 KiB raw / 14 KiB gzip JavaScript to the pre-feature build;
source records are not JavaScript chunks.

## Verification

`npm run test:character-data` validates malformed mappings and every shipped
record against its actual graphics. Unit tests cover forgiving hit regions and
exact dictionary lookups. `npm run test:a11y -- breakdown.spec.ts` exercises real
bundled records in Chromium/WebKit, including repeated characters, missing data,
popup/mobile Back, pinned selection, scroll restoration and enlarged-text contrast.
Native acknowledgement tests compare bundled notices across desktop, Android,
Apple and frontend resource locations.


## Desktop development graphics

Use `make start`, which runs `cargo tauri dev --no-dev-server`. Tauri CLI 2.12.1's
built-in static server joins the encoded URL path directly to the filesystem;
requests for Chinese-named stroke JSON files fall back to `index.html`. This
breaks both breakdown highlighting and the existing Brush animation. Desktop
development now uses Tauri's embedded asset handler, which decodes these paths,
as release builds do. Restart `make start` after rebuilding frontend assets.
Embedded development also enforces the app's Content Security Policy. Its
`connect-src` permits same-origin data requests and Tauri's local IPC endpoints
(`ipc:`, `http://ipc.localhost`, and `https://ipc.localhost`). Without those IPC
sources, the webview rejects native calls and Tauri falls back to postMessage.
Breakdown loading failures are logged with the character and requested asset
path instead of silently falling back to a font glyph.
The native asset regression checks the actual embedded graphics for 试, 考, 西
and 要. 西 has no source component mapping, so its drawing has no part highlights.

The popup breakdown header retains Back on the left and Close (X) on the right.
Its title remains available as the accessible region label. Component hover covers
the whole card, including unnamed fragments and padding.


## Breakdown telemetry

`dictionary.breakdown_opened` and `dictionary.breakdown_closed` describe one visit
from opening breakdown until it is closed or its containing view is left. Nested
entries and Back within that visit do not close/reopen it. Layout resizing updates
surface context without another lifecycle event. A mobile route emits its open
from the breakdown screen, not also from its originating Blocks button. Closing
reasons are `back`, `dismissed` (explicit X/desktop Blocks toggle), and `navigation`
(route changes, containing popup dismissal, or unmount). A later cleanup cannot
emit a second close.

`dictionary.breakdown_interacted` records explicit `character_lookup`,
`component_lookup`, `radical_lookup`, `description_lookup`, `character_changed`,
`script_changed`, `component_selected`, `component_deselected`,
`nested_breakdown_opened`, `entry_changed`, and `retry` actions. The selected glyph,
component cards and keyboard focus also produce `component_previewed`, limited to
one event per component/character-position/script per visit; changing the entry
or opening a nested breakdown resets that preview set. Pointer movement does not
produce an unbounded stream of hover events.

Payloads are explicitly copied from a metadata allowlist: surface, static source,
character count, action, one-based character/component positions, script and input
kind. They contain no words, glyph text, definitions, lexical IDs, document/list
IDs or URLs. Surface is `sidebar`, `entry`, `popup`, `mobile_screen`, or `study`.
Native telemetry settings continue to govern collection; no separate opt-in or
transport is introduced. Walkthrough-triggered openings use the same events.
The `/breakdown` route also uses the existing `character_breakdown` screen-view
name, governed by the separate screen-view telemetry preference.

Lookup interactions record the user's action consistently on every surface,
including a lookup with no result. They are distinct from the existing
`dictionary.word_opened` measurement of a successful entry opening; ordinary
popover controllers can additionally emit that event. Do not sum both event
families to count breakdown lookup actions.
