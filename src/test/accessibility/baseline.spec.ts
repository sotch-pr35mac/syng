import { expect, test } from '@playwright/test';

test('capture original shared controls in both themes', async ({ page }, testInfo) => {
	for (const colorScheme of ['light', 'dark'] as const) {
		await page.emulateMedia({ colorScheme });
		await page.goto('/src/test/accessibility/baseline.html');
		await expect(page.getByRole('heading', { name: 'Syng shared controls' })).toBeVisible();
		await page.screenshot({
			path: testInfo.outputPath(`${colorScheme}-baseline.png`),
			fullPage: true,
		});
	}
});
