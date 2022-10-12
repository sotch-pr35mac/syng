module.exports = {
	'ignorePatterns': [
		'app/src/templates/build',
		'app/src/templates/utils/pouchdb-7.3.0.min.js',
		'app/src/resources/hanzi-writer-data/index.js'
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
