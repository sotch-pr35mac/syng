import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';

const sourceRoot = resolve(process.env.SYNG_ACCESSIBILITY_SOURCE_ROOT || '.');

export default defineConfig({
	plugins: [svelte()],
	optimizeDeps: {
		entries: [
			process.env.SYNG_ACCESSIBILITY_SOURCE_ROOT
				? 'src/test/accessibility/baseline.html'
				: 'src/test/accessibility/index.html',
		],
	},
	resolve: {
		alias: {
			'@': resolve(sourceRoot, 'src/views/templates'),
			'@test': resolve('src/test'),
		},
		conditions: ['browser', 'import', 'module', 'default'],
	},
	server: {
		host: '127.0.0.1',
		port: 4265,
		strictPort: true,
		fs: { allow: [resolve('.'), sourceRoot] },
	},
});
