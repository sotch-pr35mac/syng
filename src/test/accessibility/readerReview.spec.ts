import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

for (const [width, size] of [
	[30, 20],
	[35, 28],
	[60, 24],
]) {
	test(`narrow annotations clear every character (${width}px, ${size}px font)`, async ({
		page,
	}) => {
		await page.goto(
			`/src/test/accessibility/index.html?readerReview&width=${width}&size=${size}`
		);
		const unit = page.locator('.reader-text-unit');
		await expect(unit).toBeVisible();
		const bounds = await unit.evaluate((element) => {
			const base = element.querySelector('.reader-word > span')!;
			const range = document.createRange();
			range.selectNodeContents(base);
			const baseRects = Array.from(range.getClientRects());
			const annotation = element.querySelector('.reader-pronunciation')!;
			range.selectNodeContents(annotation);
			return {
				baseBottom: Math.max(...baseRects.map((rect) => rect.bottom)),
				annotationTop: annotation.getBoundingClientRect().top,
				annotationBottom: Math.max(
					...Array.from(range.getClientRects()).map((rect) => rect.bottom)
				),
				lineBottom: element.parentElement!.getBoundingClientRect().bottom,
				rows: new Set(baseRects.map((rect) => rect.top)).size,
			};
		});
		expect(bounds.rows).toBeGreaterThan(1);
		expect(bounds.baseBottom).toBeLessThanOrEqual(bounds.annotationTop + 1);
		expect(bounds.annotationBottom).toBeLessThanOrEqual(bounds.lineBottom + 1);
	});
}

for (const pinyinOn of [false, true]) {
	test(`short character window retains first and last rows (pinyin ${pinyinOn})`, async ({
		page,
	}) => {
		await page.setViewportSize({ width: 440, height: 340 });
		await page.route('**/resources/hanzi-writer-data/data/*.json', async (route) => {
			const name = decodeURIComponent(
				new URL(route.request().url()).pathname.split('/').at(-1)!
			);
			await route.fulfill({
				path: resolve('src/views/resources/hanzi-writer-data/data', name),
				contentType: 'application/json',
			});
		});
		await page.goto(
			`/src/test/accessibility/index.html?readerReview&characterWindow${pinyinOn ? '&pinyinOn' : ''}`
		);
		const scroller = page.locator('.character-container');
		const cells = page.locator('.character-cell');
		await expect(cells).toHaveCount(8);
		const geometry = await scroller.evaluate((element) => ({
			top: element.getBoundingClientRect().top,
			first: element.querySelector('.character-cell')!.getBoundingClientRect().top,
			overflow: element.scrollHeight > element.clientHeight,
		}));
		expect(geometry.overflow).toBe(true);
		expect(geometry.first).toBeGreaterThanOrEqual(geometry.top - 1);
		await scroller.evaluate((element) => {
			element.scrollTop = element.scrollHeight;
		});
		const bottom = await scroller.evaluate((element) => ({
			bottom: element.getBoundingClientRect().bottom,
			last: Array.from(element.querySelectorAll('.character-cell'))
				.at(-1)!
				.getBoundingClientRect().bottom,
		}));
		expect(bottom.last).toBeLessThanOrEqual(bottom.bottom + 1);
		expect(
			await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)
		).toBeLessThanOrEqual(0);
		await page.setViewportSize({ width: 1800, height: 900 });
		await expect
			.poll(() =>
				scroller.evaluate((element) => {
					const outer = element.getBoundingClientRect();
					const word = element.querySelector('.animation-word')!.getBoundingClientRect();
					return Math.abs((outer.top + outer.bottom) / 2 - (word.top + word.bottom) / 2);
				})
			)
			.toBeLessThan(1);
	});
}

test('wrapped imported annotations keep every dictionary word inside its line', async ({
	page,
}) => {
	await page.goto('/src/test/accessibility/index.html?readerReview&grouped&width=60&size=20');
	const line = page.locator('.reader-text-line');
	await expect(line).toBeVisible();
	const bounds = await line.evaluate((element) => {
		const words = Array.from(element.querySelectorAll('.reader-word')).map((word) =>
			word.getBoundingClientRect()
		);
		return {
			last: Math.max(...words.map((word) => word.bottom)),
			bottom: element.getBoundingClientRect().bottom,
		};
	});
	expect(bounds.last).toBeLessThanOrEqual(bounds.bottom + 1);
});
