import { expect, test } from '@playwright/test';

type TabMotion = { keyframes: number; moved: boolean };
type TabMotionWindow = Window & { __syTabMotions?: TabMotion[] };

test('SyTab underline travels to the selected tab and respects reduced motion', async ({
	page,
}) => {
	await page.addInitScript(() => {
		const animate = Element.prototype.animate;
		const motions: TabMotion[] = [];
		(window as TabMotionWindow).__syTabMotions = motions;
		Element.prototype.animate = function (keyframes, options) {
			const animation = animate.call(this, keyframes, options);
			if (this.matches('.sy-tab__indicator')) {
				// Capture motion before a resize or the animation end removes it.
				const frames =
					animation.effect instanceof KeyframeEffect
						? animation.effect.getKeyframes()
						: [];
				motions.push({
					keyframes: frames.length,
					moved: frames[0]?.left !== frames[1]?.left,
				});
			}
			return animation;
		};
	});
	await page.setViewportSize({ width: 1200, height: 800 });
	await page.goto('/src/test/accessibility/index.html?settings#/settings');
	const tablist = page.getByRole('tablist', { name: 'Settings sections' });
	const indicator = tablist.locator('.sy-tab__indicator');
	const acknowledgements = tablist.getByRole('tab', { name: 'Acknowledgements' });
	const general = tablist.getByRole('tab', { name: 'General' });
	const telemetry = tablist.getByRole('tab', { name: 'Telemetry' });
	const motionCount = () =>
		page.evaluate(() => (window as TabMotionWindow).__syTabMotions?.length ?? 0);

	await expect(indicator).toBeVisible();
	const initialMotionCount = await motionCount();
	await acknowledgements.click();
	await expect(acknowledgements).toHaveAttribute('aria-selected', 'true');
	await expect.poll(motionCount).toBeGreaterThan(initialMotionCount);
	const motion = await page.evaluate(() => (window as TabMotionWindow).__syTabMotions?.at(-1));
	expect(motion).toEqual({ keyframes: 2, moved: true });
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

	const previousMotionCount = await motionCount();
	await telemetry.click();
	await expect.poll(motionCount).toBeGreaterThan(previousMotionCount);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect
		.poll(() => indicator.evaluate((element) => element.getAnimations().length))
		.toBe(0);
	const reducedMotionCount = await motionCount();
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
	await page.evaluate(
		() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
	);
	expect(await motionCount()).toBe(reducedMotionCount);
});
