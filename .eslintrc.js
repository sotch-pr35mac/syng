module.exports = {
	'ignorePatterns': [
		'src/views/templates/build',
		'src/views/templates/utils/pouchdb-7.3.0.min.js',
		'src/views/resources/hanzi-writer-data/index.js',
		'src/views/templates/components/__mocks__/',
		'src/views/templates/components/SyTimer/SyTimer.svelte',
	],
	'env': {
		'browser': true,
		'es2021': true,
		'node': true
	},
	'extends': 'eslint:recommended',
	'parserOptions': {
		'ecmaVersion': 13,
		'allowImportExportEverywhere': true
	},
	'plugins': ['svelte3'],
	'overrides': [
		{
			'files': ['*.svelte'],
			'processor': 'svelte3/svelte3'
		}
	],
	'rules': {
		'indent': [
			'error',
			'tab'
		],
		'linebreak-style': [
			'error',
			'unix'
		],
		'quotes': [
			'error',
			'single'
		],
		'semi': [
			'error',
			'always'
		]
	}
};
