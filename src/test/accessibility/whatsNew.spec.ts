import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const fixture = '/src/test/accessibility/index.html?settings&whatsnew';

test.beforeEach(async ({ page }) => {
	// Awa's app-relative assets are served from the frontend root in production.
	await page.route('**/src/test/accessibility/assets/awa/**', (route) =>
		route.continue({
			url: route
				.request()
				.url()
				.replace('/src/test/accessibility/assets/', '/src/views/assets/'),
		})
	);
});

for (const scenario of [
	{ name: 'desktop', width: 1200, height: 720, parameters: '' },
	{ name: 'compact iPad', width: 700, height: 852, parameters: '&ipad' },
	{ name: 'phone', width: 393, height: 852, parameters: '&mobile' },
	{ name: 'narrow phone', width: 320, height: 740, parameters: '&mobile' },
	{ name: 'short window', width: 568, height: 360, parameters: '' },
	{ name: 'large text', width: 393, height: 852, parameters: '&mobile&fontSize=32' },
]) {
	test(`${scenario.name}: standalone notes, live contrast and persistent exit`, async ({
		page,
	}, testInfo) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		if (scenario.parameters.includes('ipad')) {
			await page.addInitScript(() => {
				Object.defineProperty(navigator, 'userAgent', { value: 'iPad' });
			});
		}
		await page.setViewportSize({ width: scenario.width, height: scenario.height });
		await page.goto(
			`${fixture}${scenario.parameters}&baseline=2.5.3&appearance=contrast#/read`
		);
		await expect(
			page.getByRole('heading', { name: 'What’s New in Syng 2.6.0', exact: true, level: 1 })
		).toBeFocused();
		await expect(page.getByRole('heading', { name: 'What’s New in Syng 2.6.0' })).toBeVisible();
		await expect(page.getByRole('navigation')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Choose a walkthrough' })).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Explore settings' })).toHaveCount(0);
		const exit = page.getByRole('button', { name: 'Continue to Syng', exact: true });
		await expect(exit).toHaveCount(1);
		await expect(exit).toBeInViewport();
		await expect
			.poll(() =>
				page.locator('.awa img').evaluate((node: HTMLImageElement) => node.naturalWidth)
			)
			.toBeGreaterThan(0);
		await expect(page.getByRole('heading', { name: 'Organized settings' })).toBeVisible();
		await page.evaluate(() => document.fonts.ready);
		if (!['large text', 'short window'].includes(scenario.name)) {
			const dimensions = await page.locator('.whats-new__scroll').evaluate((node) => ({
				content: node.scrollHeight,
				viewport: node.clientHeight,
			}));
			expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
		}
		await page.screenshot({ path: testInfo.outputPath('whats-new.png') });
		const contrast = page.getByRole('checkbox', { name: 'Increase Contrast' });
		await expect(contrast).toBeChecked();
		await contrast.focus();
		await contrast.press('Space');
		await expect(page.locator('html')).toHaveAttribute('data-appearance', 'original');
		await page.locator('.increase-contrast-settings > label').click();
		await page.getByRole('button', { name: 'Other improvements', exact: true }).click();
		await expect(page.getByRole('button', { name: 'Hide other improvements' })).toHaveAttribute(
			'aria-expanded',
			'true'
		);
		await expect(
			page.getByText(
				'Improved keyboard navigation, focus indicators, screen-reader labels, and layouts for larger text and narrow windows.'
			)
		).toBeVisible();
		await expect(exit).toBeInViewport();
		await page.locator('.whats-new__scroll').evaluate((node) => {
			node.scrollTop = node.scrollHeight;
		});
		await expect(exit).toBeInViewport();
		await page.screenshot({ path: testInfo.outputPath('whats-new-expanded.png') });
		expect(
			await page
				.locator('.whats-new__scroll')
				.evaluate((node) => node.scrollWidth <= node.clientWidth)
		).toBe(true);
		const results = await new AxeBuilder({ page }).disableRules(['region']).analyze();
		expect(results.violations).toEqual([]);
		await page.getByRole('button', { name: 'Continue to Syng' }).first().click();
		await expect(page).toHaveURL(/#\/read$/);
		await expect(page.getByRole('link', { name: 'Search', exact: true })).toBeVisible();
		await page.reload();
		await expect(
			page.getByRole('heading', { name: 'What’s New in Syng 2.6.0', exact: true, level: 1 })
		).toHaveCount(0);
		expect(errors).toEqual([]);
	});
}

test('new installs stay suppressed after setup, while notes remain available manually', async ({
	page,
}) => {
	await page.goto(`${fixture}&fresh#/settings`);
	await expect(page.getByRole('button', { name: 'View changes', exact: true })).toBeVisible();
	await expect(
		page.getByRole('heading', { name: 'What’s New in Syng 2.6.0', exact: true, level: 1 })
	).toHaveCount(0);
	await page.goto(`${fixture}#/settings`);
	await expect(page.getByRole('button', { name: 'View changes', exact: true })).toBeVisible();
	await page.getByRole('button', { name: 'View changes', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'What’s New in Syng 2.6.0' })).toBeVisible();
	await page.getByRole('button', { name: 'Continue to Syng' }).first().click();
	await expect(page).toHaveURL(/#\/settings$/);
});

test('recovery gets priority and rendering consumes automatic presentation before closing', async ({
	page,
}) => {
	await page.goto(`${fixture}&blocked#/read`);
	await expect(page.getByRole('button', { name: 'Finish recovery' })).toBeVisible();
	await expect(
		page.getByRole('heading', { name: 'What’s New in Syng 2.6.0', exact: true, level: 1 })
	).toHaveCount(0);
	await page.getByRole('button', { name: 'Finish recovery' }).click();
	await expect(page.getByRole('heading', { name: 'What’s New in Syng 2.6.0' })).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(
				() =>
					JSON.parse(localStorage.getItem('fixture:release-history')!)
						.handledThroughVersion
			)
		)
		.toBe('2.6.0');
	await page.goto(`${fixture}#/read`);
	await expect(
		page.getByRole('heading', { name: 'What’s New in Syng 2.6.0', exact: true, level: 1 })
	).toHaveCount(0);
});

test('same-route destinations replace the saved tab and position; developer preview preserves history', async ({
	page,
}) => {
	await page.goto(`${fixture}&fresh#/settings`);
	await page.getByRole('tab', { name: 'Acknowledgements' }).click();
	await page.evaluate(() => {
		location.hash = '#/settings?section=appearance&setting=contrast';
	});
	await expect(page.getByRole('checkbox', { name: 'Increase Contrast' })).toBeFocused();
	await expect(page.getByRole('tab', { name: 'General', exact: true })).toHaveAttribute(
		'aria-selected',
		'true'
	);
	await page.evaluate(() => {
		location.hash = '#/settings?section=developer';
	});
	await expect(page.getByRole('heading', { name: 'Developer', exact: true })).toBeFocused();
	const before = await page.evaluate(() => localStorage.getItem('fixture:release-history'));
	await page.getByRole('button', { name: 'Preview', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'What’s New in Syng 2.6.0' })).toBeVisible();
	expect(await page.evaluate(() => localStorage.getItem('fixture:release-history'))).toBe(before);
});

test('dark appearance retains readable notes', async ({ page }, testInfo) => {
	await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
	await page.goto(`${fixture}&mobile&appearance=contrast#/read`);
	await expect(page.getByRole('heading', { name: 'What’s New in Syng 2.6.0' })).toBeVisible();
	await page.screenshot({ path: testInfo.outputPath('whats-new-dark.png') });
	expect((await new AxeBuilder({ page }).disableRules(['region']).analyze()).violations).toEqual(
		[]
	);
});

test('failed content loading leaves an exit and retries on the next launch', async ({ page }) => {
	await page.route('**/components/WhatsNew/WhatsNewContent.svelte*', (route) => route.abort());
	await page.goto(`${fixture}#/read`);
	await expect(page.getByRole('alert')).toContainText('Release notes couldn’t load');
	expect(
		await page.evaluate(
			() => JSON.parse(localStorage.getItem('fixture:release-history')!).handledThroughVersion
		)
	).toBeNull();
	await page.getByRole('button', { name: 'Continue to Syng' }).first().click();
	await expect(page).toHaveURL(/#\/read$/);
	await page.unroute('**/components/WhatsNew/WhatsNewContent.svelte*');
	await page.reload();
	await expect(page.getByRole('heading', { name: 'What’s New in Syng 2.6.0' })).toBeVisible();
});

test('developer simulation validates the baseline and runs the real launch decision after reload', async ({
	page,
}) => {
	await page.goto(`${fixture}&fresh#/settings`);
	await expect(page.getByRole('button', { name: 'View changes', exact: true })).toBeVisible();
	await page.goto(`${fixture}#/settings?section=developer`);
	const version = page.getByRole('textbox', { name: 'Simulate an update from version' });
	await version.fill('2.7.0');
	await page.getByRole('button', { name: 'Simulate update', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('older than 2.6.0');
	await version.fill('2.5.3');
	await page.getByRole('button', { name: 'Simulate update', exact: true }).click();
	await expect(page.getByRole('heading', { name: 'What’s New in Syng 2.6.0' })).toBeVisible();
});
