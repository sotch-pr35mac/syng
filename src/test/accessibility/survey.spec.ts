import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const fixture = '/src/test/accessibility/index.html?survey';

for (const scenario of [
	{ name: 'desktop', width: 1100, height: 900, query: '', scheme: 'light' },
	{ name: 'phone', width: 393, height: 852, query: '&mobile', scheme: 'light' },
	{ name: 'narrow phone', width: 320, height: 568, query: '&mobile', scheme: 'light' },
	{ name: 'large text', width: 393, height: 852, query: '&mobile&fontSize=32', scheme: 'light' },
	{
		name: 'dark contrast',
		width: 1100,
		height: 900,
		query: '&appearance=contrast',
		scheme: 'dark',
	},
] as const) {
	test(`survey ${scenario.name}: row selection, optional details and reachable actions`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize({ width: scenario.width, height: scenario.height });
		await page.emulateMedia({ colorScheme: scenario.scheme, reducedMotion: 'reduce' });
		await page.goto(fixture + scenario.query);
		const option = page.locator('.survey-choice').filter({ hasText: 'Independent study' });
		await option.click({ position: { x: (await option.boundingBox())!.width - 10, y: 20 } });
		await expect(page.getByRole('radio', { name: 'Independent study' })).toBeChecked();
		await expect(page.getByRole('link')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Skip survey' })).toBeInViewport();
		await page.screenshot({ path: testInfo.outputPath('learning-context.png') });
		await page.getByRole('button', { name: 'Next' }).click();
		await page.getByRole('checkbox', { name: 'Read Chinese' }).check();
		await page.getByRole('checkbox', { name: 'Something else' }).check();
		await page.getByRole('textbox').fill('Read family recipes');
		await page.getByRole('button', { name: 'Next' }).click();
		await page.getByRole('radio', { name: 'Somewhere else' }).check();
		await page.getByRole('textbox').click();
		await page.getByRole('textbox').fill('社区图书馆');
		await expect(page.getByRole('textbox')).toBeInViewport();
		await expect(page.getByRole('textbox')).toHaveAttribute('maxlength', '200');
		await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeInViewport();
		await expect(page.getByRole('button', { name: 'Skip survey' })).toBeInViewport();
		const overflow = await page.evaluate(
			() => document.documentElement.scrollWidth > innerWidth
		);
		expect(overflow).toBe(false);
		await page.screenshot({ path: testInfo.outputPath('discovery-other.png') });
		// Original appearance intentionally keeps Syng's palette; Contrast provides AA text roles.
		await page.evaluate(() => {
			document.documentElement.dataset.appearance = 'contrast';
		});
		// The attribute alone does not establish the rendered palette for the audit.
		// Check both text and filled controls before axe snapshots computed styles.
		await expect(page.locator('.about-you__counter')).toHaveCSS(
			'color',
			scenario.scheme === 'light' ? 'rgb(112, 112, 112)' : 'rgb(154, 155, 156)'
		);
		await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveCSS(
			'background-color',
			scenario.scheme === 'light' ? 'rgb(0, 113, 235)' : 'rgb(118, 175, 249)'
		);
		const audit = await new AxeBuilder({ page })
			.withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
			.analyze();
		expect(audit.violations).toEqual([]);
		await page.getByRole('button', { name: 'Back' }).click();
		await expect(page.getByRole('textbox')).toHaveValue('Read family recipes');
	});
}

test('survey supports native keyboard selection and a visible row focus state', async ({
	page,
	browserName,
}) => {
	const tabKey = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(fixture);
	await expect(page.locator('legend')).toBeFocused();
	await page.keyboard.press(tabKey);
	const first = page.getByRole('radio', { name: 'School or university classes' });
	await expect(first).toBeFocused();
	const focus = await first.evaluate(
		(node) => getComputedStyle(node.closest('label')!).outlineStyle
	);
	expect(focus).toBe('solid');
	await page.keyboard.press('ArrowDown');
	await expect(
		page.getByRole('radio', { name: 'Intensive or study-abroad program' })
	).toBeChecked();
	await page.getByRole('button', { name: 'Next' }).click();
	// The step schedules heading focus after mounting. Let it finish before
	// directing keyboard input, or it can steal focus between key presses.
	await expect(page.locator('legend')).toBeFocused();
	const other = page.getByRole('checkbox', { name: 'Something else' });
	await other.focus();
	await page.keyboard.press('Space');
	await page.keyboard.press(tabKey);
	await expect(page.getByRole('textbox')).toBeFocused();
	await page.keyboard.type('Community events');
	await other.focus();
	await page.keyboard.press('Space');
	await expect(page.getByRole('textbox')).toHaveCount(0);
});
