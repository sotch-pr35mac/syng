import { expect, test } from '@playwright/test';

const BACKWARD_FOCUS_STEPS = 10;

for (const scenario of [
	{ name: 'desktop', width: 1100, height: 800, parameters: '' },
	{ name: 'iPad', width: 820, height: 1180, parameters: '&ipad' },
	{ name: 'narrow desktop', width: 550, height: 900, parameters: '' },
	{ name: 'phone', width: 393, height: 852, parameters: '&mobile' },
	{ name: 'dark phone', width: 393, height: 852, parameters: '&mobile' },
]) {
	test(`${scenario.name}: preview stays visible through the final option`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize(scenario);
		await page.emulateMedia({
			reducedMotion: 'reduce',
			colorScheme: scenario.name === 'dark phone' ? 'dark' : 'light',
		});
		await page.goto(`/src/test/accessibility/index.html?onboarding${scenario.parameters}`);
		await page.getByRole('button', { name: 'Continue', exact: true }).click();
		const preview = page.locator('.chinese-prefs__preview');
		const body = page.locator('.onboarding-flow__body');
		await expect(preview).toHaveCSS('position', 'sticky');
		await body.evaluate((element) => {
			element.scrollTop = element.scrollHeight;
		});
		await expect(preview).toBeInViewport({ ratio: 1 });
		const alternative = page.getByRole('checkbox', { name: 'Show alternative pronunciations' });
		await alternative.focus();
		await alternative.press('Space');
		await expect(page.locator('.chinese-preview__alternative-pronunciation')).toBeVisible();
		await expect(preview).toBeInViewport({ ratio: 1 });
		const topOffset = await preview.evaluate((element) => {
			const scrollport = element.closest('.onboarding-flow__body')!;
			return (
				element.getBoundingClientRect().top -
				Math.max(
					element.parentElement!.getBoundingClientRect().top,
					scrollport.getBoundingClientRect().top +
						parseFloat(getComputedStyle(scrollport).paddingTop)
				)
			);
		});
		expect(Math.abs(topOffset)).toBeLessThanOrEqual(1);
		await page.screenshot({ path: testInfo.outputPath('preview-scrolled.png') });
		for (let index = 0; index < BACKWARD_FOCUS_STEPS; index += 1) {
			await page.keyboard.press('Shift+Tab');
			const visible = await page.evaluate(() => {
				const focused = document.activeElement;
				const previewElement = document.querySelector('.chinese-prefs__preview')!;
				const scrollport = document.querySelector('.onboarding-flow__body')!;
				if (
					!(focused instanceof HTMLElement) ||
					!focused.closest('.chinese-prefs__controls')
				) {
					return true;
				}
				const visibleTarget =
					focused instanceof HTMLInputElement
						? (focused.labels?.[0] ?? focused)
						: focused;
				const bounds = visibleTarget.getBoundingClientRect();
				const previewBounds = previewElement.getBoundingClientRect();
				const bodyBounds = scrollport.getBoundingClientRect();
				return (
					bounds.top >= bodyBounds.top &&
					bounds.bottom <= bodyBounds.bottom &&
					(bounds.right <= previewBounds.left || bounds.top >= previewBounds.bottom)
				);
			});
			expect(visible).toBe(true);
		}
		await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeInViewport();
		expect(await body.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
			true
		);
		await page.setViewportSize({ width: scenario.width, height: 360 });
		await expect(preview).toHaveCSS('position', 'static');
		await page.setViewportSize(scenario);
		await expect(preview).toHaveCSS('position', 'sticky');
		await page.getByRole('button', { name: 'Continue', exact: true }).click();
		await expect(body).toHaveCSS('scroll-padding-top', 'auto');
		await page.getByRole('button', { name: 'Back', exact: true }).click();
		await expect(preview).toHaveCSS('position', 'sticky');
	});
}

test('large text uses normal flow without clipping the preview', async ({ page }) => {
	await page.setViewportSize({ width: 393, height: 852 });
	await page.goto('/src/test/accessibility/index.html?onboarding&mobile&fontSize=32');
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	await expect(page.locator('.chinese-prefs__preview')).toHaveCSS('position', 'static');
	await page
		.getByRole('checkbox', { name: 'Show alternative pronunciations' })
		.scrollIntoViewIfNeeded();
	await expect(page.locator('label[for="show-alternative-pronunciations"]')).toBeInViewport();
});

test('open preview responds to layout and text-size changes', async ({ page }) => {
	await page.setViewportSize({ width: 1100, height: 852 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/src/test/accessibility/index.html?onboarding');
	await page.getByRole('button', { name: 'Continue', exact: true }).click();
	const preview = page.locator('.chinese-prefs__preview');
	const body = page.locator('.onboarding-flow__body');
	await expect(preview).toHaveCSS('position', 'sticky');
	await page.setViewportSize({ width: 550, height: 852 });
	await expect(preview).toHaveCSS('grid-column-start', 'auto');
	await body.evaluate((element) => {
		element.scrollTop = element.scrollHeight;
	});
	await expect(preview).toBeInViewport({ ratio: 1 });
	await page.evaluate(() =>
		document.documentElement.style.setProperty('--sy-system-font-size', '32px')
	);
	await expect(preview).toHaveCSS('position', 'static');
	await page.evaluate(() =>
		document.documentElement.style.setProperty('--sy-system-font-size', '16px')
	);
	await expect(preview).toHaveCSS('position', 'sticky');
	await page.setViewportSize({ width: 1100, height: 852 });
	await expect(preview).toHaveCSS('grid-column-start', '2');
	await expect(preview).toBeInViewport({ ratio: 1 });
});
