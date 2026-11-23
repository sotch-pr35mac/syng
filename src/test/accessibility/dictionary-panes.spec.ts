import { expect, test } from '@playwright/test';

test('desktop dictionary popup grows from its anchor and retracts on close', async ({
	page,
}, testInfo) => {
	await page.goto('/src/test/accessibility/index.html?breakdown&popup&initiallyClosed');
	await expect(page.getByRole('button', { name: '清', exact: true })).toBeVisible();
	await page.evaluate(() => new Promise(requestAnimationFrame));
	const opening = await page.evaluate(async () => {
		document.querySelector<HTMLButtonElement>('nav button')!.click();
		await new Promise(requestAnimationFrame);
		const popup = document.querySelector<HTMLElement>('.sy-popover')!;
		const style = getComputedStyle(popup);
		const [originX, originY] = style.transformOrigin.split(' ').map(Number.parseFloat);
		return {
			scale: new DOMMatrixReadOnly(style.transform).a,
			anchorX: Number.parseFloat(style.left) + originX,
			anchorY: Number.parseFloat(style.top) + originY,
		};
	});
	expect(opening.scale).toBeLessThan(0.5);
	expect(opening.anchorX).toBeCloseTo(320, 0);
	expect(opening.anchorY).toBeCloseTo(75, 0);
	const popup = page.getByRole('dialog', { name: 'Dictionary' });
	await expect
		.poll(() =>
			popup.evaluate(
				(element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).a
			)
		)
		.toBeGreaterThan(0.99);
	await page.screenshot({ path: testInfo.outputPath('dictionary-popup-border.png') });
	const closing = await page.evaluate(async () => {
		const popup = document.querySelector<HTMLElement>('.sy-popover')!;
		popup.querySelector<HTMLButtonElement>('[aria-label="Close dictionary"]')!.click();
		await new Promise(requestAnimationFrame);
		const style = getComputedStyle(popup);
		const [originX, originY] = style.transformOrigin.split(' ').map(Number.parseFloat);
		return {
			attached: popup.isConnected,
			running: popup.getAnimations().some((animation) => animation.playState === 'running'),
			anchorX: Number.parseFloat(style.left) + originX,
			anchorY: Number.parseFloat(style.top) + originY,
		};
	});
	expect(closing).toEqual({ attached: true, running: true, anchorX: 320, anchorY: 75 });
	await expect(popup).not.toBeAttached();
});

test('desktop dictionary popup skips anchor motion when reduced motion is requested', async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/src/test/accessibility/index.html?breakdown&popup&initiallyClosed');
	await page.getByRole('button', { name: '清', exact: true }).click();
	const popup = page.getByRole('dialog', { name: 'Dictionary' });
	await expect(popup).toBeVisible();
	await expect(popup).toHaveCSS('transform', 'none');
	await popup.getByRole('button', { name: 'Close dictionary' }).click();
	await expect(popup).not.toBeAttached();
});

for (const colorScheme of ['light', 'dark'] as const) {
	test(`dictionary popup header matches its content in ${colorScheme} appearance`, async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme });
		await page.goto('/src/test/accessibility/index.html?breakdown&popup');
		const contentColor = colorScheme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(30, 30, 30)';
		await expect(page.locator('.dictionary-popover__header')).toHaveCSS(
			'background-color',
			contentColor
		);
		await expect(page.locator('.dictionary-content-container')).toHaveCSS(
			'background-color',
			contentColor
		);
		await expect(
			page.locator('.dictionary-popover__content .sy-list--container').first()
		).toHaveCSS(
			'outline-color',
			colorScheme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0)'
		);
	});

	test(`desktop Search field blends into its header in ${colorScheme} appearance`, async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme });
		await page.goto('/src/test/accessibility/index.html?routes&searchRoute');
		const field = page.getByRole('textbox', { name: 'Search dictionary' });
		await expect(field).toBeVisible();
		await expect(field).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
		await expect(page.getByTestId('search-bar-container')).toHaveCSS(
			'background-color',
			colorScheme === 'light' ? 'rgb(250, 250, 250)' : 'rgb(36, 36, 36)'
		);
	});
	test(`desktop Search entry and selected result use canvas in ${colorScheme} appearance`, async ({
		page,
	}, testInfo) => {
		await page.emulateMedia({ colorScheme });
		await page.goto('/src/test/accessibility/index.html?routes&searchRoute&selectedSearch');
		const canvasColor = colorScheme === 'light' ? 'rgb(240, 241, 242)' : 'rgb(45, 45, 45)';
		await expect(page.locator('.dictionary-content-container')).toHaveCSS(
			'background-color',
			canvasColor
		);
		const firstResult = page.locator('.search-results .sy-list-preview-item-container').first();
		await expect(firstResult).toBeVisible();
		await firstResult.click();
		await expect(firstResult).toHaveAttribute('aria-current', 'true');
		await expect(firstResult).toHaveCSS('background-color', canvasColor);
		await firstResult.hover();
		await expect(firstResult).toHaveCSS('background-color', canvasColor);
		const contentList = page.locator('.dictionary-content .sy-list--container').first();
		await expect(contentList).toBeVisible();
		await expect(contentList).toHaveCSS('border-radius', '9px');
		await expect(contentList).toHaveCSS('outline-color', 'rgba(0, 0, 0, 0)');
		await expect(page.getByRole('textbox', { name: 'Notes' })).toHaveCSS(
			'border-top-color',
			'rgba(0, 0, 0, 0)'
		);
		expect(
			await contentList.evaluate((element) => getComputedStyle(element).boxShadow)
		).not.toContain('inset');
		const contentItems = contentList.locator('.sy-list--list-item');
		await expect(contentItems).toHaveCount(2);
		await expect(contentItems.first()).toHaveCSS('border-top-width', '0px');
		await expect(contentItems.nth(1)).toHaveCSS('border-top-width', '1px');
		await expect(contentItems.nth(1)).toHaveCSS('border-bottom-width', '0px');
		await expect(page.getByRole('heading', { name: 'Definitions' })).toHaveCSS(
			'color',
			colorScheme === 'light' ? 'rgb(119, 129, 141)' : 'rgb(165, 165, 173)'
		);
		await page.screenshot({ path: testInfo.outputPath('search-canvas.png') });
	});
	test(`desktop Bookmarks entry uses the same canvas in ${colorScheme} appearance`, async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme });
		await page.goto('/src/test/accessibility/index.html?routes&savedWord');
		const savedWord = page.getByRole('region', { name: 'Saved words' }).getByText('西瓜');
		await savedWord.click();
		const entry = page.getByRole('region', { name: 'Dictionary entry' });
		await expect(entry.getByText('watermelon')).toBeVisible();
		const canvas = entry.locator('.dictionary-content-container');
		await expect(canvas).toHaveClass(/dictionary-content--background-canvas/);
		await expect(canvas).toHaveCSS(
			'background-color',
			colorScheme === 'light' ? 'rgb(240, 241, 242)' : 'rgb(45, 45, 45)'
		);
	});
}

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
