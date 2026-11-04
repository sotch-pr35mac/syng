import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const fixture = '/src/test/accessibility/index.html?wordFrequency&toolbox';
const labels = ['Pinyinify', 'Convert', 'Colorize', 'Prettify', 'Word Frequency'];

for (const platform of ['android', 'ios'] as const) {
	test(`${platform} Study to Extras replaces the route and keeps all tool pages inside the outlet`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'no-preference' });
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.goto(`${fixture}&mobile&routed${platform === 'ios' ? '&ios' : ''}#/study`);
		await expect(
			page.getByText('Awa’s Tea Party — Sample Words', { exact: true })
		).toBeVisible();
		await page.getByRole('link', { name: 'Extras', exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Extras', exact: true })).toBeVisible();
		await expect(page.locator('.mobile-study')).toHaveCount(0);
		const firstTile = page.getByRole('button', { name: 'Pinyinify', exact: true });
		const illustration = firstTile.locator('.toolbox__illustration');
		if (platform === 'android') {
			await expect(illustration).toHaveCSS('filter', 'none');
			await firstTile.hover();
			await page.mouse.down();
			await expect(illustration).toHaveCSS('filter', 'none');
			await page.mouse.move(0, 0);
			await page.mouse.up();
			await page.keyboard.press('Tab');
			await firstTile.focus();
			await expect(firstTile).toHaveCSS('outline-style', 'solid');
			await expect(illustration).toHaveCSS('filter', 'none');
		} else {
			await expect(illustration).not.toHaveCSS('filter', 'none');
		}
		await page.screenshot({ path: testInfo.outputPath('mobile-after-study.png') });
		const outlet = await page.locator('main').boundingBox();
		const workspace = await page.locator('.tools-workspace').boundingBox();
		expect(workspace!.x).toBe(outlet!.x);
		expect(workspace!.width).toBe(outlet!.width);
		expect(workspace!.y).toBe(outlet!.y);
		for (const label of labels) {
			await page.getByRole('button', { name: label, exact: true }).click();
			const input = await page.getByRole('textbox').boundingBox();
			const collapse = await page
				.getByRole('button', { name: `Collapse ${label} input` })
				.boundingBox();
			expect(input!.x).toBeGreaterThan(outlet!.x);
			expect(input!.x - outlet!.x).toBeCloseTo(
				outlet!.x + outlet!.width - input!.x - input!.width,
				0
			);
			expect(collapse!.x + collapse!.width).toBeLessThanOrEqual(input!.x + input!.width);
			if (label === 'Prettify') {
				await page.screenshot({ path: testInfo.outputPath('mobile-prettify.png') });
			}
			await page.getByRole('button', { name: 'All tools' }).click();
		}
		await page.getByRole('link', { name: 'Study', exact: true }).click();
		await expect(page.locator('.tools-workspace')).toHaveCount(0);
		await expect(page.locator('.mobile-study')).toBeVisible();
		await page.getByRole('link', { name: 'Extras', exact: true }).click();
		await expect(page.locator('.mobile-study')).toHaveCount(0);
		await expect(page.getByRole('heading', { name: 'Extras', exact: true })).toBeVisible();
		expect(errors).toEqual([]);
	});
}

for (const mobile of [false, true]) {
	for (const scheme of ['light', 'dark'] as const) {
		test(`toolbox ${mobile ? 'phone' : 'desktop'} ${scheme}`, async ({ page }, testInfo) => {
			await page.setViewportSize(
				mobile ? { width: 390, height: 844 } : { width: 1100, height: 850 }
			);
			await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
			await page.goto(`${fixture}${mobile ? '&mobile' : ''}`);
			const toolbox = page.getByRole('region', { name: 'Extras tools' });
			await expect(toolbox.getByRole('button')).toHaveCount(5);
			await page.evaluate(() => document.fonts.ready);
			const surface = page
				.locator('[data-tool="pinyinify"] .tool-artwork__image rect')
				.first();
			await expect(surface).toHaveCSS(
				'fill',
				scheme === 'light' ? 'rgb(247, 249, 252)' : 'rgb(52, 61, 75)'
			);
			await expect(page.locator('[data-tool="colorize"] text')).toHaveCSS(
				'fill',
				'rgb(67, 184, 102)'
			);
			await expect(page.locator('[data-tool="converter"] text')).toHaveText(['繁', '简']);
			await page.screenshot({ path: testInfo.outputPath('toolbox.png'), fullPage: true });
			const accessibility = await new AxeBuilder({ page }).analyze();
			expect(accessibility.violations).toEqual([]);

			for (const label of labels) {
				const tile = page.getByRole('button', { name: label, exact: true });
				await tile.focus();
				await page.keyboard.press('Enter');
				const heading = page.getByRole('heading', { name: label, exact: true, level: 1 });
				await expect(heading).toBeFocused();
				await expect(
					page.getByRole('heading', { name: 'Extras', exact: true })
				).toHaveCount(0);
				await expect(toolbox).toHaveCount(0);
				const header = page.locator('.tool-page-header');
				const collapse = header.getByRole('button', { name: `Collapse ${label} input` });
				await expect(collapse.locator('.lucide-chevron-up')).toHaveCount(1);
				await collapse.click();
				const expand = header.getByRole('button', { name: `Expand ${label} input` });
				await expect(expand.locator('.lucide-chevron-down')).toHaveCount(1);
				await expect(page.getByRole('textbox')).toHaveCount(0);
				await expand.click();
				await expect(page.getByRole('textbox')).toBeVisible();
				const back = header.getByRole('button', { name: 'All tools' });
				const info = header.getByRole('button', { name: `Learn about ${label}` });
				const backBounds = await back.boundingBox();
				const titleBounds = await heading.boundingBox();
				const infoBounds = await info.boundingBox();
				expect(backBounds!.x + backBounds!.width).toBeLessThanOrEqual(titleBounds!.x);
				expect(titleBounds!.x + titleBounds!.width).toBeLessThanOrEqual(infoBounds!.x);
				await info.click();
				await expect(page.getByRole('dialog', { name: label, exact: true })).toBeVisible();
				await page.getByRole('button', { name: 'Close dialog' }).click();
				if (label === 'Pinyinify' || label === 'Word Frequency') {
					await page.screenshot({
						path: testInfo.outputPath(`${label}.png`),
						fullPage: true,
					});
					expect(
						(await new AxeBuilder({ page }).include('.tool-page-header').analyze())
							.violations
					).toEqual([]);
				}
				await page.getByRole('button', { name: 'All tools' }).click();
				await expect(tile).toBeFocused();
			}
			if (mobile) {
				for (const width of [320, 360, 390]) {
					await page.setViewportSize({ width, height: 844 });
					const bounds = await toolbox.getByRole('button').evaluateAll((elements) =>
						elements.map((element) => {
							const rect = element.getBoundingClientRect();
							return {
								left: rect.left,
								right: rect.right,
								top: rect.top,
								height: rect.height,
							};
						})
					);
					expect(new Set(bounds.map((rect) => Math.round(rect.top))).size).toBe(3);
					for (const rect of bounds) {
						expect(rect.left).toBeGreaterThanOrEqual(0);
						expect(rect.right).toBeLessThanOrEqual(width);
						expect(rect.height).toBeGreaterThanOrEqual(44);
					}
				}
				await page.evaluate(() =>
					document.documentElement.style.setProperty('--sy-system-font-size', '32px')
				);
				await page
					.getByRole('button', { name: 'Word Frequency', exact: true })
					.scrollIntoViewIfNeeded();
				await expect(
					page.getByRole('button', { name: 'Word Frequency', exact: true })
				).toBeInViewport();
			}
			expect(
				await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
			).toBe(true);
			expect(
				await page
					.locator('.tools-workspace__content')
					.evaluate((element) => element.scrollWidth <= element.clientWidth)
			).toBe(true);
		});
	}
}

for (const mobile of [false, true]) {
	test(`toolbox adapts to available width in the ${mobile ? 'mobile' : 'desktop'} shell`, async ({
		page,
	}, testInfo) => {
		await page.goto(`${fixture}${mobile ? '&mobile' : ''}`);
		await page.evaluate(() => document.fonts.ready);
		const toolbox = page.getByRole('region', { name: 'Extras tools' });
		await expect(toolbox.getByRole('button')).toHaveCount(labels.length);
		const layouts = mobile
			? [
					{ width: 320, columns: 2 },
					{ width: 600, columns: 4 },
					{ width: 900, columns: 5 },
					{ width: 390, columns: 2 },
				]
			: [
					{ width: 700, columns: 3 },
					{ width: 900, columns: 4 },
					{ width: 1280, columns: 5 },
					{ width: 600, columns: 2 },
				];
		for (const { width, columns } of layouts) {
			await page.setViewportSize({ width, height: 850 });
			const bounds = await toolbox.getByRole('button').evaluateAll((elements) =>
				elements.map((element) => {
					const rect = element.getBoundingClientRect();
					return { left: rect.left, right: rect.right, top: rect.top };
				})
			);
			expect(new Set(bounds.map((rect) => Math.round(rect.left))).size).toBe(columns);
			expect(new Set(bounds.map((rect) => Math.round(rect.top))).size).toBe(
				Math.ceil(labels.length / columns)
			);
			for (const rect of bounds) {
				expect(rect.left).toBeGreaterThanOrEqual(0);
				expect(rect.right).toBeLessThanOrEqual(width);
			}
			if (columns === labels.length) {
				await page.screenshot({
					path: testInfo.outputPath('toolbox-expanded.png'),
					fullPage: true,
				});
			}
		}
	});
}

for (const scheme of ['light', 'dark'] as const) {
	test(`toolbox ${scheme} shadow supports hover, keyboard focus, and reduced motion`, async ({
		page,
		browserName,
	}, testInfo) => {
		await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'no-preference' });
		await page.goto(fixture);
		const tile = page.getByRole('button', { name: 'Convert', exact: true });
		const illustration = tile.locator('.toolbox__illustration');
		const restingShadow = await illustration.evaluate(
			(element) => getComputedStyle(element).filter
		);
		await tile.hover();
		await expect(illustration).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, -2)');
		await expect(illustration).not.toHaveCSS('filter', restingShadow);
		await illustration.evaluate((element) =>
			Promise.all(element.getAnimations().map((animation) => animation.finished))
		);
		const hoverShadow = await illustration.evaluate(
			(element) => getComputedStyle(element).filter
		);
		await expect(page.locator('[data-tool="pinyinify"] .toolbox__illustration')).toHaveCSS(
			'filter',
			restingShadow
		);
		await page.screenshot({ path: testInfo.outputPath('toolbox-shadow.png'), fullPage: true });
		await page.mouse.move(0, 0);
		await expect(illustration).toHaveCSS('filter', restingShadow);
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await tile.hover();
		await expect(illustration).toHaveCSS('transform', 'none');
		await expect(illustration).toHaveCSS('filter', hoverShadow);
		await page.mouse.move(0, 0);
		await page.keyboard.press(
			browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab'
		);
		await expect(page.getByRole('button', { name: 'Pinyinify', exact: true })).toBeFocused();
		await expect(page.getByRole('button', { name: 'Pinyinify', exact: true })).toHaveCSS(
			'outline-style',
			'solid'
		);
		await expect(page.locator('[data-tool="pinyinify"] .toolbox__illustration')).toHaveCSS(
			'filter',
			hoverShadow
		);
	});
}

for (const mobile of [false, true]) {
	test(`tool headers stay pinned while ${mobile ? 'phone' : 'desktop'} content scrolls`, async ({
		page,
	}) => {
		await page.setViewportSize({ width: mobile ? 390 : 1100, height: 320 });
		await page.goto(`${fixture}${mobile ? '&mobile' : ''}`);
		for (const label of labels) {
			await page.getByRole('button', { name: label, exact: true }).click();
			if (label === 'Word Frequency') {
				await page.getByRole('button', { name: 'Analyze', exact: true }).click();
				await expect(page.locator('.cloud button')).toHaveCount(5);
			}
			const header = page.locator('.tool-page-header');
			const initial = await header.boundingBox();
			const input = page.getByRole('textbox');
			const inputTop = (await input.boundingBox())!.y;
			const content = page.locator('.tools-workspace__content');
			await content.evaluate((element) => {
				element.scrollTop = element.scrollHeight;
			});
			expect(await content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
			await expect.poll(async () => (await header.boundingBox())!.y).toBe(initial!.y);
			expect((await input.boundingBox())!.y).toBeLessThan(inputTop);
			const back = page.getByRole('button', { name: 'All tools', exact: true });
			const backBounds = (await back.boundingBox())!;
			expect(
				await back.evaluate(
					(element, point) =>
						element.contains(document.elementFromPoint(point.x, point.y)),
					{
						x: backBounds.x + backBounds.width / 2,
						y: backBounds.y + backBounds.height / 2,
					}
				)
			).toBe(true);
			await back.click();
			await expect(page.getByRole('region', { name: 'Extras tools' })).toBeVisible();
		}
	});
}
