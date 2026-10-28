import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

for (const mobile of [false, true]) {
	for (const multiple of [false, true]) {
		test(`nested popup header stays aligned (${mobile ? 'mobile' : 'desktop'}, ${multiple ? 'multiple' : 'single'} result)`, async ({
			page,
		}, testInfo) => {
			await page.setViewportSize({ width: mobile ? 320 : 1100, height: 844 });
			await page.route('**/resources/**', async (route) => {
				const path = new URL(route.request().url()).pathname.split('/resources/')[1];
				await route.fulfill({
					body: await readFile(resolve('src/views/resources', decodeURIComponent(path))),
					contentType: 'application/json',
				});
			});
			await page.goto(
				`/src/test/accessibility/index.html?breakdown&popup${mobile ? '&mobile' : ''}`
			);
			const open = page.getByRole('button', { name: 'Character Breakdown', exact: true });
			await expect(open).toBeVisible();
			if (multiple) {
				await page.evaluate(() => {
					const bridge = Reflect.get(window, '__TAURI_INTERNALS__');
					const original = bridge.invoke;
					bridge.invoke = async (command, args) => {
						const result = await original(command, args);
						return command === 'query_by_chinese' && args.text === '青'
							? [...result, { ...result[0], id: 'second-sense' }]
							: result;
					};
				});
			}
			await open.click();
			const panel = page.getByRole('region', { name: 'Character Breakdown' });
			const originalHeader = panel.locator('header');
			const originalBack = await panel
				.getByRole('button', { name: 'Back to dictionary' })
				.boundingBox();
			const originalBounds = await originalHeader.boundingBox();
			await panel.getByRole('button', { name: 'Look up 青', exact: true }).click();
			const header = page.locator('.nested-header:visible');
			await expect(header).toBeVisible();
			await page.screenshot({ path: testInfo.outputPath('nested.png') });
			const bounds = await header.boundingBox();
			const back = header.getByRole('button', { name: 'Back', exact: true });
			const backBounds = await back.boundingBox();
			const label = await back.locator('span').boundingBox();
			const icon = await back.locator('svg').boundingBox();
			expect(Math.abs(bounds.height - originalBounds.height)).toBeLessThan(1);
			expect(Math.abs(backBounds.x - originalBack.x)).toBeLessThan(1);
			expect(Math.abs(backBounds.y - originalBack.y)).toBeLessThan(1);
			expect(Math.abs(label.y + label.height / 2 - icon.y - icon.height / 2)).toBeLessThan(1);
			const close = await header
				.getByRole('button', { name: 'Close dictionary' })
				.boundingBox();
			expect(
				Math.abs(close.y + close.height / 2 - backBounds.y - backBounds.height / 2)
			).toBeLessThan(1);
			expect(await header.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(
				true
			);
			await back.click();
			await expect(panel).toBeVisible();
			expect((await originalHeader.boundingBox()).height).toBe(originalBounds.height);
		});
	}
}
