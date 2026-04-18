import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { resolve } from 'path'

export default defineConfig({
	plugins: [svelte()],
	resolve: {
		// Force browser conditions for all resolution
		conditions: ['browser', 'import', 'module', 'default']
	},
	build: {
		outDir: 'src/views/templates/build',
		emptyOutDir: true,
		sourcemap: process.env.NODE_ENV !== 'production',
		cssCodeSplit: false,
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true
			}
		},
		rollupOptions: {
			input: resolve(import.meta.dirname, 'src/views/templates/app.js'),
			output: {
				format: 'iife',
				entryFileNames: 'bundle.js',
				assetFileNames: 'bundle[extname]'
			}
		}
	},
	test: {
		globals: true,
		environment: 'jsdom',
		include: ['src/**/*.test.{js,ts}'],
		deps: {
			optimizer: {
				web: {
					include: ['svelte', '@testing-library/svelte']
				}
			}
		}
	}
})
