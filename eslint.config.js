import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';

export default [
	js.configs.recommended,
	...svelte.configs.recommended,
	{
		ignores: [
			'src/views/templates/build/**',
			'src/views/templates/utils/pouchdb-7.3.0.min.js',
			'src/views/resources/hanzi-writer-data/index.js',
			'src/views/templates/components/__mocks__/**',
			'src/views/templates/components/SyTimer/SyTimer.svelte',
		]
	},
	{
		languageOptions: {
			ecmaVersion: 2021,
			sourceType: 'module',
			globals: {
				window: 'readonly',
				document: 'readonly',
				console: 'readonly',
				setTimeout: 'readonly',
				clearTimeout: 'readonly',
				setInterval: 'readonly',
				clearInterval: 'readonly',
				fetch: 'readonly',
				PouchDB: 'readonly',
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
				global: 'readonly',
			}
		},
		rules: {
			'indent': ['error', 'tab'],
			'linebreak-style': ['error', 'unix'],
			'quotes': ['error', 'single'],
			'semi': ['error', 'always']
		}
	}
];

