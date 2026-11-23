import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const fixture = '/src/test/accessibility/index.html?settings';
const scroller = '.settings--content, .mobile-settings__content';
const headingNames = ['Help & Maintenance', 'Chinese & Dictionary', 'Appearance', 'Developer'];

async function swipeBackFrom(page: Page, selector: string): Promise<void> {
	await page.locator(selector).evaluate((element) => {
		// Synthetic pointer events need a capture stub; the native gesture path is unchanged.
		element.setPointerCapture = () => {};
		for (const [eventName, clientX] of [
			['pointerdown', 10],
			['pointermove', 210],
			['pointerup', 230],
		] as const) {
			element.dispatchEvent(
				new PointerEvent(eventName, {
					bubbles: true,
					cancelable: true,
					pointerId: 1,
					pointerType: 'touch',
					clientX,
					clientY: 240,
				})
			);
		}
	});
}

test('mobile Settings detail returns home after an edge swipe', async ({ page }) => {
	await page.setViewportSize({ width: 393, height: 852 });
	await page.goto(`${fixture}&mobile#/settings`);
	await page.getByRole('button', { name: /^Appearance/ }).click();
	await expect(page.getByRole('heading', { name: 'Appearance', level: 1 })).toBeVisible();
	const detailPage = page.locator('.mobile-settings__page');
	await swipeBackFrom(page, '.mobile-settings__page');
	await expect(page.getByRole('button', { name: /^Appearance/ })).toBeVisible();
	await expect(detailPage).toHaveCSS('transform', 'none');
});

test('mobile Telemetry queue swipe returns to Telemetry Settings first', async ({ page }) => {
	await page.setViewportSize({ width: 393, height: 852 });
	await page.goto(`${fixture}&mobile#/settings`);
	await page.getByRole('button', { name: /^Telemetry/ }).click();
	await page.getByRole('button', { name: 'Inspect queue →' }).click();
	await expect(page.getByRole('heading', { name: 'Pending payloads' })).toBeVisible();
	await swipeBackFrom(page, '.telemetry--queue-view');
	await expect(page.getByRole('heading', { name: 'Telemetry', exact: true, level: 1 })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Inspect queue →' })).toBeVisible();
	await swipeBackFrom(page, '.mobile-settings__page');
	await expect(page.getByRole('button', { name: /^Telemetry/ })).toBeVisible();
});

test('desktop section index remains visible at the default window width', async ({ page }) => {
	await page.setViewportSize({ width: 1110, height: 655 });
	await page.goto(`${fixture}#/settings`);
	await expect(page.getByRole('navigation', { name: 'General settings sections' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Jump to section' })).toBeHidden();
	await expectNoOverflow(page);

	await page.setViewportSize({ width: 900, height: 655 });
	await expect(page.getByRole('navigation', { name: 'General settings sections' })).toBeHidden();
	await expect(page.getByRole('button', { name: 'Jump to section' })).toBeVisible();
	await expectNoOverflow(page);
});

for (const width of [1200, 1110, 1020, 900, 700]) {
	test(`desktop Appearance preview stays separate from controls at ${width}px`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize({ width, height: width === 1110 ? 655 : 768 });
		await page.goto(`${fixture}#/settings`);
		await jump(page, 'Appearance');
		const preview = (await page
			.locator('.general-settings__appearance-preview')
			.boundingBox())!;
		const controls = (await page
			.locator('.general-settings__appearance-controls')
			.boundingBox())!;
		if (width > 700) {
			expect(preview.x).toBeGreaterThanOrEqual(controls.x + controls.width - 1);
		} else {
			expect(preview.y + preview.height).toBeLessThanOrEqual(controls.y + 1);
		}
		await expectNoOverflow(page);
		await page.screenshot({ path: testInfo.outputPath('appearance-layout.png') });
	});
}

test('desktop radio choices center wrapped labels and match setting typography', async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 1200, height: 852 });
	await page.goto(`${fixture}#/settings`);
	await jump(page, 'Chinese & Dictionary');
	const rowTitle = page.getByRole('heading', { name: 'HSK standard', exact: true });
	const choices = page.locator('.character-set-selector .sy-radio-group label > span');
	await expect(choices).toHaveCount(3);
	const positions = await choices.evaluateAll((spans) =>
		spans.map((span) => {
			const range = document.createRange();
			range.selectNodeContents(span);
			const bounds = range.getBoundingClientRect();
			return bounds.top + bounds.height / 2;
		})
	);
	expect(Math.max(...positions) - Math.min(...positions)).toBeLessThan(1);
	await expect(choices.first()).toHaveCSS(
		'font-size',
		await rowTitle.evaluate((element) => getComputedStyle(element).fontSize)
	);
	await page.screenshot({ path: testInfo.outputPath('radio-choices.png') });
});

test('telemetry radio choices align with the search field and retain phone touch targets', async ({
	page,
}) => {
	for (const mobile of [false, true]) {
		await page.setViewportSize({ width: mobile ? 393 : 1200, height: 852 });
		await page.goto(`${fixture}${mobile ? '&mobile' : ''}#/settings`);
		if (mobile) {
			await page.getByRole('button', { name: /^Telemetry/ }).click();
		} else {
			await page.getByRole('tab', { name: 'Telemetry' }).click();
		}
		await page.getByRole('button', { name: 'Inspect queue →' }).click();
		const searchHeight = (await page
			.getByRole('searchbox', { name: 'Find a queued event' })
			.boundingBox())!.height;
		const group = page.locator('.telemetry--queue-filters .sy-radio-group');
		const groupHeight = (await group.boundingBox())!.height;
		expect(Math.abs(groupHeight - searchHeight)).toBeLessThanOrEqual(mobile ? 8 : 1);
		if (mobile) {
			for (const label of await group.locator('label').all()) {
				expect((await label.boundingBox())!.height).toBeGreaterThanOrEqual(44);
			}
		}
	}
});

async function expectNoOverflow(page: Page): Promise<void> {
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
		true
	);
	expect(
		await page.locator(scroller).evaluate((node) => node.scrollWidth <= node.clientWidth)
	).toBe(true);
}

async function jump(page: Page, section: string): Promise<void> {
	await expect(page.locator('.mobile-settings, .settings--container')).toBeVisible();
	if (await page.locator('.mobile-settings').isVisible()) {
		const back = page.getByRole('button', { name: 'Settings' });
		if (await back.isVisible()) await back.click();
		await page.getByRole('button', { name: new RegExp(`^${section}`) }).click();
		await expect(
			page.getByRole('heading', { name: section, exact: true, level: 1 })
		).toBeVisible();
		return;
	}
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
		await expect(page.getByRole('heading', { level: 2 })).toHaveText(
			scenario.mobile
				? ['Preferences', 'Privacy', 'Help & information', 'Developer']
				: headingNames
		);
		if (scenario.mobile) await jump(page, 'Help & Maintenance');
		await expect(
			page.getByRole('button', { name: 'Choose walkthrough: App tour' })
		).toBeVisible();
		await expectNoOverflow(page);
		await page.screenshot({ path: testInfo.outputPath('help.png') });
		await jump(page, 'Appearance');
		const heading = await page
			.getByRole('heading', {
				name: 'Appearance',
				exact: true,
				level: scenario.mobile ? 1 : 2,
			})
			.boundingBox();
		const viewport = await page.locator(scroller).boundingBox();
		expect(heading!.y).toBeGreaterThanOrEqual(scenario.mobile ? 0 : viewport!.y);
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

test('mobile settings groups support keyboard detail navigation and back', async ({ page }) => {
	await page.setViewportSize({ width: 393, height: 852 });
	await page.goto(`${fixture}&mobile#/settings`);
	const appearance = page.getByRole('button', { name: /^Appearance/ });
	await appearance.focus();
	await appearance.press('Enter');
	await expect(
		page.getByRole('heading', { name: 'Appearance', exact: true, level: 1 })
	).toBeVisible();
	await page.getByRole('button', { name: 'Settings' }).click();
	await expect(appearance).toBeVisible();
	expect(new URL(page.url()).hash).toBe('#/settings');
});

for (const mobile of [false, true]) {
	test(`${mobile ? 'mobile' : 'desktop'} restores position across tabs and route remounts`, async ({
		page,
	}) => {
		await page.setViewportSize({ width: mobile ? 393 : 1200, height: 852 });
		await page.goto(`${fixture}${mobile ? '&mobile&recovery&delay=150' : ''}#/settings`);
		if (mobile) {
			await jump(page, 'Help & Maintenance');
			await expect(page.getByRole('heading', { name: 'Bookmark Recovery' })).toBeVisible();
		}
		await jump(page, 'Appearance');
		if (mobile) {
			await page.locator(scroller).evaluate((node) => {
				node.scrollTop = Math.min(300, node.scrollHeight - node.clientHeight);
			});
		}
		const position = await page.locator(scroller).evaluate((node) => node.scrollTop);
		if (mobile) {
			await jump(page, 'Acknowledgements');
			await jump(page, 'Appearance');
		} else {
			await page.getByRole('tab', { name: 'Acknowledgements' }).click();
			await page.getByRole('tab', { name: 'General' }).click();
		}
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
