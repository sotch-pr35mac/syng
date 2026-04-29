/**
 * Centralized registry of all Tauri invoke command strings exposed by the Rust backend.
 * Use these constants everywhere instead of raw string literals so that command names are
 * easy to find, rename, and audit from a single location.
 *
 * Structure: NATIVE_COMMANDS.<DOMAIN>.<ACTION>
 */
export const NATIVE_COMMANDS = {
	APP: {
		IS_DEV_BUILD: 'is_dev_build',
	},
	DICTIONARY: {
		INIT: 'init_dictionary',
		CLASSIFY: 'classify',
		QUERY: 'query',
		QUERY_BY_ENGLISH: 'query_by_english',
		QUERY_BY_PINYIN: 'query_by_pinyin',
		QUERY_BY_CHINESE: 'query_by_chinese',
	},
	QUIZ: {
		START: 'start_quiz',
		NEXT_QUESTION: 'get_next_question',
		ANSWER: 'answer_question',
		SCORE: 'score_quiz',
		INCORRECT: 'get_incorrect_questions',
	},
	BOOKMARKS: {
		EXPORT_LIST: 'export_list_data',
		IMPORT_LIST: 'import_list_data',
	},
	WINDOW: {
		OPEN_CHARACTER_WINDOW: 'open_character_window',
	},
	TELEMETRY: {
		INIT: 'telemetry_init',
		TRACK_EVENT: 'telemetry_track_event',
		TRACK_ERROR: 'telemetry_track_error',
		TRACK_SCREEN: 'telemetry_track_screen',
		GET_PREFS: 'telemetry_get_prefs',
		SET_PREF: 'telemetry_set_pref',
		GET_QUEUED_EVENTS: 'telemetry_get_queued_events',
	},
} as const;
