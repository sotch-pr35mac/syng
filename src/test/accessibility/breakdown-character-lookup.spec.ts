import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

async function mockCharacterLookup(page: Page) {
	await expect(
		page.getByRole('button', { name: 'Character breakdown', exact: true })
	).toBeVisible();
	await page.evaluate(() => {
		const bridge = (
			window as unknown as {
				__TAURI_INTERNALS__: {
					invoke: (command: string, args: { text?: string }) => Promise<unknown>;
				};
			}
		).__TAURI_INTERNALS__;
		const original = bridge.invoke;
		bridge.invoke = async (command, args) => {
			if (command === 'query_by_chinese' && ['清', '语', '語', '汉'].includes(args.text)) {
				return [
					{
						id: `lookup-${args.text}`,
						simplified: args.text,
						traditional: args.text,
						english: [`Character lookup: ${args.text}`],
						pinyin_marks: ['qīng'],
						tones_marks: [1],
						measure_words: [],
					},
					{
						id: 'prefix-result',
						simplified: `${args.text}字`,
						traditional: `${args.text}字`,
						english: ['Prefix result must not appear'],
						pinyin_marks: [],
						measure_words: [],
					},
				];
			}
			return original(command, args);
		};
	});
}

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

for (const surface of ['desktop', 'popup', 'mobile', 'mobile-popup']) {
	test(`selected-character lookup preserves breakdown navigation: ${surface}`, async ({
		page,
	}) => {
		const mobile = surface.includes('mobile');
		const popup = surface.includes('popup');
		await page.setViewportSize(
			mobile ? { width: 390, height: 844 } : { width: 1100, height: 800 }
		);
		await page.goto(
			`/src/test/accessibility/index.html?breakdown&character=${encodeURIComponent('清语')}${mobile ? '&mobile' : ''}${popup ? '&popup' : ''}`
		);
		await mockCharacterLookup(page);
		await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
		const panel = page.getByRole('region', { name: 'Character breakdown' });
		await panel.getByRole('button', { name: 'Next character' }).click();
		await expect(panel).toContainText('2 of 2');
		const lookup = panel.getByRole('button', { name: 'Look up this character', exact: true });
		await lookup.focus();
		await lookup.press('Enter');
		await expect(page.getByText('Character lookup: 语', { exact: true })).toBeVisible();
		await expect(page.getByText('Prefix result must not appear', { exact: true })).toHaveCount(
			0
		);
		if (!popup) {
			if (mobile) {
				await expect(page).toHaveURL(/#\/breakdown$/);
				await expect(page.locator('.mobile-breakdown .breakdown')).toBeVisible();
			}
			await page
				.getByRole('button', { name: mobile ? 'Close' : 'Close dictionary', exact: true })
				.click();
		} else {
			await expect(panel).not.toBeVisible();
			await page.getByRole('button', { name: 'Back', exact: true }).click();
		}
		await expect(panel).toBeVisible();
		await expect(panel).toContainText('2 of 2');
		await expect(
			panel.getByRole('button', { name: 'Look up this character', exact: true })
		).toBeFocused();
	});
}

test('lookup follows the selected script', async ({ page }) => {
	await page.goto(
		`/src/test/accessibility/index.html?breakdown&character=${encodeURIComponent('语')}`
	);
	await mockCharacterLookup(page);
	await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
	const panel = page.getByRole('region', { name: 'Character breakdown' });
	await panel.getByRole('button', { name: 'Traditional', exact: true }).click();
	await panel.getByRole('button', { name: 'Look up this character', exact: true }).click();
	await expect(page.getByText('Character lookup: 語', { exact: true })).toBeVisible();
});

test('lookup is available when breakdown data fails to load', async ({ page }) => {
	await page.route('**/resources/character-breakdown/index.json', (route) =>
		route.fulfill({ status: 500, body: '' })
	);
	await page.goto(
		`/src/test/accessibility/index.html?breakdown&character=${encodeURIComponent('汉')}`
	);
	await mockCharacterLookup(page);
	await page.getByRole('button', { name: 'Character breakdown', exact: true }).click();
	const panel = page.getByRole('region', { name: 'Character breakdown' });
	await expect(panel).toContainText('Character data could not be loaded.');
	await expect(panel.getByRole('button', { name: 'Retry', exact: true })).toHaveCount(0);
	await panel.getByRole('button', { name: 'Look up this character', exact: true }).click();
	await expect(page.getByText('Character lookup: 汉', { exact: true })).toBeVisible();
});
