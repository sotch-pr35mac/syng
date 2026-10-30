import { expect, test } from '@playwright/test';

for (const route of ['Search', 'Bookmarks']) {
	for (const ipad of [false, true]) {
		test(`${route} keeps its list beside the entry while resizing${ipad ? ' on iPad' : ''}`, async ({
			page,
		}, testInfo) => {
			if (ipad) {
				await page.addInitScript(() => {
					Object.defineProperty(navigator, 'userAgent', { get: () => 'iPad' });
				});
			}
			await page.setViewportSize({ width: 1100, height: 800 });
			await page.goto(
				`/src/test/accessibility/index.html?routes${route === 'Search' ? '&searchRoute' : ''}${ipad ? '&ipad' : ''}`
			);
			const list = page.getByRole('region', {
				name: route === 'Search' ? 'Search results' : 'Saved words',
				exact: true,
			});
			const entry = page.getByRole('region', { name: 'Dictionary entry', exact: true });
			const control =
				route === 'Search'
					? page.getByRole('textbox', { name: 'Search dictionary' })
					: page.getByRole('button', { name: 'Choose list: Bookmarks' });
			await control.focus();
			for (const { width, fontSize } of [
				{ width: 1100, fontSize: 16 },
				{ width: 705, fontSize: 16 },
				{ width: 703, fontSize: 16 },
				{ width: 600, fontSize: 16 },
				{ width: 480, fontSize: 16 },
				{ width: 1100, fontSize: 32 },
				{ width: 600, fontSize: 32 },
				{ width: 1100, fontSize: 16 },
			]) {
				await page.setViewportSize({ width, height: 800 });
				await page.evaluate((size) => {
					document.documentElement.style.setProperty(
						'--sy-system-font-size',
						`${size}px`
					);
				}, fontSize);
				await expect
					.poll(async () => {
						const listBounds = await list.boundingBox();
						const entryBounds = await entry.boundingBox();
						return (
							!!listBounds &&
							!!entryBounds &&
							listBounds.width > 0 &&
							entryBounds.width > 0 &&
							Math.abs(listBounds.y - entryBounds.y) < 1 &&
							listBounds.x + listBounds.width <= entryBounds.x + 1 &&
							entryBounds.x + entryBounds.width <= width + 1
						);
					})
					.toBe(true);
				await expect(control).toBeFocused();
				if (width === 600) {
					await page.screenshot({ path: testInfo.outputPath(`panes-${fontSize}px.png`) });
				}
			}
		});
	}
}
