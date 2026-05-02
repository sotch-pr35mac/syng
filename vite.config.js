import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolve } from 'path'

const repoRoot = path.dirname(fileURLToPath(import.meta.url))
const pdfJsPackageRoot = path.join(repoRoot, 'node_modules', 'pdfjs-dist')

async function copyPdfJsSidecarsToBuild(outDir) {
	const cmapSource = path.join(pdfJsPackageRoot, 'cmaps')
	const cmapDestination = path.join(outDir, 'cmaps')
	await fs.mkdir(cmapDestination, { recursive: true })
	for (const entryName of await fs.readdir(cmapSource)) {
		if (!entryName.endsWith('.bcmap')) {
			continue
		}
		await fs.copyFile(path.join(cmapSource, entryName), path.join(cmapDestination, entryName))
	}

	const standardFontSource = path.join(pdfJsPackageRoot, 'standard_fonts')
	const standardFontDestination = path.join(outDir, 'standard_fonts')
	await fs.mkdir(standardFontDestination, { recursive: true })
	for (const entryName of await fs.readdir(standardFontSource)) {
		await fs.copyFile(
			path.join(standardFontSource, entryName),
			path.join(standardFontDestination, entryName)
		)
	}

	const wasmSource = path.join(pdfJsPackageRoot, 'wasm')
	const wasmDestination = path.join(outDir, 'wasm')
	await fs.mkdir(wasmDestination, { recursive: true })
	for (const entryName of await fs.readdir(wasmSource)) {
		await fs.copyFile(path.join(wasmSource, entryName), path.join(wasmDestination, entryName))
	}

	const iccSource = path.join(pdfJsPackageRoot, 'iccs')
	const iccDestination = path.join(outDir, 'iccs')
	await fs.mkdir(iccDestination, { recursive: true })
	for (const entryName of await fs.readdir(iccSource)) {
		await fs.copyFile(path.join(iccSource, entryName), path.join(iccDestination, entryName))
	}

	const workerMapSource = path.join(pdfJsPackageRoot, 'build', 'pdf.worker.mjs.map')
	const workerMapDestination = path.join(outDir, 'pdf.worker.mjs.map')
	await fs.copyFile(workerMapSource, workerMapDestination)
}

export default defineConfig({
	plugins: [
		svelte(),
		{
			name: 'copy-pdfjs-sidecars',
			async writeBundle() {
				const outDir = path.join(repoRoot, 'src', 'views', 'templates', 'build')
				try {
					await copyPdfJsSidecarsToBuild(outDir)
				} catch (error) {
					console.warn('[copy-pdfjs-sidecars]', error)
				}
			},
		},
	],
	resolve: {
		alias: {
			'@': resolve(import.meta.dirname, 'src/views/templates'),
			'@test': resolve(import.meta.dirname, 'src/test')
		},
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
				// Keep a dedicated name for the pdf.js worker so it is not overwritten by other
				// assets that also used `bundle[extname]` (which broke the worker with HTML/404).
				assetFileNames: (assetInfo) => {
					const names = [
						assetInfo.name,
						...(assetInfo.names ?? []),
						...(assetInfo.originalFileNames ?? []),
					]
						.filter(Boolean)
						.join('\n');
					if (/pdf\.worker|pdfjs.*worker/i.test(names)) {
						return 'pdfjs-worker-[hash][extname]';
					}
					return 'bundle[extname]';
				},
			},
		},
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
