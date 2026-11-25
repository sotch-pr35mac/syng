import { expect, test } from '@playwright/test';

const fixture = '/src/test/accessibility/index.html';
const finishTransitions = (element: Element) =>
	Promise.all(element.getAnimations().map((animation) => animation.finished));

for (const mobile of [false, true]) {
	test(`control feedback enters and leaves smoothly but presses immediately (${mobile ? 'mobile' : 'desktop'})`, async ({
		page,
	}) => {
		await page.emulateMedia({ reducedMotion: 'no-preference' });
		await page.goto(`${fixture}?palette${mobile ? '&mobile' : ''}`);
		const save = page.getByRole('button', { name: 'Save word', exact: true });
		await expect(save).toHaveCSS('transition-duration', '0.15s');
		const restingBackground = await save.evaluate(
			(element) => getComputedStyle(element).backgroundColor
		);
		await save.hover();
		await save.evaluate(finishTransitions);
		await expect(save).not.toHaveCSS('background-color', restingBackground);
		await save.evaluate((element) => {
			element.addEventListener('transitionrun', (event) => {
				if ((event as TransitionEvent).propertyName === 'background-color') {
					element.setAttribute('data-return-transition', 'started');
				}
			});
		});
		await page.mouse.move(0, 0);
		// The return keeps its transition after :hover stops matching.
		await expect(save).toHaveCSS('transition-duration', '0.15s');
		await expect(save).toHaveAttribute('data-return-transition', 'started');
		await expect(save).toHaveCSS('background-color', restingBackground);

		await save.hover();
		await page.mouse.down();
		await expect(save).toHaveCSS('transition-property', 'none');
		expect(await save.evaluate((element) => element.getAnimations().length)).toBe(0);
		await page.mouse.up();
		await page.mouse.move(0, 0);
		await expect(save).toHaveCSS('transition-duration', '0.15s');

		await page.keyboard.press('Tab');
		await save.focus();
		await expect(save).toHaveCSS('outline-style', 'solid');
		await save.evaluate(finishTransitions);
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await save.hover();
		const reducedDurations = await save.evaluate((element) => ({
			transitions: getComputedStyle(element)
				.transitionDuration.split(',')
				.map((duration) => parseFloat(duration) * 1000),
			animations: element
				.getAnimations()
				.map((animation) => Number(animation.effect?.getComputedTiming().duration)),
		}));
		// The shared reduced-motion rule uses 0.01ms to retain transition completion events.
		for (const duration of [...reducedDurations.transitions, ...reducedDurations.animations]) {
			expect(duration).toBeLessThanOrEqual(0.01);
		}
		if (!mobile) {
			const activeNavigation = page
				.getByRole('link', { name: 'Search', exact: true })
				.locator('.navigation--item');
			await activeNavigation.hover();
			await expect(activeNavigation).toHaveCSS('transition-duration', '0s');
		}
	});
}

test('Reader lift is reversible and stops entirely with Reduce Motion', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.goto(`${fixture}?reader`);
	const cover = page.locator('.reader-book-card__cover');
	const restingShadow = await cover.evaluate((element) => getComputedStyle(element).boxShadow);
	await expect(cover).toHaveCSS('transform', 'none');
	await cover.hover();
	await expect(cover).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, -2)');
	await page.mouse.move(0, 0);
	await expect(cover).toHaveCSS('transform', 'none');
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await cover.hover();
	await expect(cover).toHaveCSS('transform', 'none');
	await expect(cover).not.toHaveCSS('box-shadow', restingShadow);
	await page.keyboard.press('Tab');
	await cover.focus();
	await expect(cover).toHaveCSS('outline-style', 'solid');
	await page.mouse.down();
	await expect(cover).toHaveCSS('transform', 'none');
	await page.mouse.up();
});

test('tool artwork uses brief transitions with immediate press and static reduced-motion feedback', async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.goto(`${fixture}?wordFrequency&toolbox`);
	await page.evaluate(() => document.fonts.ready);
	const tile = page.getByRole('button', { name: 'Pinyinify', exact: true });
	const illustration = tile.locator('.toolbox__illustration');
	await expect(illustration).toHaveCSS('transition-duration', '0.15s, 0.2s');
	const restingShadow = await illustration.evaluate(
		(element) => getComputedStyle(element).filter
	);
	await tile.hover();
	await expect(illustration).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, -2)');
	await illustration.evaluate(finishTransitions);
	const hoverShadow = await illustration.evaluate((element) => getComputedStyle(element).filter);
	expect(hoverShadow).not.toBe(restingShadow);
	await page.mouse.move(0, 0);
	await expect(illustration).toHaveCSS('transition-duration', '0.15s, 0.2s');
	await expect(illustration).toHaveCSS('filter', restingShadow);
	await tile.hover();
	await page.mouse.down();
	await expect(illustration).toHaveCSS('transition-duration', '0s');
	await expect(illustration).toHaveCSS('filter', hoverShadow);
	expect(await illustration.evaluate((element) => element.getAnimations().length)).toBe(0);
	// Release outside the tile so this press check does not open a tool.
	await page.mouse.move(0, 0);
	await page.mouse.up();
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await tile.hover();
	await expect(illustration).toHaveCSS('transform', 'none');
	await expect(illustration).toHaveCSS('filter', hoverShadow);
	expect(await illustration.evaluate((element) => element.getAnimations().length)).toBe(0);
});
