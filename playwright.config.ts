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
		viewport: { width: 1100, height: 800 },
		trace: 'retain-on-failure',
	},
	projects: [
		{ name: 'chromium', use: { browserName: 'chromium' } },
		{ name: 'webkit', use: { browserName: 'webkit' } },
	],
	webServer: {
		// Each run needs this checkout's fixtures, even when another worktree has a server running.
		command: 'npx vite --config vite.accessibility.config.ts --port 0',
		// Playwright exports this capture as PLAYWRIGHT_TEST_BASE_URL for its baseURL fixture.
		wait: { stdout: /Local:\s+(?<playwright_test_base_url>http:\/\/127\.0\.0\.1:\d+\/)/ },
		reuseExistingServer: false,
	},
});
