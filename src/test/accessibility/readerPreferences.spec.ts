import { test, expect } from '@playwright/test';

for (const scenario of [
	{ name: 'desktop', width: 1100, fontSize: 16, query: '', rows: 1 },
	{ name: 'enlarged desktop', width: 1100, fontSize: 24, query: '', rows: 1 },
	{ name: 'narrow desktop', width: 480, fontSize: 16, query: '', rows: 2 },
	{ name: 'iPad', width: 820, fontSize: 16, query: '&ipad', rows: 1 },
	{ name: 'phone', width: 393, fontSize: 16, query: '&mobile', rows: 2 },
	{ name: 'small phone', width: 320, fontSize: 16, query: '&mobile', rows: 2 },
	{ name: 'enlarged small phone', width: 320, fontSize: 24, query: '&mobile', rows: 2 },
	{ name: 'double-size phone text', width: 393, fontSize: 32, query: '&mobile', rows: 2 },
]) {
	test(`Reader themes adapt without clipping (${scenario.name})`, async ({ page }, testInfo) => {
		if (scenario.query === '&ipad') {
			await page.addInitScript(() => {
				Object.defineProperty(navigator, 'userAgent', { get: () => 'iPad' });
			});
		}
		await page.setViewportSize({ width: scenario.width, height: 850 });
		await page.goto(
			`/src/test/accessibility/index.html?pinyin=reader${scenario.query}&fontSize=${scenario.fontSize}`
		);
		await page.getByRole('button', { name: 'Reader settings', exact: true }).click();
		const themes = page.getByRole('group', { name: 'Reader theme', exact: true });
		const buttons = themes.getByRole('button');
		await expect(buttons).toHaveCount(4);
		await page.evaluate(() => document.fonts.ready);
		await buttons.first().click({ trial: true });
		const geometry = await themes.evaluate((element) => {
			const buttons = Array.from(element.querySelectorAll('button'));
			const rows = new Map<number, number>();
			for (const button of buttons) {
				const top = Math.round(button.getBoundingClientRect().top);
				rows.set(top, (rows.get(top) ?? 0) + 1);
			}
			return {
				rows: Array.from(rows.values()),
				fits: buttons.every((button) => {
					const box = button.getBoundingClientRect();
					return (
						box.left >= 0 &&
						box.right <= innerWidth &&
						button.scrollWidth <= button.clientWidth + 1
					);
				}),
				heights: buttons.map((button) => button.getBoundingClientRect().height),
			};
		});
		expect(geometry.rows).toEqual(scenario.rows === 1 ? [4] : [2, 2]);
		expect(geometry.fits).toBe(true);
		if (scenario.query) expect(Math.min(...geometry.heights)).toBeGreaterThanOrEqual(44);
		const dark = page.getByRole('button', { name: 'Use Dark reader theme', exact: true });
		await dark.focus();
		await page.keyboard.press('Enter');
		await expect(dark).toHaveAttribute('aria-pressed', 'true');
		if (scenario.name === 'desktop') {
			await page.setViewportSize({ width: 480, height: 850 });
			await expect
				.poll(() =>
					buttons.evaluateAll(
						(items) =>
							new Set(
								items.map((item) => Math.round(item.getBoundingClientRect().top))
							).size
					)
				)
				.toBe(2);
			await page.setViewportSize({ width: 1100, height: 850 });
			await expect
				.poll(() =>
					buttons.evaluateAll(
						(items) =>
							new Set(
								items.map((item) => Math.round(item.getBoundingClientRect().top))
							).size
					)
				)
				.toBe(1);
		}
		await page.screenshot({ path: testInfo.outputPath('reader-preferences.png') });
		await page.keyboard.press('Escape');
		await expect(
			page.getByRole('button', { name: 'Reader settings', exact: true })
		).toBeFocused();
	});
}
