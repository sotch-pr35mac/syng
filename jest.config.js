module.exports = {
	transform: {
		'^.+\\.svelte$': 'svelte-jest',
		'^.+\\.js$': 'babel-jest'
	},
	moduleFileExtensions: ['js', 'svelte'],
	testEnvironment: "jsdom"
};
