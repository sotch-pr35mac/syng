import { expect, test } from '@playwright/test';

const url = '/src/test/accessibility/index.html?pinyin=reader&regressions';

for (const mobile of [false, true]) {
	test(`Reader preserves source flow and authored ruby (${mobile ? 'mobile' : 'desktop'})`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize({ width: 1400, height: 1200 });
		await page.goto(`${url}${mobile ? '&mobile' : ''}`);
		const prose = page.locator('[data-reader-source-block-id="prose"]');
		const ruby = page.locator('[data-reader-source-block-id="ruby"]');
		await expect(ruby.locator('ruby')).toBeVisible();
		await expect(ruby.locator('.reader-word')).toHaveCount(4);
		const baseline = await prose.evaluate((block, mobile) => {
			const source = (
				Reflect.get(window, '__pinyinSourceBlocks') as () => Array<{
					id: string;
					text: string;
				}>
			)().find((item) => item.id === 'prose')!.text;
			const clone = block.cloneNode(false) as HTMLElement;
			clone.removeAttribute('data-reader-source-block-id');
			// Reproduce v2.4.0's token markup/styles independently of ReaderText.
			// Desktop's existing transparent underline border contributes to line boxes.
			let cursor = 0;
			for (const match of source.matchAll(/[\u3400-\u9fff]{1,2}/g)) {
				clone.append(document.createTextNode(source.slice(cursor, match.index)));
				const button = document.createElement('button');
				button.textContent = match[0];
				Object.assign(button.style, {
					display: 'inline',
					border: '0',
					padding: '0',
					margin: '0',
					background: 'transparent',
					color: 'inherit',
					font: 'inherit',
					...(mobile ? {} : { borderBottom: '1px solid transparent' }),
				});
				clone.append(button);
				cursor = match.index + match[0].length;
			}
			clone.append(document.createTextNode(source.slice(cursor)));
			Object.assign(clone.style, {
				position: 'absolute',
				visibility: 'hidden',
				width: `${block.getBoundingClientRect().width}px`,
			});
			block.parentElement!.append(clone);
			const result = {
				source,
				rendered: block.textContent,
				height: block.getBoundingClientRect().height,
				previousHeight: clone.getBoundingClientRect().height,
			};
			clone.remove();
			return result;
		}, mobile);
		expect(baseline.rendered).toBe(baseline.source);
		expect(baseline.height).toBeCloseTo(baseline.previousHeight, 0);
		const expectedIndent = await ruby.evaluate(
			(block) => parseFloat(getComputedStyle(block).fontSize) * 2
		);
		expect(
			await ruby.evaluate(
				(block) =>
					block.querySelector('ruby')!.getBoundingClientRect().left -
					block.getBoundingClientRect().left
			)
		).toBeCloseTo(expectedIndent, 0);
		const target = ruby.getByRole('button', { name: '中文', exact: true });
		if (!mobile) {
			await target.hover();
			await expect(target).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
			await expect(target).toHaveCSS('border-bottom-width', '1px');
			expect(
				await target.evaluate(
					(word) =>
						getComputedStyle(word).borderBottomColor === getComputedStyle(word).color
				)
			).toBe(true);
		}
		await page.screenshot({ path: testInfo.outputPath('reader-default-ruby-hover.png') });
		await page.evaluate(() => Reflect.deleteProperty(window, '__pinyinLookup'));
		await target.click();
		await expect
			.poll(() => page.evaluate(() => Reflect.get(window, '__pinyinLookup')))
			.toBe('中文');
		await page.keyboard.press('Escape');
		await page.getByText('Test preferences').click();
		await page
			.getByRole('checkbox', { name: 'Show pinyin in Reader', exact: true })
			.press('Space');
		await page.getByText('Test preferences').click();
		await expect(ruby.locator('.reader-text-line').first()).toBeVisible();
		await expect(ruby.locator('.reader-pronunciation--imported')).toHaveCount(1);
		expect(
			await ruby.evaluate(
				(block) =>
					block.querySelector('.reader-text-unit')!.getBoundingClientRect().left -
					block.getBoundingClientRect().left
			)
		).toBeCloseTo(expectedIndent, 0);
		if (!mobile) {
			await target.hover();
			await expect(target).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
			await expect(target).toHaveCSS('border-bottom-width', '1px');
			expect(
				await target.evaluate(
					(word) =>
						getComputedStyle(word).borderBottomColor === getComputedStyle(word).color
				)
			).toBe(true);
		}
		await page.screenshot({ path: testInfo.outputPath('reader-pinyin-ruby-hover.png') });
		await page.evaluate(() => Reflect.deleteProperty(window, '__pinyinLookup'));
		await target.click();
		await expect
			.poll(() => page.evaluate(() => Reflect.get(window, '__pinyinLookup')))
			.toBe('中文');
	});
}

test('pinyin table snapshots preserve empty column and row geometry', async ({ page }) => {
	await page.setViewportSize({ width: 1400, height: 1200 });
	await page.goto(url);
	await page.getByText('Test preferences').click();
	await page.getByRole('checkbox', { name: 'Show pinyin in Reader', exact: true }).press('Space');
	await page.getByText('Test preferences').click();
	const table = page.locator('.reader__data-table');
	await expect(table.locator('.reader-text-line').first()).toBeVisible();
	await expect
		.poll(() =>
			page.evaluate(() => {
				const current = (
					Reflect.get(window, '__pinyinCurrentPage') as () => {
						blocks: Array<{ tableSnapshot?: { cells: unknown[] } }>;
					}
				)();
				return current.blocks.find((block) => block.tableSnapshot)?.tableSnapshot?.cells
					.length;
			})
		)
		.toBe(6);
	const geometry = await table.evaluate((element) => {
		const current = (
			Reflect.get(window, '__pinyinCurrentPage') as () => {
				blocks: Array<{ tableSnapshot?: { cells: Array<{ x: number; y: number }> } }>;
			}
		)();
		const snapshot = current.blocks.find((block) => block.tableSnapshot)!.tableSnapshot!;
		const cells = Array.from(element.querySelectorAll('td')).map((cell) =>
			cell.getBoundingClientRect()
		);
		return {
			liveColumn: cells[1].left - cells[0].left,
			snapshotColumn: snapshot.cells[1].x - snapshot.cells[0].x,
			liveEmptyRow: cells[4].top - cells[2].top,
			snapshotEmptyRow: snapshot.cells[4].y - snapshot.cells[2].y,
		};
	});
	expect(Math.abs(geometry.liveColumn - geometry.snapshotColumn)).toBeLessThan(2);
	expect(Math.abs(geometry.liveEmptyRow - geometry.snapshotEmptyRow)).toBeLessThan(2);
});
