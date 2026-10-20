import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './src/test/accessibility',
	testMatch: '**/*.spec.ts',
	testIgnore: process.env.SYNG_ACCESSIBILITY_SOURCE_ROOT
		? '**/accessibility.spec.ts'
		: '**/baseline.spec.ts',
	fullyParallel: true,
	workers: 2,
	retries: process.env.CI ? 1 : 0,
	use: {
		baseURL: 'http://127.0.0.1:4265',
		viewport: { width: 1100, height: 800 },
		trace: 'retain-on-failure',
	},
	projects: [
		{ name: 'chromium', use: { browserName: 'chromium' } },
		{ name: 'webkit', use: { browserName: 'webkit' } },
	],
	webServer: {
		command: 'npx vite --config vite.accessibility.config.ts',
		url: `http://127.0.0.1:4265/src/test/accessibility/${process.env.SYNG_ACCESSIBILITY_SOURCE_ROOT ? 'baseline' : 'index'}.html`,
		reuseExistingServer: !process.env.CI,
	},
});
