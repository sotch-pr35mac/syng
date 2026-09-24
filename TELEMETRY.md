# Telemetry measurements

## Collection and delivery

Desktop and mobile use the same feature controllers and native SQLite queue. An event
describes a user action or outcome, not an IPC call, component render, or network request.
Dictionary classification and lookup execute immediately; their invocation counts are not
search counts.

The envelope includes an independent event UUID, family, name, timestamp, installation
device ID, app version, platform, and payload. Optional device context contains architecture,
OS version, and timezone. Startup waits for native telemetry initialization and persisted
preferences before sending early frontend events. Telemetry errors do not report themselves.

Ordinary events, screen views, and errors respect the master switch and their category
switch. By design, **already queued events continue to drain after opt-out**. Successfully
saved preference changes are also recorded while ordinary collection is disabled. Setting
an existing preference to the same value does not emit an event. Disabling error collection
discards pending frontend error summaries. No historical queue rewrite is performed.
If a preference cannot be saved, settings and onboarding restore the previous toggle value
and display an error. Telemetry toggles are disabled while a save is pending.

The native sender attempts delivery every 60 seconds, up to 50 events per batch. The queue
holds at most 500 events and drops its oldest entries on overflow. Failed sends retain the
same event UUIDs for retries; delivery is not an exactly-once guarantee. The receiving
service must deduplicate by event UUID. The settings preview shows **pending events**, not
a history of successful deliveries. Device context on old queued events reflects the
preference at collection time.

## Search and word openings

The shared Search controller owns `search.query`. A changed, nonempty, trimmed input or
manual language change creates a request. Identical input callbacks are ignored. An
800 ms input pause commits the current request; selecting a result or pressing Enter
commits it sooner. Each request emits at most once. Results remain immediate. If a request
is still resolving, committed telemetry waits for its classification and result outcome.
Unsubmitted requests superseded by typing, clearing, navigation, or backgrounding do not
later emit from a pending timer. Explicitly submitted requests remain committed.

IME composition is processed when committed; the Enter that confirms composition does
not submit a search. Paste and deletion use the same input path. Late replies cannot
overwrite newer results or language. Selecting results still visible from an older request
uses that older request's metadata.

`search.query` fields:

- `query_id`: random UUID identifying this request; never derived from query text.
- `term_length`: Unicode code-point count of trimmed input, not UTF-16 code units.
- `search_language`: `EN`, `PY`, `ZH`, or `null` if automatic classification is unavailable.
- `language_mode`: `auto` or `manual`.
- `result_count`: number of returned rows, including repeated dictionary entries; `null` on failure.
- `outcome`: `success` or `error`. Successful zero-result searches have count `0`.
- `trigger`: `pause`, `selection`, or `submit`.

The shared feature controllers own `dictionary.word_opened`. It records successful explicit
word openings, with:

- `source`: `search`, `bookmarks`, `reader`, `flashcards`, or `quiz`.
- `interaction`: `result`, `list`, `link`, `token`, `popover_result`, or `history`.
- `result_position` and `result_count`, when a result collection applies. Positions are
  one-based and reflect the visible filtered list, not the unfiltered bookmark index.
- `query_id` and `search_language` for selections from search results.

Search result clicks and Enter selections, bookmark selections, search history actions,
reader token taps, cross-reference links, and explicit alternate popover results are
covered. Repeated intentional clicks count separately. Restoration, highlighting,
automatic adjacent selection after bookmark removal, rendering study answers, and the
initial result assignment within a popover do not create additional opening events.
Invalid/empty lookups and responses arriving after a popover closes do not count.

Query text, selected words, lexical IDs, list names, document IDs, and document text are
excluded from these usage payloads. Bookmark filtering is not a dictionary search.

## Other usage events

Unless stated otherwise these fire immediately, once at their action boundary, without a
global debounce. Shared controllers/components cover both desktop and mobile.

### Bookmarks and lists

- `bookmark.added`, `bookmark.removed`: DictionaryContent, after membership persistence
  succeeds; empty payload. Failed writes do not count.
- `list.created`, `list.deleted`: bookmarks controller, after the corresponding mutation
  succeeds; empty payload.
- `list.imported`: bookmarks controller, after import and list loading succeed; empty
  payload. Cancellation does not count. Bulk imported entries do not emit bookmark-add events.
- `list.exported`: bookmarks controller, after a file is saved; empty payload. The native
  export command returns `true` for saved, `false` for canceled, and rejects failures.

### Reading

- `reader.document_imported`: after document persistence; `source_type`,
  `text_length_bucket` (rounded up to the next 1,000 UTF-16 code units).
- `reader.document_import_failed`: failed import boundary; `source_type`, `stage`
  (`prepare`, `pick`, `save`), `error_name`. This product outcome uses the events category;
  a separate diagnostic can explain the failure when error reporting is enabled.
- `reader.document_opened`: after the routed document is prepared; `source_type`. Import
  navigates to the route rather than opening and counting the document twice.
- `reader.reading_activity`: `next_count`, `previous_count`, counting actual page transitions.
  The first turn starts a 30-second window. Nonempty totals flush at the end of the window,
  on document change/removal, route exit, backgrounding, or page hide. Flushing resets the
  counters; an idle window emits nothing. Same-page requests and repagination do not count.
  Progress persistence remains immediate; successful saves have no separate event.
- `reader.document_metadata_updated`, `reader.document_removed`: after successful writes;
  `source_type`. Names, titles, and metadata values are excluded.
- `reader.documents_removed`: after successful bulk removal; `count`.
- `reader.supported_documents_opened`: explicit opening of format help; empty payload.
- `reader.theme_changed`: explicit theme selection; `theme`.
- `reader.layout_changed`: `setting`, `value`, optional `direction`; trailing 500 ms
  debounce per setting, with the final value retained. Backgrounding flushes pending changes.

### Study and tools

- `flashcards.started`: after a nonempty list loads; `word_count`. Each route visit or
  change of list is a session; canceled asynchronous loads do not start one.
- `flashcards.session_ended`: on exit, route unmount, or list change; `viewed_count`,
  `revealed_count`, counting unique card positions locally during that session. Restored
  visible/revealed cards count in the new visit. No individual flip or card events are sent.
- `quiz.started`: after the first question becomes available; `word_count` from the source
  list. Empty/insufficient lists and failed starts do not count.
- `quiz.completed`: after scoring; `question_count`, `correct_count`, `score` from the
  native scorecard. Duplicate continue callbacks cannot record completion twice.
- `quiz.abandoned`: a started session exited before scoring; `answered_count` of accepted
  answers. Completion excludes abandonment. Question text, answers, and list names are absent.
- `tools.completed`: successful explicit processing; `tool`, selected `mode`,
  `input_length` (trimmed Unicode code points). Colorize reports `mode:script` and waits
  for its entire pipeline. Context is captured before async processing.
- `tools.copied`: after successful clipboard write; `tool`, captured before the write.
  The clipboard text is never included.

### Settings, startup, and navigation

- `settings.changed`: a changed preference; `setting` only. Unchanged callbacks are ignored.
  Tone-color edits use a trailing 500 ms debounce; discrete switches remain immediate.
  This measures a preference change, not proof of durable preference-file storage.
- `character_window.opened`: desktop after native window-open success; mobile after the
  character route is requested. Empty payload. Mobile route readiness is separately
  represented by the `characters` screen view.
- `app.started`: main webview startup completed; empty payload. An iOS webview reload starts
  another frontend instance, so this is not necessarily a new OS-process launch.
- `app.lifecycle`: mobile shell; `state` is `foreground`, `background`, or `pageshow`.
  These are distinct lifecycle signals, retained for resume diagnostics.
- `app.ios_content_process_recovery_requested`: native iOS observer requested a reload;
  empty payload. It does not assert that the reload completed successfully.
- `onboarding.started`: onboarding mount; empty payload.
- `onboarding.step_viewed`: step transition; `step`. Deliberate backtracking counts again.
- `onboarding.completed`: completed flow; `child_privacy_mode`. Normal category gates apply.
- `telemetry.toggled`: persisted master preference change; `enabled`.
- `telemetry.category_toggled`: persisted category/context change; `category`, `enabled`.

Screen views use the `screen_view` family, with empty payloads and names `search`, `library`,
`reader`, `bookmarks`, `study`, `flashcards`, `quiz`, `tools`, `settings`, `characters`, and
desktop `help`. Dynamic reader document IDs and study query strings are not sent. The app
shell tracks route transitions after onboarding readiness, not every component update.

## Error diagnostics

`app.error` describes handled application failures. `bookmarks.db_error` describes native
storage-wrapper read failures with an `operation` and resume context. A propagated error
already reported at the database layer is not reported again by `handleError`; user alerts
and local logging still work.

At the telemetry boundary, only diagnostic fields `error_name`, `error_message`,
`error_stack`, `operation`, `visibility_state`, `ms_since_foreground`, `code`, `status`, and
`stage` survive. Known private values, URLs, file paths, emails, recognizable credentials,
and lexical IDs are redacted from prose. Arbitrary serialized objects are inspected only
to identify private values and are not transmitted. Messages/stacks are bounded to 8,000
characters. Full details remain in the local logging path.

Redaction is best effort: arbitrary prose can contain information that cannot be reliably
recognized. New callers should supply fixed telemetry messages and known private values,
and prefer structured error codes. Do not add user-content fields to diagnostic allowlists.

The first matching error sends immediately with `occurrence_count: 1`. Further errors with
the same event name, operation, sanitized message, and underlying error message are counted
for 30 seconds. A subsequent event has `summary: true` and `occurrence_count` equal to the
additional occurrences. Different operations remain separate. Sum `occurrence_count` to
measure occurrences; raw event count measures reports. Nonempty summaries flush on
background/page hide. At most 100 error groups are held in frontend memory.

## Changes to historical measurements

Use the release's `app_version` boundary for comparisons; local development builds can
share an app version with older code. Previously queued envelopes retain their old shapes.

- `search.query` retains its name but now includes language/outcome/context, counts
  committed input rather than stray key/change callbacks, and measures code points.
- `search.dictionary_link_opened` → `dictionary.word_opened`, source `search`, interaction `link`.
- `bookmarks.dictionary_link_opened` → same, source `bookmarks`, interaction `link`.
- `reader.dictionary_opened` → same, source `reader`, interaction `token`.
- `reader.dictionary_link_opened` → same, source `reader`, interaction `link`.
- `reader.page_changed` → `reader.reading_activity`; sum the directional counts.
- `reader.position_saved` is retired; persistence failures remain diagnostic errors.
- `app.ios_content_process_recovered` → `app.ios_content_process_recovery_requested`;
  the old `recovered: true` claim is retired.

No compatibility aliases are emitted, since those would double-count actions. Update
downstream queries to combine the appropriate old and new measurements across versions.
Native retry ID preservation is tested locally; backend deduplication and production
volume changes require verification against the receiving service.

## Verification and limitations

Regression tests cover debounce boundaries, EN/PY/ZH/unknown languages, zero results,
errors, out-of-order replies, query-to-selection attribution, IME input, filtered bookmark
ranks, canceled exports, unsuccessful writes, reader totals, study session boundaries,
tool outcomes, initialization, redaction, repeat counts, preference gates, and retry IDs.

On a native desktop/mobile build, use the queued-event preview before the next 60-second
flush to inspect one typing burst, language switch, selection, bookmark action, page-turn
burst, study session, and tool run. Verify their event names/fields against this catalogue.
This inspection is a release QA step; DOM tests are not a live backend-delivery test.

Abrupt process termination can lose unfinished debounce windows, reader/error summaries,
and study session-end events. No session duration or exactly-once end-event guarantee is
claimed. Queue overflow can also reduce observed volume. The audit does not change the
receiving service, dashboards, installation identity, transport cadence, or retention policy.
