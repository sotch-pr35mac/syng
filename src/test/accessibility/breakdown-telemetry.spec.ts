import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type Event = { name: string; payload: Record<string, unknown> };
const events = (page: Page) =>
	page.evaluate(() => (Reflect.get(window, '__BREAKDOWN_EVENTS__') ?? []) as Event[]);
const count = async (page: Page, suffix: string) =>
	(await events(page)).filter((event) => event.name === `dictionary.breakdown_${suffix}`).length;
test.beforeEach(async ({ page }) => {
	await page.route('**/resources/**', async (route) => {
		const path = new URL(route.request().url()).pathname.split('/resources/')[1];
		try {
			await route.fulfill({
				body: await readFile(resolve('src/views/resources', decodeURIComponent(path))),
				contentType: 'application/json',
			});
		} catch {
			await route.fulfill({ status: 404, body: '' });
		}
	});
});

for (const mobile of [false, true]) {
	test(`popup lookup interactions stay in one breakdown visit (${mobile ? 'mobile' : 'desktop'})`, async ({
		page,
	}) => {
		if (mobile) await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(
			`/src/test/accessibility/index.html?breakdown&popup${mobile ? '&mobile' : ''}`
		);
		expect(await count(page, 'opened')).toBe(0);
		await page.getByRole('button', { name: 'Character Breakdown', exact: true }).click();
		const panel = page.getByRole('region', { name: 'Character Breakdown' });
		await expect(panel).toBeVisible();
		for (const target of [
			panel.getByRole('button', { name: 'Look up this character', exact: true }),
			panel.getByRole('button', { name: 'Look up 青', exact: true }),
			panel.locator('.formation').getByRole('button', { name: '青', exact: true }),
			panel.getByRole('button', { name: 'Look up radical 氵', exact: true }),
		]) {
			await target.click();
			await expect(panel).not.toBeVisible();
			await page.getByRole('button', { name: 'Back', exact: true }).click();
			await expect(panel).toBeVisible();
		}
		expect(await count(page, 'opened')).toBe(1);
		expect(await count(page, 'closed')).toBe(0);
		await panel.getByRole('button', { name: 'Close dictionary', exact: true }).click();
		await expect.poll(() => count(page, 'closed')).toBe(1);
		const captured = await events(page);
		for (const action of [
			'character_lookup',
			'component_lookup',
			'description_lookup',
			'radical_lookup',
		]) {
			expect(captured.filter((event) => event.payload.action === action)).toHaveLength(1);
		}
		expect(JSON.stringify(captured)).not.toMatch(
			/清|青|氵|fixture-|component-|dictionary\/|Phonosemantic/
		);
	});
}

test('sidebar resizing does not duplicate lifecycle events and previews are bounded', async ({
	page,
}) => {
	await page.addInitScript(() =>
		Object.defineProperty(navigator, 'userAgent', { value: 'iPad' })
	);
	await page.goto('/src/test/accessibility/index.html?breakdown&ipad');
	await page.getByRole('button', { name: 'Character Breakdown', exact: true }).click();
	const panel = page.getByRole('region', { name: 'Character Breakdown' });
	await panel.getByRole('button', { name: 'Component 2: Sound' }).hover();
	await panel.getByRole('button', { name: 'Component 2: Sound' }).click();
	await panel.locator('.glyph-hit').hover({ position: { x: 16, y: 16 } });
	await panel.getByRole('button', { name: 'Component 2: Sound' }).hover();
	await page.setViewportSize({ width: 550, height: 800 });
	await expect(panel.getByRole('button', { name: 'Back to dictionary' })).toBeVisible();
	await page.setViewportSize({ width: 1100, height: 800 });
	await expect(panel.getByRole('button', { name: 'Close character breakdown' })).toBeVisible();
	expect(await count(page, 'opened')).toBe(1);
	expect(await count(page, 'closed')).toBe(0);
	const previews = (await events(page)).filter(
		(event) => event.payload.action === 'component_previewed'
	);
	expect(previews.length).toBeGreaterThan(0);
	expect(previews.length).toBeLessThanOrEqual(2);
	await page.getByRole('button', { name: '语', exact: true }).click();
	await panel.getByRole('button', { name: 'Traditional', exact: true }).click();
	await page.getByRole('button', { name: '清清🙂', exact: true }).click();
	await panel.getByRole('button', { name: 'Next character' }).click();
	await panel.getByRole('button', { name: 'Close character breakdown' }).click();
	await expect.poll(() => count(page, 'closed')).toBe(1);
	const captured = await events(page);
	expect(captured.filter((event) => event.payload.action === 'script_changed')).toHaveLength(1);
	expect(captured.filter((event) => event.payload.action === 'character_changed')).toHaveLength(
		1
	);
	expect(
		captured.find((event) => event.name === 'dictionary.breakdown_closed')?.payload.reason
	).toBe('dismissed');
});

for (const source of ['search', 'flashcards', 'quiz']) {
	test(`mobile ${source} route has one open and close, without an extra origin-page event`, async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(
			`/src/test/accessibility/index.html?breakdown&mobile${source === 'search' ? '' : `#/study/${source}?list=Review`}`
		);
		await page.getByRole('button', { name: 'Character Breakdown', exact: true }).click();
		await expect(page.getByRole('region', { name: 'Character Breakdown' })).toBeVisible();
		expect(await count(page, 'opened')).toBe(1);
		const panel = page.locator('.mobile-breakdown .breakdown');
		await panel.getByRole('button', { name: 'Component 1: Meaning' }).click();
		const route = page.url();
		for (const link of [
			panel.getByRole('button', { name: 'Look up this character', exact: true }),
			panel.getByRole('button', { name: 'Look up 青', exact: true }),
			panel.locator('.formation').getByRole('button', { name: '青', exact: true }),
			panel.getByRole('button', { name: 'Look up radical 氵', exact: true }),
		]) {
			await link.focus();
			await link.press('Enter');
			await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeVisible();
			await expect(page).toHaveURL(route);
			await expect(panel).toBeVisible();
			await expect(page.locator('.mobile-breakdown .nested-header')).toHaveCount(0);
			await page.getByRole('button', { name: 'Close', exact: true }).click();
			await expect(link).toBeFocused();
			await expect(
				panel.getByRole('button', { name: 'Component 1: Meaning' })
			).toHaveAttribute('aria-pressed', 'true');
		}
		expect(await count(page, 'opened')).toBe(1);
		expect(await count(page, 'closed')).toBe(0);
		await page.getByRole('button', { name: 'Back to dictionary' }).click();
		await expect(page.getByRole('region', { name: 'Character Breakdown' })).toHaveCount(0);
		expect(await count(page, 'closed')).toBe(1);
		const captured = await events(page);
		expect(
			captured.find((event) => event.name === 'dictionary.breakdown_opened')?.payload
		).toMatchObject({ surface: 'mobile_screen', source });
	});
}
