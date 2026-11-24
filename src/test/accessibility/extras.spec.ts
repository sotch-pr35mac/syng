import { test, expect, type Page } from '@playwright/test';
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
			const header = (await page.locator('.tool-page-header').boundingBox())!;
			expect(header.x).toBe(outlet!.x);
			expect(header.width).toBe(outlet!.width);
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
			if (mobile) {
				const workspace = (await page.locator('.tools-workspace').boundingBox())!;
				expect(initial!.x).toBe(workspace.x);
				expect(initial!.width).toBe(workspace.width);
			}
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

for (const mobile of [false, true]) {
	test(`Extras radio settings support keyboard selection and retain choices on ${mobile ? 'phone' : 'desktop'}`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize({ width: mobile ? 320 : 1100, height: 850 });
		await page.emulateMedia({ reducedMotion: 'reduce' });
		// Match Settings coverage: contrast appearance supplies the accessible palette.
		await page.goto(`${fixture}${mobile ? '&mobile' : ''}&appearance=contrast`);
		const configurations = [
			{
				tool: 'Convert',
				group: 'Conversion direction',
				choice: mobile ? 'Simplified' : 'To Simplified',
			},
			{
				tool: 'Prettify',
				group: 'Prettify direction',
				choice: mobile ? 'Marks' : 'To Marks',
			},
			{ tool: 'Colorize', group: 'Colorize mode', choice: 'Characters' },
		];
		for (const configuration of configurations) {
			await page.getByRole('button', { name: configuration.tool, exact: true }).click();
			const group = page.getByRole('group', { name: configuration.group, exact: true });
			const automatic = group.getByRole('radio', {
				name: mobile ? 'Auto' : 'Automatic',
				exact: true,
			});
			await expect(automatic).toBeChecked();
			await automatic.focus();
			await page.keyboard.press('ArrowRight');
			await expect(
				group.getByRole('radio', { name: configuration.choice, exact: true })
			).toBeChecked();
			if (configuration.tool === 'Colorize') {
				const script = page.getByRole('group', { name: 'Character script', exact: true });
				await script.getByRole('radio', { name: 'Traditional', exact: true }).check();
				await group
					.getByRole('radio', { name: mobile ? 'Pinyinify' : 'Pinyin', exact: true })
					.check();
				await expect(script).toHaveCount(0);
				await group.getByRole('radio', { name: 'Characters', exact: true }).check();
				await expect(
					script.getByRole('radio', { name: 'Traditional', exact: true })
				).toBeChecked();
			}
			expect(
				(
					await new AxeBuilder({ page })
						.include('.text-conversion-tool__controls')
						.analyze()
				).violations
			).toEqual([]);
			await page.getByRole('button', { name: 'All tools' }).click();
			await page.getByRole('button', { name: configuration.tool, exact: true }).click();
			await expect(
				group.getByRole('radio', { name: configuration.choice, exact: true })
			).toBeChecked();
			expect(
				await page
					.locator('.tools-workspace__content')
					.evaluate((element) => element.scrollWidth <= element.clientWidth)
			).toBe(true);
			await page.screenshot({
				path: testInfo.outputPath(`${configuration.tool}-radios.png`),
			});
			await page.getByRole('button', { name: 'All tools' }).click();
		}
	});
}

async function swipeToolPage(
	page: Page,
	gesture: 'back' | 'vertical' | 'outside' | 'cancel' = 'back'
) {
	await page.locator('.tools-workspace__content').evaluate((element, gesture) => {
		element.setPointerCapture = () => {};
		const bounds = element.getBoundingClientRect();
		const startX = bounds.x + (gesture === 'outside' ? 80 : 10);
		const startY = bounds.y + 100;
		const endX = startX + (gesture === 'vertical' ? 0 : 250);
		const endY = startY + (gesture === 'vertical' ? 100 : 0);
		for (const [type, clientX, clientY] of [
			['pointerdown', startX, startY],
			['pointermove', endX, endY],
			[gesture === 'cancel' ? 'pointercancel' : 'pointerup', endX, endY],
		] as const) {
			element.dispatchEvent(
				new PointerEvent(type, {
					bubbles: true,
					cancelable: true,
					pointerId: 1,
					pointerType: 'touch',
					clientX,
					clientY,
				})
			);
		}
	}, gesture);
}

for (const reducedMotion of ['reduce', 'no-preference'] as const) {
	test(`mobile Extras edge swipe returns each tool to toolbox with ${reducedMotion} motion`, async ({
		page,
	}) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.emulateMedia({ reducedMotion });
		await page.goto(`${fixture}&mobile&routed&ios#/tools`);
		for (const label of labels) {
			const tile = page.getByRole('button', { name: label, exact: true });
			await tile.click();
			await page.getByRole('textbox').fill('你好');
			if (label === 'Pinyinify') {
				for (const gesture of ['vertical', 'outside', 'cancel'] as const) {
					await swipeToolPage(page, gesture);
					await expect(
						page.getByRole('heading', { name: label, exact: true })
					).toBeVisible();
					await expect(page.locator('.tools-workspace__content')).toHaveCSS(
						'transform',
						'none'
					);
				}
			}
			await swipeToolPage(page);
			await expect(tile).toBeFocused();
			await expect(page.locator('.tools-workspace__content')).toHaveCSS('transform', 'none');
			await tile.click();
			await expect(page.getByRole('textbox')).toHaveValue('你好');
			await page.getByRole('button', { name: 'All tools' }).click();
		}
		await swipeToolPage(page);
		await expect(page.getByRole('heading', { name: 'Extras', exact: true })).toBeVisible();
		await expect(page.locator('.tools-workspace__content')).toHaveCSS('transform', 'none');
	});
}

test('desktop Extras ignores touch back gestures', async ({ page }) => {
	await page.goto(fixture);
	await page.getByRole('button', { name: 'Convert', exact: true }).click();
	await swipeToolPage(page);
	await expect(page.getByRole('heading', { name: 'Convert', exact: true })).toBeVisible();
	await expect(page.locator('.tools-workspace__content')).toHaveCSS('transform', 'none');
});

test('mobile Process buttons align with radio groups at phone and tablet widths', async ({
	page,
}) => {
	await page.goto(`${fixture}&mobile`);
	for (const width of [320, 390, 900, 1200]) {
		await page.setViewportSize({ width, height: 850 });
		for (const label of ['Convert', 'Colorize', 'Prettify']) {
			await page.getByRole('button', { name: label, exact: true }).click();
			const process = (await page
				.getByRole('button', { name: 'Process', exact: true })
				.boundingBox())!;
			const radio = (await page.locator('.sy-radio-group').first().boundingBox())!;
			expect(process.x).toBe(radio.x);
			expect(process.width).toBe(radio.width);
			if (label === 'Colorize') {
				const secondGroup = (await page.locator('.sy-radio-group').nth(1).boundingBox())!;
				expect(secondGroup.y).toBeGreaterThan(radio.y + radio.height);
			}
			await page.getByRole('button', { name: 'All tools' }).click();
		}
	}
});

test('mobile Extras handles a browser-dispatched touch swipe', async ({ page, browserName }) => {
	test.skip(
		browserName !== 'chromium',
		'CDP touch injection is Chromium-only; both engines cover action integration.'
	);
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto(`${fixture}&mobile`);
	await page.getByRole('button', { name: 'Convert', exact: true }).click();
	const session = await page.context().newCDPSession(page);
	try {
		await page.setViewportSize({ width: 390, height: 320 });
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchStart',
			touchPoints: [{ x: 10, y: 260 }],
		});
		for (const clientY of [230, 180, 100]) {
			await session.send('Input.dispatchTouchEvent', {
				type: 'touchMove',
				touchPoints: [{ x: 10, y: clientY }],
			});
		}
		await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await expect
			.poll(() =>
				page.locator('.tools-workspace__content').evaluate((element) => element.scrollTop)
			)
			.toBeGreaterThan(0);
		await expect(page.getByRole('heading', { name: 'Convert', exact: true })).toBeVisible();
		await page.setViewportSize({ width: 390, height: 844 });
		await page.locator('.tools-workspace__content').evaluate((element) => {
			element.scrollTop = 0;
		});
		await session.send('Input.dispatchTouchEvent', {
			type: 'touchStart',
			touchPoints: [{ x: 10, y: 100 }],
		});
		for (const clientX of [30, 80, 180, 260]) {
			await session.send('Input.dispatchTouchEvent', {
				type: 'touchMove',
				touchPoints: [{ x: clientX, y: 100 }],
			});
		}
		await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
		await expect(page.getByRole('heading', { name: 'Extras', exact: true })).toBeVisible();
	} finally {
		await session.detach();
	}
});

test('desktop Process actions align above output and move below wrapped settings', async ({
	page,
}, testInfo) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto(fixture);
	await page.evaluate(() => document.fonts.ready);
	for (const width of [1400, 1100, 700, 540]) {
		await page.setViewportSize({ width, height: 850 });
		for (const label of ['Pinyinify', 'Convert', 'Colorize', 'Prettify']) {
			await page.getByRole('button', { name: label, exact: true }).click();
			const process = (await page
				.getByRole('button', { name: 'Process', exact: true })
				.boundingBox())!;
			const output = (await page.locator('.text-conversion-tool__output').boundingBox())!;
			expect(process.x + process.width).toBeCloseTo(output.x + output.width, 1);
			expect(process.width).toBeLessThan(output.width / 2);
			expect(process.y + process.height).toBeLessThan(output.y);
			const groups = await page.locator('.sy-radio-group').evaluateAll((elements) =>
				elements.map((element) => {
					const bounds = element.getBoundingClientRect();
					return { top: bounds.top, bottom: bounds.bottom };
				})
			);
			if (groups.length > 1 && groups[0].top !== groups[1].top) {
				expect(process.y).toBeGreaterThan(groups[groups.length - 1].bottom);
			}
			expect(
				await page
					.locator('.tools-workspace__content')
					.evaluate((element) => element.scrollWidth <= element.clientWidth)
			).toBe(true);
			if (label === 'Colorize' || label === 'Convert') {
				await page.screenshot({
					path: testInfo.outputPath(`${label}-process-${width}.png`),
				});
			}
			await page.getByRole('button', { name: 'All tools' }).click();
		}
	}
});

for (const mobile of [false, true]) {
	test(`Word Frequency action matches conversion tools on ${mobile ? 'mobile' : 'desktop'}`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize({ width: mobile ? 390 : 1100, height: 850 });
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto(`${fixture}${mobile ? '&mobile' : ''}`);
		await page.evaluate(() => document.fonts.ready);
		await page.getByRole('button', { name: 'Convert', exact: true }).click();
		const process = page.getByRole('button', { name: 'Process', exact: true });
		const reference = (await process.boundingBox())!;
		const fontSize = await process.evaluate((element) => getComputedStyle(element).fontSize);
		await page.getByRole('button', { name: 'All tools' }).click();
		await page.getByRole('button', { name: 'Word Frequency', exact: true }).click();
		const analyze = page.getByRole('button', { name: 'Analyze', exact: true });
		const bounds = (await analyze.boundingBox())!;
		expect(bounds.height).toBe(reference.height);
		await expect(analyze).toHaveCSS('font-size', fontSize);
		await expect(analyze.locator('.lucide-play')).toBeVisible();
		if (mobile) {
			expect(bounds.x).toBe(reference.x);
			expect(bounds.width).toBe(reference.width);
		} else {
			expect(bounds.x + bounds.width).toBeCloseTo(reference.x + reference.width, 1);
		}
		await page.getByRole('textbox').fill('');
		await expect(analyze).toBeDisabled();
		await page.getByRole('textbox').fill('学习');
		await expect(analyze).toBeEnabled();
		await page.screenshot({ path: testInfo.outputPath('frequency-action.png') });
		await analyze.click();
		await expect(page.locator('.cloud button')).toHaveCount(5);
	});
}
