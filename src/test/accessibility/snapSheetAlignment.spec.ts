import { expect, test } from '@playwright/test';

test('mobile Search fits and centers its controls inside the collapsed sheet', async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/src/test/accessibility/index.html?routes&mobile&mobileSearchRoute');
	const sheet = page.getByRole('dialog', { name: 'Search results' });
	const handle = page.getByRole('separator', { name: 'Resize panel' });
	const searchRow = page.locator('.mobile-search__search-row');
	const results = page.locator('.mobile-search__results');
	await expect(handle).toHaveAttribute('aria-valuetext', 'collapsed');
	await expect(results).toHaveCSS('visibility', 'hidden');
	const sheetBounds = (await sheet.boundingBox())!;
	const handleBounds = (await handle.boundingBox())!;
	const rowBounds = (await searchRow.boundingBox())!;
	const input = page.getByRole('textbox', { name: 'Search dictionary' });
	const inputBounds = (await input.boundingBox())!;
	await page.screenshot({ path: testInfo.outputPath('collapsed-search.png') });
	expect(rowBounds.y).toBeGreaterThanOrEqual(handleBounds.y + handleBounds.height - 1);
	expect(rowBounds.y + rowBounds.height).toBeLessThanOrEqual(
		sheetBounds.y + sheetBounds.height - 4
	);
	const centerOffset = Math.abs(
		inputBounds.y + inputBounds.height / 2 - (sheetBounds.y + sheetBounds.height / 2)
	);
	expect(centerOffset).toBeLessThan(2);

	await handle.press('ArrowUp');
	await expect(handle).toHaveAttribute('aria-valuetext', 'partial');
	await expect(results).toHaveCSS('visibility', 'visible');
	await expect(input).toHaveCSS('margin-top', '12.5px');
	await expect(input).toHaveCSS('margin-bottom', '12.5px');
});

test('full mobile sheet clears the expanded header and follows its collapse', async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/src/test/accessibility/index.html?routes&mobile&mobileSearchShell');
	const sheet = page.getByRole('dialog', { name: 'Search results' });
	const handle = page.getByRole('separator', { name: 'Resize panel' });
	const header = page.locator('.sheet-fixture__header');
	await handle.press('End');
	await expect(handle).toHaveAttribute('aria-valuetext', 'full');
	await expect(sheet).toHaveCSS('height', '661px');
	const expandedHeader = (await header.boundingBox())!;
	const expandedSheet = (await sheet.boundingBox())!;
	expect(expandedSheet.y).toBeGreaterThanOrEqual(expandedHeader.y + expandedHeader.height + 7);
	await page.screenshot({ path: testInfo.outputPath('full-sheet-expanded-header.png') });

	await page.getByRole('button', { name: 'Toggle header' }).click();
	await expect(sheet).toHaveCSS('height', '717px');
	const compactHeader = (await header.boundingBox())!;
	const compactSheet = (await sheet.boundingBox())!;
	expect(compactSheet.y).toBeGreaterThanOrEqual(compactHeader.y + compactHeader.height + 7);
	expect(compactSheet.height).toBeGreaterThan(expandedSheet.height);

	const growingHeaderGaps = await page.evaluate(async () => {
		const header = document.querySelector<HTMLElement>('.sheet-fixture__header')!;
		const sheet = document.querySelector<HTMLElement>('.sy-snap-sheet')!;
		const toggle = header.querySelector<HTMLButtonElement>('button')!;
		toggle.click();
		const gaps: number[] = [];
		for (let sampleIndex = 0; sampleIndex < 25; sampleIndex += 1) {
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			gaps.push(sheet.getBoundingClientRect().top - header.getBoundingClientRect().bottom);
		}
		return gaps;
	});
	expect(Math.min(...growingHeaderGaps)).toBeGreaterThanOrEqual(7);
	await expect(sheet).toHaveCSS('height', '661px');
});

test('collapsed Bookmarks sheet keeps its header controls visible', async ({ page }, testInfo) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/src/test/accessibility/index.html?routes&mobile');
	const sheet = page.getByRole('dialog', { name: 'Bookmark lists' });
	const handle = page.getByRole('separator', { name: 'Resize panel' });
	const results = page.locator('.mobile-bookmarks__results');
	await handle.press('Home');
	await expect(handle).toHaveAttribute('aria-valuetext', 'collapsed');
	await expect(sheet).toHaveCSS('height', '72px');
	await expect(results).toHaveCSS('visibility', 'hidden');
	const sheetBounds = (await sheet.boundingBox())!;
	const rowBounds = (await page.locator('.mobile-bookmarks__header-row').boundingBox())!;
	expect(rowBounds.y + rowBounds.height).toBeLessThanOrEqual(
		sheetBounds.y + sheetBounds.height - 2
	);
	await handle.evaluate((element) => (element as HTMLElement).blur());
	await page.screenshot({ path: testInfo.outputPath('collapsed-bookmarks.png') });
	await handle.press('ArrowUp');
	await expect(results).toHaveCSS('visibility', 'visible');
});
