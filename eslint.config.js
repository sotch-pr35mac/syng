import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import promise from 'eslint-plugin-promise';
import globals from 'globals';

export default [
	js.configs.recommended,
	...svelte.configs.recommended,
	{
		ignores: [
			'src/views/templates/build/**',
			'src/views/templates/utils/pouchdb-7.3.0.min.js',
			'src/views/resources/hanzi-writer-data/index.js',
			'src/views/templates/components/__mocks__/**',
		]
	},
	{
		plugins: {
			promise
		},
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				...globals.browser,
				// Node.js globals (for config files and tests)
				module: 'readonly',
				process: 'readonly',
				__dirname: 'readonly',
				// Vitest globals
				describe: 'readonly',
				it: 'readonly',
				expect: 'readonly',
				beforeEach: 'readonly',
				afterEach: 'readonly',
				beforeAll: 'readonly',
				afterAll: 'readonly',
				vi: 'readonly',
				global: 'readonly',
				// App-specific globals
				PouchDB: 'readonly',
			}
		},
		rules: {
			// ===================
			// Rust-Inspired Rules
			// ===================

			// Strict equality (no implicit type coercion)
			'eqeqeq': ['error', 'always'],

			// Prefer const over let when variable is never reassigned
			'prefer-const': 'error',

			// No var - only let/const (no hoisting like Rust)
			'no-var': 'error',

			// Unused variables - allow underscore prefix (Rust convention)
			'no-unused-vars': ['error', {
				argsIgnorePattern: '^_',
				varsIgnorePattern: '^_',
				caughtErrorsIgnorePattern: '^_',
			}],

			// Functions must be explicit about returns
			'consistent-return': 'error',

			// Require braces for all control statements (Rust requires braces)
			'curly': ['error', 'all'],

			// Don't reassign function parameters
			'no-param-reassign': 'error',

			// No magic numbers - extract to named constants
			'no-magic-numbers': ['warn', {
				ignore: [
					-1, 0, 1, 2,      // Common indices and increments
					100,              // Percentages
					1000,             // Milliseconds per second
				],
				ignoreArrayIndexes: true,
				ignoreDefaultValues: true,
				enforceConst: true,
			}],

			// ===================
			// Promise Handling
			// ===================

			// Promises must have .catch() or be returned
			'promise/catch-or-return': 'error',

			// Promises in .then() must return a value
			'promise/always-return': 'error',

			// Correct parameter names in Promise constructors
			'promise/param-names': 'error',
		}
	}
];
