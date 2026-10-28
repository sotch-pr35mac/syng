import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
	await page.route('**/resources/**', async (route) => {
		const relative = new URL(route.request().url()).pathname.split('/resources/')[1];
		try {
			await route.fulfill({
				body: await readFile(resolve('src/views/resources', decodeURIComponent(relative))),
				contentType: 'application/json',
			});
		} catch {
			await route.fulfill({ status: 404, body: '' });
		}
	});
});
test('iPad resizing preserves the panel and reconciles Back in both directions', async ({
	page,
}) => {
	await page.addInitScript(() =>
		Object.defineProperty(navigator, 'userAgent', { value: 'iPad' })
	);
	await page.goto('/src/test/accessibility/index.html?breakdown&ipad');
	const panel = page.getByRole('region', { name: 'Character breakdown' });
	await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
	await panel.getByRole('button', { name: 'Component 2: Sound' }).click();
	await expect
		.poll(() => page.evaluate(() => window.history.state?.syngBreakdown))
		.toBeUndefined();
	await page.setViewportSize({ width: 550, height: 800 });
	await expect(panel.getByRole('button', { name: 'Back to dictionary' })).toBeVisible();
	await expect
		.poll(() => page.evaluate(() => window.history.state?.syngBreakdown?.depth))
		.toBe(1);
	await page.setViewportSize({ width: 1100, height: 800 });
	await expect(panel.getByRole('button', { name: 'Close character breakdown' })).toBeVisible();
	await expect
		.poll(() => page.evaluate(() => window.history.state?.syngBreakdown))
		.toBeUndefined();
	await expect(panel.getByRole('button', { name: 'Component 2: Sound' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.setViewportSize({ width: 550, height: 800 });
	await expect
		.poll(() => page.evaluate(() => window.history.state?.syngBreakdown?.depth))
		.toBe(1);
	await page.goBack();
	await expect(panel).not.toBeVisible();
	await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
	await panel.getByRole('button', { name: 'Back to dictionary' }).click();
	await expect(panel).not.toBeVisible();
});

test('first lazy opening focuses the mounted panel rather than its removed loading button', async ({
	page,
}) => {
	let release: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	await page.route('**/CharacterBreakdown.svelte*', async (route) => {
		await gate;
		await route.continue();
	});
	await page.goto('/src/test/accessibility/index.html?breakdown&popup');
	await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
	await expect(page.getByText('Loading character breakdown…')).toBeVisible();
	release();
	await expect(page.getByRole('button', { name: 'Back to dictionary' })).toBeFocused();
});

test('a failed packaged panel shows Back without a retry action or another import attempt', async ({
	page,
}) => {
	let requests = 0;
	await page.route('**/CharacterBreakdown.svelte*', async (route) => {
		requests++;
		await route.abort();
	});
	await page.goto('/src/test/accessibility/index.html?breakdown&popup');
	await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Character breakdown could not be loaded.');
	await expect(page.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);
	await page.getByRole('button', { name: 'Back', exact: true }).click();
	await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Character breakdown could not be loaded.');
	expect(requests).toBe(1);
});

test('nested measure-word lookup opens its canonical lexical ID', async ({ page }) => {
	await page.goto('/src/test/accessibility/index.html?breakdown&popup');
	await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
	await page.getByRole('button', { name: 'Look up 青', exact: true }).click();
	await page.getByRole('button', { name: '行', exact: true }).click();
	await expect(page.getByText('Referenced classifier reading')).toBeVisible();
	await expect(page.getByText('Wrong homograph')).toHaveCount(0);
});
test('companion: real data, forgiving hover, stable notes, manual close and word changes', async ({
	page,
}) => {
	await page.goto('/src/test/accessibility/index.html?breakdown');
	const panel = page.getByRole('region', { name: 'Character breakdown' });
	await expect(panel).toHaveCount(0);
	await page.getByRole('button', { name: '要', exact: true }).click();
	await expect(panel).toHaveCount(0);
	await page.getByRole('button', { name: '清', exact: true }).click();
	await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
	await expect(panel).toBeVisible();
	await expect(panel.locator('.character-nav')).toHaveCount(0);
	await expect(panel.locator('footer')).toHaveCount(0);
	await expect(panel.getByRole('button', { name: 'Look up 青', exact: true })).toHaveCSS(
		'text-decoration-line',
		'none'
	);
	await expect(panel.getByRole('button', { name: 'Look up radical 氵', exact: true })).toHaveCSS(
		'text-decoration-line',
		'none'
	);
	await expect(panel).toContainText('氵 represents the meaning');
	await expect(panel).not.toContainText('green or blue');
	await expect(panel.locator('.glyph path')).toHaveCount(11);
	// Hover waits for the sliding drawer to settle before choosing a whitespace point.
	await panel.locator('.glyph-hit').hover({ position: { x: 16, y: 16 } });
	await expect(panel.locator('.component.active')).toHaveCount(1);
	await expect(panel.locator('.glyph path.selected')).toHaveCount(3);
	await expect(panel.locator('.glyph path.muted').first()).toHaveCSS('opacity', '0.24');
	const selectedFill = await panel
		.locator('.glyph path.selected')
		.first()
		.evaluate((node) => getComputedStyle(node).fill);
	const otherFill = await panel
		.locator('.glyph path.muted')
		.first()
		.evaluate((node) => getComputedStyle(node).fill);
	expect(selectedFill).not.toBe(otherFill);
	const controls = await panel.locator('.components').boundingBox();
	await panel.getByRole('button', { name: 'Component 2: Sound' }).hover();
	expect((await panel.locator('.components').boundingBox()).y).toBe(controls.y);
	await page.getByRole('button', { name: '要', exact: true }).click();
	await expect(panel).toContainText('Pictograph of two hands');
	await expect(panel.getByRole('button', { name: 'Look up radical 覀' })).toHaveCount(0);
	await expect(panel.locator('.fragment')).toHaveCount(1);
	await panel.locator('.fragment').hover();
	await expect(panel.locator('.glyph path.selected')).toHaveCount(6);
	await expect(panel.locator('.component').first()).toHaveClass(/active/);
	await panel
		.locator('.component')
		.nth(1)
		.hover({ position: { x: 2, y: 2 } });
	await expect(panel.locator('.glyph path.selected')).toHaveCount(3);
	await panel.getByRole('button', { name: 'Close character breakdown' }).click();
	await expect(panel).not.toBeVisible();
	await page.getByRole('button', { name: '清', exact: true }).click();
	await expect(panel).not.toBeVisible();
	await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
	await expect(panel).toBeVisible();
	await page.getByRole('button', { name: '喷', exact: true }).click();
	await expect(panel).toBeVisible();
	await expect(panel).toContainText('Unverified by Dong Chinese');
	await page.getByRole('button', { name: '清清🙂', exact: true }).click();
	await expect(panel).toBeVisible();
	await panel.getByRole('button', { name: 'Next character' }).click();
	await expect(panel).toContainText('2 of 3');
	await panel.getByRole('button', { name: 'Next character' }).click();
	await expect(panel).toContainText('3 of 3');
	await expect(panel).toContainText('Formation information is not available');
});
for (const mobile of [false, true]) {
	test(`popup replacement preserves local navigation without page history (${mobile ? 'mobile' : 'desktop'})`, async ({
		page,
	}) => {
		if (mobile) {
			await page.setViewportSize({ width: 390, height: 844 });
		}
		await page.goto(
			`/src/test/accessibility/index.html?breakdown&popup${mobile ? '&mobile' : ''}`
		);
		await expect(page.getByRole('region', { name: 'Character breakdown' })).toHaveCount(0);
		const pageHistory = await page.evaluate(() => ({
			length: history.length,
			state: history.state,
			url: location.href,
		}));
		const root = page.locator('.dictionary-content-container').first();
		await root.evaluate((node) => (node.scrollTop = 10));
		const scroll = await root.evaluate((node) => node.scrollTop);
		await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
		const panel = page.getByRole('region', { name: 'Character breakdown' });
		await expect(panel).toBeVisible();
		expect(
			await page.evaluate(() => ({
				length: history.length,
				state: history.state,
				url: location.href,
			}))
		).toEqual(pageHistory);
		await expect(panel.getByRole('heading', { name: 'Character breakdown' })).toHaveCount(0);
		await expect(panel.getByRole('button', { name: 'Close dictionary' })).toBeVisible();
		await panel.locator('.formation').getByRole('button', { name: '青', exact: true }).click();
		await expect(panel).not.toBeVisible();
		await page.getByRole('button', { name: 'Back', exact: true }).click();
		await expect(panel).toBeVisible();
		await panel.getByRole('button', { name: 'Component 1: Meaning' }).click();
		await panel.locator('.notes').getByRole('button', { name: '水', exact: true }).click();
		await expect(panel).not.toBeVisible();
		await page.getByRole('button', { name: 'Back', exact: true }).click();
		await expect(panel).toBeVisible();
		const back = panel.getByRole('button', { name: 'Back to dictionary' });
		const label = await back.locator('span').boundingBox(),
			icon = await back.locator('svg').boundingBox();
		expect(Math.abs(label.y + label.height / 2 - icon.y - icon.height / 2)).toBeLessThan(1);
		await panel.getByRole('button', { name: 'Component 2: Sound' }).click();
		await panel.getByRole('button', { name: 'Look up 青', exact: true }).click();
		await expect(panel).not.toBeVisible();
		await page.getByRole('button', { name: 'Back', exact: true }).click();
		await expect(panel).toBeVisible();
		await expect(panel.getByRole('button', { name: 'Component 2: Sound' })).toHaveAttribute(
			'aria-pressed',
			'true'
		);
		await panel.getByRole('button', { name: 'Back to dictionary' }).click();
		await expect(panel).not.toBeVisible();
		await expect(root).toBeVisible();
		expect(
			await page.evaluate(() => ({
				length: history.length,
				state: history.state,
				url: location.href,
			}))
		).toEqual(pageHistory);
		await expect(page.getByRole('dialog', { name: 'Dictionary', exact: true })).toBeVisible();
		expect(await root.evaluate((node) => node.scrollTop)).toBe(scroll);
		await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
		await panel.getByRole('button', { name: 'Close dictionary' }).click();
		await expect(page.getByRole('dialog', { name: 'Dictionary', exact: true })).toHaveCount(0);
	});
}
test('mobile full entry uses a route; study and narrow entries never auto-open', async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/src/test/accessibility/index.html?breakdown&mobile');
	const origin = page.url();
	await expect(page.getByRole('region', { name: 'Character breakdown' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
	await expect(page).toHaveURL(/#\/breakdown$/);
	await expect(page.getByRole('region', { name: 'Character breakdown' })).toBeVisible();
	const glyph = page.locator('.glyph-hit');
	await expect(glyph).toBeVisible();
	const bounds = await glyph.boundingBox();
	// A tap does not require a preceding pointermove/hover event.
	await glyph.dispatchEvent('click', {
		clientX: bounds.x + bounds.width * 0.1,
		clientY: bounds.y + bounds.height * 0.5,
	});
	await expect(page.getByRole('button', { name: 'Component 1: Meaning' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.getByRole('button', { name: 'Back to dictionary' }).click();
	await expect(page).toHaveURL(origin);
	await expect(
		page.getByRole('button', { name: 'Character breakdown', exact: true })
	).toBeVisible();
	await page.goto('/src/test/accessibility/index.html?breakdown&study');
	await expect(page.getByRole('region', { name: 'Character breakdown' })).toHaveCount(0);
	await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Back to dictionary' })).toBeVisible();
});
test('mobile popup Back preserves the underlying study breakdown and its history', async ({
	page,
}) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/src/test/accessibility/index.html?breakdown&study&mobile');
	await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
	const study = page.locator('.entry').getByRole('region', { name: 'Character breakdown' });
	await study.getByRole('button', { name: 'Component 2: Sound' }).click();
	const studyHistory = await page.evaluate(() => ({
		length: history.length,
		state: history.state,
	}));
	await study.getByRole('button', { name: 'Look up 青', exact: true }).click();
	const popup = page.getByRole('dialog');
	await popup.getByRole('button', { name: 'Character breakdown', exact: true }).click();
	const popupBreakdown = popup.getByRole('region', { name: 'Character breakdown' });
	await popupBreakdown
		.getByRole('button', { name: 'Look up this character', exact: true })
		.click();
	await expect(popupBreakdown).not.toBeVisible();
	await popup.getByRole('button', { name: 'Back', exact: true }).click();
	await expect(popupBreakdown).toBeVisible();
	await expect(study).toBeVisible();
	await expect(study.getByRole('button', { name: 'Component 2: Sound' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await popupBreakdown.getByRole('button', { name: 'Close dictionary', exact: true }).click();
	await expect(popup).not.toBeVisible();
	expect(await page.evaluate(() => ({ length: history.length, state: history.state }))).toEqual(
		studyHistory
	);
	await expect(study).toBeVisible();
	await expect(study.getByRole('button', { name: 'Component 2: Sound' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.goBack();
	await expect(study).not.toBeVisible();
});

test('breakdown is accessible with enlarged text and high contrast', async ({ page }) => {
	await page.goto('/src/test/accessibility/index.html?breakdown&fontSize=20&appearance=contrast');
	await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
	await expect(page.getByRole('region', { name: 'Character breakdown' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Look up 青', exact: true })).toBeVisible();
	const results = await new AxeBuilder({ page }).include('.breakdown').analyze();
	expect(results.violations).toEqual([]);
});

for (const surface of ['desktop', 'popup', 'mobile', 'mobile-popup']) {
	test(`visual review: ${surface}`, async ({ page }, testInfo) => {
		const mobile = surface.includes('mobile'),
			popup = surface.includes('popup');
		await page.setViewportSize(
			mobile ? { width: 320, height: 740 } : { width: 1100, height: 800 }
		);
		await page.emulateMedia({
			colorScheme: mobile ? 'dark' : 'light',
			reducedMotion: 'reduce',
		});
		await page.goto(
			`/src/test/accessibility/index.html?breakdown${mobile ? '&mobile' : ''}${popup ? '&popup' : ''}`
		);
		await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
		const panel = page.getByRole('region', { name: 'Character breakdown' });
		await expect(panel.locator('.glyph path')).toHaveCount(11);
		expect(await panel.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
		await expect(panel).toBeVisible();
		await expect(panel.locator('.glyph path').first()).toBeVisible();
		await page.evaluate(async () => {
			await document.fonts.ready;
			await new Promise((resolve) =>
				requestAnimationFrame(() => requestAnimationFrame(resolve))
			);
		});

		await page.screenshot({ path: testInfo.outputPath(`${surface}.png`) });
	});
}

for (const [character, strokes, mapped] of [
	['试', 8, true],
	['考', 6, true],
	['西', 6, false],
	['要', 9, true],
	['說', 14, true], // Geometry is in the separately licensed Arphic resource.
] as const) {
	test(`reported character: ${character}`, async ({ page }) => {
		await page.goto(
			`/src/test/accessibility/index.html?breakdown&character=${encodeURIComponent(character)}`
		);
		await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
		const panel = page.getByRole('region', { name: 'Character breakdown' });
		await expect(panel.locator('.glyph path')).toHaveCount(strokes);
		if (mapped) {
			await panel.locator('.glyph-hit').hover({ position: { x: 24, y: 64 } });
			await expect(panel.locator('.glyph path.selected').first()).toBeVisible();
			await expect(panel.locator('.component.active')).toHaveCount(1);
		} else {
			await expect(panel.locator('.glyph-hit')).toHaveCount(0);
		}
	});
}
