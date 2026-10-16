# Accessibility implementation and verification

This pass improves Syng toward WCAG 2.2 AA using its existing components, routes, and theme. It is not a claim of complete WCAG conformance. Automated checks cover specific controls and flows; native assistive-technology testing remains necessary.

## Current assessment — October 16, 2026

**Owner closeout:** after reviewing the remaining limitations, the owner accepted the current implementation and closed this accessibility pass: “let's keep it as it is now” and “our accessibility work for now is done.” Preserve the current appearance and controls. Remaining audit, contrast-entry, gesture, and timing items are deferred to future work; completion of this pass is not a claim of full WCAG conformance.

**Status: substantial accessibility improvements implemented, with passing automated coverage for the tested surfaces. Full WCAG 2.2 AA conformance is not established.** Increase Contrast is a useful optional presentation, but does not by itself make the entire app conformant.

This assessment reviews the current source, the original Accessibility Improvement Plan, and the recorded verification below. It does not represent a new full test run or a completed assistive-technology audit. No production behavior was changed for this assessment.

| Area                         | Current result                               | Evidence and limits                                                                                                                                                                                                                                        |
| ---------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contrast appearance          | Passes tested palette pairs                  | Normal text at least 4.54:1; light filled-control white labels at least 4.60:1; tested icons/control boundaries at least 3.08:1. Light/dark shared-control fixtures have no axe violations. This does not cover every rendered route or imported document. |
| Original appearance          | Preserved; some contrast targets not met     | Bright colors, white filled-control labels, search-row hover, matching toggles, and subtle input borders are retained. Original is not asserted to pass AA contrast.                                                                                       |
| Keyboard and shared controls | Implemented; covered interactions pass       | Native activation, names/states, tab navigation, keyboard focus, tooltip dismissal, and route-focus behavior have targeted coverage. Full task completion on every route/platform remains unverified; mobile Reader page turning is a known gap.           |
| Dialogs and popovers         | Covered flows pass                           | Initial focus, focus containment, background isolation, nested portals, Escape, and focus return have component/browser coverage. Native screen-reader behavior remains unverified.                                                                        |
| Screen-reader semantics      | Implemented; manual validation pending       | Landmarks, headings, control labels, active states, and search/quiz/page announcements are present. Correct reading order, announcement timing, and practical usability still need VoiceOver, TalkBack, NVDA, and Orca checks.                             |
| Enlarged text and reflow     | Covered layouts pass                         | Tested fixtures at 200% root text size and narrow layouts, including 320px Reader import/control coverage. Real OS sizing, full Reader content, software keyboards, and all routes still need device checks.                                               |
| Motion and forced colors     | Support implemented; platform checks pending | Reduced-motion styles, Reader animation handling, and forced-color overrides exist. This is not a complete platform or criterion-level audit.                                                                                                              |

### Specific remaining issues

1. **Access to Increase Contrast needs one further contrast review.** Its label and Settings/General entry points have tested contrast, but the shared Original light-mode off track (`#9a9b9c`) against the white knob/background is **2.78:1**, below the 3:1 non-text target for the state indicator; against `#f5f5f5` it is 2.55:1. The former special darker switch palette was removed to match the other toggles. This is a localized conformance issue, not a reason to recolor the whole Original theme. A conforming alternate presentation requires an accessible way to reach it and must itself satisfy all applicable requirements. See [Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) and [G174](https://www.w3.org/WAI/WCAG22/Techniques/general/G174).
2. **Gesture alternatives remain deferred.** The mobile Reader currently wires page turning to the swipe action; the inspected mobile route/controller expose no next/previous tap control or keyboard page-turn binding. Mobile flashcards do have explicit navigation controls. Swiping can remain, but functionality available only through a directional gesture cannot be marked as passing the alternative-input requirements. The sheet also has keyboard resizing, while a simple pointer resize alternative remains unaudited. See [Pointer Gestures](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html).
3. **Quiz timing remains deferred.** Pause/resume controls now have native keyboard behavior and accessible names. Durations and automatic progression are unchanged; a complete Timing Adjustable assessment, including how users disable/adjust/extend limits and whether an exception applies, remains open for the quiz update. See [Timing Adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html).
4. **End-to-end and device verification remains open.** Complete Search, Bookmarks, Reader, Study, Tools, Settings, and onboarding with assistive technology and enlarged text. Include tone meaning without color alone, text-spacing overrides, focus obscured by overlays/keyboards, target size, error recovery, and imported-content semantics. These are audit items, not established failures.

Ghost inputs do not automatically fail because their inner outline is absent: W3C includes a visible text insertion caret or selected text as examples of focus indication. Check that these remain discernible in the actual webviews, including empty fields. Heavy permanent input borders are not universally required. See [Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html).

### Latest recorded verification

- After the October 16 styling corrections: **115 focused frontend tests** and **26 Chromium/WebKit browser tests** passed. Covered Contrast fixtures and the scoped Original appearance-control scan had no axe violations. Axe results do not establish the switch's non-text contrast or whole-app conformance.
- Type checking, lint, formatting, production build, and bundle budgets passed with those corrections.
- The last full frontend run was **741 tests across 114 suites on October 15**, before the final styling corrections. The earlier native run passed **177 tests**; native code was not changed by the appearance corrections.
- CI is configured to run the browser suite; this report does not assert a remote CI run or release-device certification.

If accessibility work is reopened, useful validation would include representative task testing with a low-vision user and the supported screen readers, alongside the localized contrast-entry review. These are future recommendations, not outstanding tasks in the closed implementation pass. The recorded limitations still prevent an unqualified conformance claim.

## Accepted direction

Accepted by the app owner during the accessibility planning conversation, implemented October 15, 2026:

- Preserve Syng's architecture, Montserrat, component styling, and familiar color families. Following palette review, retain Original as the default and offer a saved Increase contrast switch. Contrast uses shared semantic theme tokens; Original retains bright colors and white filled-control labels. The owner accepted this selectable direction on October 15, 2026 after rejecting several replacement palettes as harder to read.
- Show focus indicators for keyboard navigation using browser `:focus-visible` heuristics. Ordinary button clicks/taps stay visually quiet; bounded text-entry controls retain focus treatment. Ghost fields remain intentionally unbounded without an inner outline. Older webviews receive a feature-detected fallback.
- Follow operating-system sizing without an interface-size preference, page zoom, pinch zoom, or new shortcuts. Reader's existing 50–150% content setting remains independent.
- Keep swipe navigation, quiz timer durations, and automatic progression. Broader quiz changes and gesture alternatives are deferred.
- Retain iOS 15.0 support. Use feature detection for focus-visible/inert and available-width layout measurement instead of requiring container queries.
- On macOS, retain native display scaling. There is no new unsupported text-size bridge.

These decisions favor targeted semantic and behavioral fixes over a visual redesign. Stronger foreground contrast is optional; keyboard focus and layouts that wrap or stack remain available in both appearances.

## Implementation

| Area            | Behavior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Theme           | Original and Contrast each follow system light/dark appearance. Increase Contrast is available under Settings → General and during onboarding, applies immediately, and is saved without restarting. The setting uses the same toggle palette as other preferences; its title, Settings entry, and General tab remain readable in Original. Original retains subtle input borders; Contrast strengthens them through shared theme tokens. Contrast uses theme tone defaults; saved custom colors return in Original. Reader presets remain independent. |
| Controls        | Existing SyButton, SyTextInput, SyToggle, and SyTab expose native names/states/events. Toggles use native checkboxes; tablists support arrows, Home, and End.                                                                                                                                                                                                                                                                                                                                                                                           |
| Navigation      | Named landmarks, active-route state, skip links, page titles, and destination focus after keyboard navigation. Tooltips work with keyboard focus, Escape dismissal, and a scrolling sidebar.                                                                                                                                                                                                                                                                                                                                                            |
| Overlays        | Named dialogs, initial focus, modal focus containment, background isolation, Escape, focus restoration, and owned nested portals. Nonmodal sheets reveal focused content without changing swipe behavior.                                                                                                                                                                                                                                                                                                                                               |
| Feature screens | Search result/busy announcements; named dictionary, bookmark, Reader, and character actions; labeled notes/inputs; Settings/Tools tab panels; quiz result/state announcements and native keyboard activation.                                                                                                                                                                                                                                                                                                                                           |
| Enlarged text   | App typography uses scalable units; headers/actions wrap, dialogs stay bounded, and constrained panes stack. Reader remeasures pagination while preserving its location when UI text size changes.                                                                                                                                                                                                                                                                                                                                                      |

The implementation was divided into theme/native sizing, controls/Reader, and overlays/Settings/Tools/Study workstreams, with a single integrator owning app shells, cross-cutting behavior, browser coverage, and final checks.

The stroke-animation library now loads inside the existing character loader when needed. This keeps the added accessibility behavior within the unchanged startup bundle budget without changing routes or component architecture.

## Platform sizing

- **iOS:** `UIFontMetrics` supplies the scaled value for the existing 16px app baseline. Content-size and foreground notifications update all webviews; revisions prevent a stale initial snapshot from overwriting a newer change. The frontend refreshes on resume and retains its last valid value if an API fails. [Apple guidance](https://developer.apple.com/documentation/uikit/scaling-fonts-automatically)
- **Windows:** WebView2 already incorporates OS text scale into its native rasterization scale. Syng does not apply a second CSS multiplier or change page zoom. [WebView2 API](https://learn.microsoft.com/en-us/microsoft-edge/webview2/reference/win32/icorewebview2controller3#get_rasterizationscale), [Microsoft clarification](https://github.com/MicrosoftEdge/WebView2Feedback/issues/3699)
- **Android:** Keep the WebView's existing system font scaling; do not multiply it again.
- **macOS/Linux:** Keep native display/webview scaling. No additional text-only multiplier is introduced.

Native engine scaling can enlarge the whole rendered page, including Reader. This change does not counteract that system behavior or alter Reader's saved 50–150% value.

## Repeatable checks

```sh
make check
make test
```

Browser tests use real Chromium and WebKit with axe, keyboard input, and layout assertions:

```sh
npx playwright install chromium webkit
npm run test:a11y
```

The browser job is configured in CI. Fixtures cover shared controls in Contrast light/dark appearance at 16px and 32px, keyboard versus pointer focus, nested dialogs and portaled menus, tooltip clipping, a 320px-wide enlarged layout, and real Reader card/import controls. Appearance coverage checks the switch in Original, Contrast tones/results, saving/reloading, cross-window changes, original white labels, and restored hover/ghost-field behavior. Screenshots are written to ignored `test-results/`; traces are retained on failure.

To compare default styling against an older checkout, set `SYNG_ACCESSIBILITY_SOURCE_ROOT` to that checkout and run the Chromium project. This selects the compatible baseline fixture and captures both appearances; it does not replace the regular accessibility suite.

## Verification record

Recorded checks and remaining device checks are listed here so automated coverage is not confused with screen-reader certification. The following counts describe the initial implementation before the selectable-appearance revision; its verification is recorded separately below.

- `make check`: passed formatting, lint, type checks, native Clippy, production build, and all bundle budgets. The initial shell graph is 260.8 KiB against the existing 280 KiB limit.
- Frontend tests: 700 passed across 111 suites, including 45 contrast checks and delayed stroke-library loading regressions.
- Native tests: 177 passed on macOS.
- Browser tests: 14 passed across Chromium and WebKit; no axe violations in the covered fixtures.
- The initial contrast palette was rejected after user review and is no longer the default. Its former contrast measurements must not be used to claim that Original passes AA contrast.
- Host native check and iOS ARM64 library check passed. The iOS build retains the existing deployment minimum.
- Default light/dark screenshots were compared with the original controls; enlarged screenshots were inspected for wrapping and clipping.

Selectable-appearance revision verified October 15, 2026:

- Frontend tests: 741 passed across 114 suites. Coverage includes preference backfill, early startup, custom tone restoration, delayed loads, unavailable browser storage, and the Settings/onboarding controls.
- Theme checks: 71 passed. Contrast small text is at least 4.54:1 on the tested app surfaces; light filled-control white labels are at least 4.60:1; icons and control boundaries are at least 3.08:1. The October 15 special switch palette also passed its applicable contrast targets in Original; that switch-specific result was superseded by the October 16 shared-palette correction described above.
- Browser tests: 26 passed across Chromium and WebKit, including saved choices, a second window receiving updates, Original hover/focus preservation, Contrast axe checks, and the new control at 320px with doubled text. No axe violations in the covered Contrast fixtures or the Original appearance switch.
- Typecheck: no errors or warnings. Lint, formatting, production build, and all bundle budgets passed; the initial shell graph remains 261.8 KiB against the 280 KiB limit.
- Original/Contrast desktop and mobile fixture screenshots were inspected. The enlarged-text check found and fixed label crowding by allowing the toggle to wrap below its description.
- Native code was unchanged in this revision. Native device and assistive-technology checks below remain pending; browser fixtures do not certify full application conformance.

Before release, verify on the actual supported devices:

1. VoiceOver, TalkBack, NVDA, and Orca: route names/order, Search announcements, dropdowns, nested dialogs, Reader controls, and sheet focus. Confirm that modal dismissal returns to the correct visible control.
2. iOS 15 and current iOS: standard and largest accessibility text sizes; changing the setting while backgrounded; hardware keyboard navigation; both app and character windows where available.
3. Windows: OS Text size changes, high contrast, and movement between monitors with different DPI. Confirm a single scale factor is applied.
4. Android/Linux/macOS: existing native text/display scaling, narrow windows, orientation, and software-keyboard layouts. Android may recreate its activity when settings change.
5. Search, Bookmarks, Reader Library/Document, Study, Tools, and Settings: keyboard-only completion at default and enlarged sizes. Confirm Reader's saved location and 50–150% control survive layout changes, and quiz durations/swipes remain unchanged.

Original colors, user-selected custom colors, and imported document content can have inadequate contrast. Contrast-palette checks cover the specified foreground/background pairs, not arbitrary document content or complete app conformance. Contrast temporarily uses tested default tone colors without erasing custom settings. Quiz timing accommodations and gesture alternatives remain outside this pass.

Offering an accessible contrast switch follows the approach in [W3C technique G174](https://www.w3.org/WAI/WCAG22/Techniques/general/G174). That technique requires the alternate presentation to meet all applicable conformance requirements and preserve all information/functionality; a passing palette or working switch alone does not establish full WCAG conformance.

October 16 control-styling correction: the owner requested the original shared toggle colors instead of the separate darker appearance-switch colors. The former claim that the switch track/knob pass non-text contrast in Original is superseded; Original control colors are preserved without that guarantee. Contrast still uses the tested shared control palette. The setting is now titled Increase Contrast with no explanatory paragraph, and stronger input borders apply only in Contrast appearance.

Correction checks: 115 focused frontend tests and 26 Chromium/WebKit browser tests passed, including exact Original toggle matching and desktop/mobile input-border restoration when switching back from Contrast. Typecheck, lint, formatting, and production build/bundle checks also passed.

Reference target: [WCAG 2.2](https://www.w3.org/TR/WCAG22/), including [visible keyboard focus](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible.html).
