import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const fixture = '/src/test/accessibility/index.html?settings';
const scroller = '.settings--content, .mobile-settings__content';
const headingNames = ['Help & Maintenance', 'Chinese & Dictionary', 'Appearance', 'Developer'];

async function expectNoOverflow(page: Page): Promise<void> {
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
		true
	);
	expect(
		await page.locator(scroller).evaluate((node) => node.scrollWidth <= node.clientWidth)
	).toBe(true);
}

async function jump(page: Page, section: string): Promise<void> {
	await expect(page.getByRole('heading', { name: section, exact: true })).toBeVisible();
	const index = page.getByRole('navigation', { name: 'General settings sections' });
	if (await index.isVisible()) {
		await index.getByRole('button', { name: section, exact: true }).click();
	} else {
		// The compact picker is intentionally part of the scrolling content.
		await page.locator(scroller).evaluate((node) => {
			node.scrollTop = 0;
		});
		await page.getByRole('button', { name: 'Jump to section' }).click();
		await page.getByRole('menuitemradio', { name: section, exact: true }).click();
	}
	await expect(page.getByRole('heading', { name: section, exact: true })).toBeFocused();
}

for (const scenario of [
	{ name: 'desktop', width: 1200, mobile: false, fontSize: 16 },
	{ name: 'narrow desktop', width: 700, mobile: false, fontSize: 16 },
	{ name: 'small phone', width: 320, mobile: true, fontSize: 16 },
	{ name: 'phone', width: 393, mobile: true, fontSize: 16 },
	{ name: 'large text phone', width: 393, mobile: true, fontSize: 32 },
]) {
	test(`${scenario.name}: groups, section navigation, reachable controls and wrapping`, async ({
		page,
	}, testInfo) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.setViewportSize({ width: scenario.width, height: 852 });
		await page.goto(
			`${fixture}${scenario.mobile ? '&mobile' : ''}&fontSize=${scenario.fontSize}#/settings`
		);
		await expect(page.getByRole('heading', { level: 2 })).toHaveText(headingNames);
		await expect(
			page.getByRole('button', { name: 'Choose walkthrough: App tour' })
		).toBeVisible();
		await expectNoOverflow(page);
		await page.screenshot({ path: testInfo.outputPath('help.png') });
		await jump(page, 'Appearance');
		const heading = await page
			.getByRole('heading', { name: 'Appearance', exact: true })
			.boundingBox();
		const viewport = await page.locator(scroller).boundingBox();
		expect(heading!.y).toBeGreaterThanOrEqual(viewport!.y);
		await expectNoOverflow(page);
		await page.screenshot({ path: testInfo.outputPath('appearance.png') });
		await page.getByLabel('First Tone', { exact: true }).scrollIntoViewIfNeeded();
		const swatch = await page.getByLabel('First Tone', { exact: true }).boundingBox();
		if (scenario.mobile) {
			expect(swatch!.width).toBeGreaterThanOrEqual(44);
			expect(swatch!.height).toBeGreaterThanOrEqual(44);
		}
		await jump(page, 'Developer');
		await page.getByRole('button', { name: 'Show again' }).scrollIntoViewIfNeeded();
		await expect(page.getByRole('button', { name: 'Show again' })).toBeInViewport();
		await expectNoOverflow(page);
		expect(errors).toEqual([]);
	});
}

test('compact picker supports keyboard selection and Escape without changing route', async ({
	page,
}) => {
	await page.setViewportSize({ width: 393, height: 852 });
	await page.goto(`${fixture}&mobile#/settings`);
	const picker = page.getByRole('button', { name: 'Jump to section' });
	await picker.focus();
	await picker.press('Enter');
	await page.getByRole('menuitemradio', { name: 'Help & Maintenance' }).press('Escape');
	await expect(picker).toBeFocused();
	expect(await page.locator(scroller).evaluate((node) => node.scrollTop)).toBe(0);
	await picker.press('Enter');
	await page.getByRole('menuitemradio', { name: 'Help & Maintenance' }).press('a');
	await page.getByRole('menuitemradio', { name: 'Appearance', exact: true }).press('Enter');
	await expect(page.getByRole('heading', { name: 'Appearance', exact: true })).toBeFocused();
	await expect(page.getByRole('menu')).toHaveCount(0);
	expect(new URL(page.url()).hash).toBe('#/settings');
});

for (const mobile of [false, true]) {
	test(`${mobile ? 'mobile' : 'desktop'} restores position across tabs and route remounts`, async ({
		page,
	}) => {
		await page.setViewportSize({ width: mobile ? 393 : 1200, height: 852 });
		await page.goto(`${fixture}${mobile ? '&mobile&recovery&delay=150' : ''}#/settings`);
		if (mobile)
			await expect(page.getByRole('heading', { name: 'Bookmark Recovery' })).toBeVisible();
		await jump(page, 'Appearance');
		const position = await page.locator(scroller).evaluate((node) => node.scrollTop);
		await page.getByRole('tab', { name: 'Acknowledgements' }).click();
		await page.getByRole('tab', { name: 'General' }).click();
		await expect
			.poll(() => page.locator(scroller).evaluate((node) => node.scrollTop))
			.toBeCloseTo(position, 0);
		await page.getByRole('link', { name: 'Search', exact: true }).click();
		await page.getByRole('button', { name: 'Return to Settings' }).click();
		await expect
			.poll(() => page.locator(scroller).evaluate((node) => node.scrollTop))
			.toBeCloseTo(position, 0);
	});
}

test('section index follows scrolling and adapts when the window becomes narrow', async ({
	page,
}) => {
	await page.setViewportSize({ width: 1200, height: 852 });
	await page.goto(`${fixture}#/settings`);
	const navigation = page.getByRole('navigation', { name: 'General settings sections' });
	await expect(navigation).toBeVisible();
	await jump(page, 'Chinese & Dictionary');
	await expect(navigation.getByRole('button', { name: 'Chinese & Dictionary' })).toHaveAttribute(
		'aria-current',
		'location'
	);
	await page.locator(scroller).evaluate((node) => {
		node.scrollTop = node.scrollHeight;
	});
	await expect(navigation.getByRole('button', { name: 'Developer' })).toHaveAttribute(
		'aria-current',
		'location'
	);
	await page.setViewportSize({ width: 700, height: 852 });
	await expect(navigation).toBeHidden();
	await jump(page, 'Help & Maintenance');
	await expectNoOverflow(page);
});

test('restores a different tab after its asynchronous content loads', async ({ page }) => {
	await page.goto(`${fixture}&acknowledgements&delay=150#/settings`);
	await page.getByRole('tab', { name: 'Acknowledgements' }).click();
	await expect(page.getByText('Example library 30', { exact: true })).toBeVisible();
	await page.locator(scroller).evaluate((node) => {
		node.scrollTop = 500;
	});
	await expect.poll(() => page.locator(scroller).evaluate((node) => node.scrollTop)).toBe(500);
	await page.getByRole('tab', { name: 'General' }).click();
	await page.getByRole('tab', { name: 'Acknowledgements' }).click();
	await expect.poll(() => page.locator(scroller).evaluate((node) => node.scrollTop)).toBe(500);
});

test('iPad uses the responsive desktop shell with no updater', async ({ page }) => {
	await page.addInitScript(() => {
		Object.defineProperty(navigator, 'userAgent', { get: () => 'iPad' });
	});
	await page.setViewportSize({ width: 1024, height: 768 });
	await page.goto(`${fixture}&ipad#/settings`);
	await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Check for updates' })).toHaveCount(0);
	await jump(page, 'Appearance');
	await page.setViewportSize({ width: 507, height: 768 });
	await jump(page, 'Help & Maintenance');
	await expectNoOverflow(page);
});

for (const colorScheme of ['light', 'dark'] as const) {
	for (const appearance of ['original', 'contrast']) {
		test(`${colorScheme} ${appearance} settings retain readable layout`, async ({
			page,
		}, testInfo) => {
			await page.emulateMedia({ colorScheme });
			await page.setViewportSize({ width: 393, height: 852 });
			await page.goto(`${fixture}&mobile&appearance=${appearance}#/settings`);
			await jump(page, 'Appearance');
			await expectNoOverflow(page);
			if (appearance === 'contrast') {
				const result = await new AxeBuilder({ page }).include('.mobile-settings').analyze();
				expect(result.violations).toEqual([]);
			}
			await page.screenshot({
				path: testInfo.outputPath(`${colorScheme}-${appearance}.png`),
			});
		});
	}
}
