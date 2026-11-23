import { expect, test } from '@playwright/test';

test('SyTab underline travels to the selected tab and respects reduced motion', async ({
	page,
}) => {
	await page.setViewportSize({ width: 1200, height: 800 });
	await page.goto('/src/test/accessibility/index.html?settings#/settings');
	const tablist = page.getByRole('tablist', { name: 'Settings sections' });
	const indicator = tablist.locator('.sy-tab__indicator');
	const acknowledgements = tablist.getByRole('tab', { name: 'Acknowledgements' });
	const general = tablist.getByRole('tab', { name: 'General' });
	const telemetry = tablist.getByRole('tab', { name: 'Telemetry' });

	await expect(indicator).toBeVisible();
	await acknowledgements.click();
	await expect(acknowledgements).toHaveAttribute('aria-selected', 'true');
	await expect
		.poll(() =>
			indicator.evaluate((element) =>
				element.getAnimations().some((animation) => animation.playState === 'running')
			)
		)
		.toBe(true);
	expect(
		await indicator.evaluate((element) => {
			const effect = element.getAnimations()[0]?.effect;
			return effect instanceof KeyframeEffect ? effect.getKeyframes().length : 0;
		})
	).toBe(2);
	await expect
		.poll(async () => {
			const indicatorBox = await indicator.boundingBox();
			const acknowledgementsBox = await acknowledgements.boundingBox();
			return (
				Math.abs(indicatorBox!.x - acknowledgementsBox!.x) +
				Math.abs(indicatorBox!.width - acknowledgementsBox!.width)
			);
		})
		.toBeLessThan(1);

	await telemetry.click();
	await expect
		.poll(() =>
			indicator.evaluate((element) =>
				element.getAnimations().some((animation) => animation.playState === 'running')
			)
		)
		.toBe(true);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect
		.poll(() => indicator.evaluate((element) => element.getAnimations().length))
		.toBe(0);
	await general.click();
	await expect(general).toHaveAttribute('aria-selected', 'true');
	await expect
		.poll(() => indicator.evaluate((element) => element.getAnimations().length))
		.toBe(0);
	await expect
		.poll(async () => {
			const indicatorBox = await indicator.boundingBox();
			const generalBox = await general.boundingBox();
			return Math.abs(indicatorBox!.x - generalBox!.x);
		})
		.toBeLessThan(1);
});
