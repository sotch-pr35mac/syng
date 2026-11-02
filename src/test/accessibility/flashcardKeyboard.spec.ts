import { expect, test } from '@playwright/test';

for (const device of ['desktop', 'ipad']) {
	test(`${device} flashcards support shortcuts and native focused buttons`, async ({ page }) => {
		if (device === 'ipad') {
			await page.addInitScript(() => {
				Object.defineProperty(navigator, 'userAgent', { get: () => 'iPad' });
			});
		}
		await page.goto(
			`/src/test/accessibility/index.html?pinyin=flashcards${device === 'ipad' ? '&ipad' : ''}`
		);
		const status = page.getByTestId('flashcard-status');
		await expect(status).toContainText('1 of 2');
		const announcement = page.getByRole('status').filter({ hasText: 'Card ' });
		// Match the shell destination used by Skip to content and routeAccessibility.
		const main = page.locator('#sy-main-content');
		await main.focus();
		await expect(main).toBeFocused();
		await page.keyboard.press('Space');
		await expect(announcement).toContainText('Details shown.');
		await page.keyboard.press('ArrowRight');
		await expect(status).toContainText('2 of 2');
		await expect(announcement).toContainText('Front shown.');
		await page.keyboard.press('ArrowRight');
		await expect(status).toContainText('2 of 2');
		await page.keyboard.down('ArrowLeft');
		await page.keyboard.down('ArrowLeft');
		await page.keyboard.up('ArrowLeft');
		await expect(status).toContainText('1 of 2');
		await page.keyboard.down('Space');
		await page.keyboard.down('Space');
		await page.keyboard.up('Space');
		await expect(announcement).toContainText('Details shown.');
		const next = page.getByRole('button', { name: 'Next', exact: true });
		await next.focus();
		await page.keyboard.press('Space');
		await expect(status).toContainText('2 of 2');
		await expect(announcement).toContainText('Front shown.');
		await page.getByRole('button', { name: 'Flip', exact: true }).focus();
		await page.keyboard.press('Space');
		await expect(announcement).toContainText('Details shown.');
		await expect(next).toHaveAttribute('aria-keyshortcuts', 'ArrowRight');
	});
}
