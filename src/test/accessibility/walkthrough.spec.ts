import { expect, test } from '@playwright/test';

const MINIMUM_TOUCH_TARGET = 44;

for (const scenario of [
	{ name: 'desktop', width: 1100, fontSize: 16, mobile: false },
	{ name: 'small phone', width: 320, fontSize: 16, mobile: true },
	{ name: 'large text phone', width: 393, fontSize: 32, mobile: true },
]) {
	for (const vocabulary of [false, true]) {
		test(`${scenario.name}: ${vocabulary ? 'vocabulary' : 'document'} sample stays usable and confirms saving`, async ({
			page,
		}, testInfo) => {
			await page.setViewportSize({ width: scenario.width, height: 852 });
			await page.goto(
				`/src/test/accessibility/index.html?walkthrough&fontSize=${scenario.fontSize}${scenario.mobile ? '&mobile' : ''}${vocabulary ? '&vocabulary' : ''}`
			);
			const card = page.getByRole('dialog');
			const add = card.getByRole('button', {
				name: vocabulary ? 'Add sample words' : 'Add sample document',
			});
			await expect(add).toBeVisible();
			await expect(card.getByText('Awa’s Tea Party')).toBeVisible();
			await add.scrollIntoViewIfNeeded();
			const bounds = await add.boundingBox();
			if (scenario.mobile) {
				expect(bounds!.height).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
			}
			expect(bounds!.x).toBeGreaterThanOrEqual(0);
			expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(scenario.width);
			expect(
				await card.evaluate((element) => element.scrollWidth <= element.clientWidth)
			).toBe(true);
			await page.screenshot({ path: testInfo.outputPath('sample.png') });
			await add.focus();
			await add.press('Enter');
			await expect(card.getByRole('status')).toHaveText(
				vocabulary ? 'Added to your vocabulary lists.' : 'Added to your Reader library.'
			);
			await expect(add).toHaveCount(0);
			await expect(card.getByRole('heading')).toBeFocused();
			await page.screenshot({ path: testInfo.outputPath('added.png') });
			await card.getByRole('button', { name: 'Next', exact: true }).click();
			await expect(card.getByRole('status')).toBeEmpty();
		});
	}
}
