import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const headerSelector = '.dictionary-content--header';

test('vertical action tooltips do not intercept clicks on the next action', async ({ page }) => {
	await page.setViewportSize({ width: 230, height: 900 });
	await page.route('**/resources/**', async (route) => {
		const relative = new URL(route.request().url()).pathname.split('/resources/')[1];
		await route.fulfill({
			body: await readFile(resolve('src/views/resources', decodeURIComponent(relative))),
			contentType: 'application/json',
		});
	});
	await page.goto('/src/test/accessibility/index.html?tooltips&dictionaryHeader');
	await expectOrientation(page, true);
	await page.evaluate(() => {
		Reflect.set(window, '__dictionaryActionClicks', []);
		Reflect.set(window, '__dictionaryNativeCalls', []);
		Reflect.set(window, '__TAURI_INTERNALS__', {
			invoke: async (command: string) => {
				Reflect.get(window, '__dictionaryNativeCalls').push(command);
			},
		});
		document.querySelectorAll('.dictionary-content--header button').forEach((button) => {
			button.addEventListener('click', () => {
				Reflect.get(window, '__dictionaryActionClicks').push(
					button.getAttribute('aria-label')
				);
			});
		});
	});
	const save = page.getByRole('button', { name: 'Choose bookmark lists' });
	const write = page.getByRole('button', { name: 'Write Characters', exact: true });
	const breakdown = page.getByRole('button', { name: 'Character Breakdown', exact: true });
	for (const [owner, target] of [
		[save, write],
		[write, breakdown],
	]) {
		await owner.hover();
		await expect(owner.locator('.sy-tooltip--body')).toHaveCSS('opacity', '1');
		const bounds = (await target.boundingBox())!;
		const expectedLabel = await target.getAttribute('aria-label');
		// Use the real hit target, without locator.click retrying until a tooltip hides.
		await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
		expect(
			await page.evaluate(() => Reflect.get(window, '__dictionaryActionClicks').at(-1))
		).toBe(expectedLabel);
	}
	expect(await page.evaluate(() => Reflect.get(window, '__dictionaryActionClicks'))).toEqual([
		'Write Characters',
		'Character Breakdown',
	]);
	expect(await page.evaluate(() => Reflect.get(window, '__dictionaryNativeCalls'))).toContain(
		'open_character_window'
	);
	await expect(page.getByRole('region', { name: 'Character Breakdown' })).toBeVisible();
});

for (const { fontSize, mobile, singleList } of [
	{ fontSize: 16, mobile: false, singleList: false },
	{ fontSize: 24, mobile: false, singleList: true },
	{ fontSize: 16, mobile: true, singleList: false },
	{ fontSize: 24, mobile: true, singleList: true },
]) {
	test(`vertical action tooltips fit beside controls: ${fontSize}px, mobile=${mobile}`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize({ width: 900, height: 900 });
		await page.goto(
			`/src/test/accessibility/index.html?tooltips&dictionaryHeader&fontSize=${fontSize}${mobile ? '&mobile' : ''}${singleList ? '&singleList' : ''}`
		);
		await page.locator('main').evaluate((element) => {
			element.style.flex = '0 0 230px';
			element.style.marginLeft = '120px';
		});
		await expectOrientation(page, true);
		const buttons = page.locator(`${headerSelector} .sy-button-bar--container button`);
		const pane = (await page.locator('.dictionary-content-container').boundingBox())!;
		for (const button of await buttons.all()) {
			await button.hover();
			const tooltip = button.locator('.sy-tooltip--body');
			await expect(tooltip).toHaveCSS('opacity', '1');
			const bounds = (await tooltip.boundingBox())!;
			expect(bounds.x).toBeGreaterThanOrEqual(pane.x);
			expect(bounds.y).toBeGreaterThanOrEqual(pane.y);
			for (const target of await buttons.all()) {
				const targetBounds = (await target.boundingBox())!;
				expect(bounds.x + bounds.width).toBeLessThanOrEqual(targetBounds.x);
				// Include the left edge: a tooltip's invisible hover area can also intercept clicks.
				for (const inset of [1, targetBounds.width / 2]) {
					const hitLabel = await page.evaluate(
						({ x, y }) =>
							document
								.elementFromPoint(x, y)
								?.closest('button')
								?.getAttribute('aria-label'),
						{ x: targetBounds.x + inset, y: targetBounds.y + targetBounds.height / 2 }
					);
					expect(hitLabel).toBe(await target.getAttribute('aria-label'));
				}
			}
			await page.mouse.move(800, 800);
			await button.focus();
			await page.keyboard.press('Shift');
			await expect(tooltip).toHaveCSS('opacity', '1');
			await page.screenshot({
				path: testInfo.outputPath(`tooltip-${await button.getAttribute('aria-label')}.png`),
			});
			await page.keyboard.press('Escape');
			await expect(tooltip).toHaveCSS('opacity', '0');
		}
	});
}

async function expectOrientation(page: Page, vertical: boolean) {
	const bar = page.locator(`${headerSelector} .sy-button-bar--container`);
	await expect(bar).toHaveCSS('flex-direction', vertical ? 'column' : 'row');
	await expect
		.poll(async () =>
			page.locator(headerSelector).evaluate((header) => {
				const buttons = Array.from(header.querySelectorAll('button')).map((button) =>
					button.getBoundingClientRect()
				);
				const text = header.querySelector('.dictionary-content__topline')!;
				const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
				const range = document.createRange();
				let node;
				while ((node = walker.nextNode())) {
					if (!node.textContent?.trim()) continue;
					range.selectNodeContents(node);
					for (const bounds of range.getClientRects()) {
						if (
							buttons.some(
								(button) =>
									bounds.left < button.right &&
									bounds.right > button.left &&
									bounds.top < button.bottom &&
									bounds.bottom > button.top
							)
						)
							return false;
					}
				}
				return header.scrollWidth <= header.clientWidth;
			})
		)
		.toBe(true);
}

for (const platform of ['', '&mobile', '&ipad']) {
	for (const singleList of ['', '&singleList']) {
		test(`header fits content and preserves focus ${platform} ${singleList}`, async ({
			page,
		}, testInfo) => {
			const errors: string[] = [];
			page.on('pageerror', (error) => errors.push(error.message));
			await page.setViewportSize({ width: 760, height: 900 });
			await page.goto(
				`/src/test/accessibility/index.html?tooltips&dictionaryHeader${platform}${singleList}`
			);
			await expectOrientation(page, false);
			const tags = page.locator(`${headerSelector} .dictionary-content__tags`);
			const bar = page.locator(`${headerSelector} .sy-button-bar--container`);
			const tagBounds = (await tags.boundingBox())!;
			const barBounds = (await bar.boundingBox())!;
			expect(tagBounds.width).toBeLessThanOrEqual(barBounds.width + 1);
			const firstTag = (await tags.locator('.sy-tag').first().boundingBox())!;
			const lastTag = (await tags.locator('.sy-tag').last().boundingBox())!;
			expect(lastTag.y).toBeGreaterThan(firstTag.y);
			await page.screenshot({ path: testInfo.outputPath('horizontal.png') });
			const write = page.getByRole('button', { name: 'Write Characters', exact: true });
			await write.focus();
			await page.setViewportSize({ width: 230, height: 900 });
			await expectOrientation(page, true);
			await expect(write).toBeFocused();
			const pinyinBounds = (await page
				.locator('.chinese-characters--pinyin-container')
				.boundingBox())!;
			expect((await tags.boundingBox())!.y).toBeGreaterThanOrEqual(
				pinyinBounds.y + pinyinBounds.height
			);
			await page.screenshot({ path: testInfo.outputPath('vertical.png') });
			if (!singleList) {
				const save = page.getByRole('button', { name: 'Choose bookmark lists' });
				await save.click();
				const menu = page.getByRole('menu');
				await expect(menu).toBeVisible();
				const menuBounds = (await menu.boundingBox())!;
				expect(menuBounds.x).toBeGreaterThanOrEqual(0);
				expect(menuBounds.x + menuBounds.width).toBeLessThanOrEqual(230);
				await page.keyboard.press('Escape');
				await expect(menu).toBeHidden();
				await expect(save).toBeFocused();
				await write.focus();
			}
			await page.setViewportSize({ width: 760, height: 900 });
			await expectOrientation(page, false);
			await expect(write).toBeFocused();
			expect(errors).toEqual([]);
		});
	}
}

test('long pinyin only changes orientation when it intersects metadata', async ({ page }) => {
	await page.setViewportSize({ width: 650, height: 900 });
	const pinyin = encodeURIComponent('xī guā '.repeat(10));
	await page.goto(
		`/src/test/accessibility/index.html?tooltips&dictionaryHeader&noTags&pinyinText=${pinyin}`
	);
	await expectOrientation(page, false);
	await page.goto(
		`/src/test/accessibility/index.html?tooltips&dictionaryHeader&pinyinText=${pinyin}`
	);
	await expectOrientation(page, true);
});

test('long characters and enlarged text fit beside vertical actions', async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 320, height: 900 });
	await page.goto(
		`/src/test/accessibility/index.html?tooltips&dictionaryHeader&mobile&fontSize=24&characters=${encodeURIComponent('中华人民共和国')}`
	);
	await expectOrientation(page, true);
	await page.screenshot({ path: testInfo.outputPath('enlarged-text.png') });
});

for (const fontSize of [16, 24]) {
	test(`HSK tooltip stays inside a narrow dictionary pane at ${fontSize}px`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize({ width: 900, height: 1000 });
		await page.goto(
			`/src/test/accessibility/index.html?tooltips&dictionaryHeader&fontSize=${fontSize}&characters=${encodeURIComponent('中华人民共和国')}`
		);
		await page.locator('main').evaluate((element) => {
			element.style.flex = '0 0 230px';
			element.style.marginLeft = '120px';
		});
		await expectOrientation(page, true);
		const tag = page.locator(`${headerSelector} .sy-tag[title]`);
		const tooltip = tag.locator('.sy-tooltip--body');
		await tag.hover();
		await expect(tooltip).toHaveCSS('opacity', '1');
		await expect(tooltip).toHaveText('HSK Exam Syllabus 2025');
		const pane = (await page.locator('.dictionary-content-container').boundingBox())!;
		const bounds = (await tooltip.boundingBox())!;
		expect(bounds.x).toBeGreaterThanOrEqual(pane.x);
		expect(bounds.x + bounds.width).toBeLessThanOrEqual(pane.x + pane.width);
		// The hover hit-area pseudo-element deliberately extends beyond the tooltip.
		// Check the actual label lines rather than scrollWidth, which includes that area.
		const labelFits = await tooltip.evaluate((element) => {
			const tooltipBounds = element.getBoundingClientRect();
			const range = document.createRange();
			range.selectNodeContents(element.querySelector('p')!);
			return Array.from(range.getClientRects()).every(
				(line) =>
					line.left >= tooltipBounds.left &&
					line.right <= tooltipBounds.right &&
					line.top >= tooltipBounds.top &&
					line.bottom <= tooltipBounds.bottom
			);
		});
		expect(labelFits).toBe(true);
		await page.screenshot({ path: testInfo.outputPath('hsk-tooltip.png') });
	});
}
