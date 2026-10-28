import { test, expect } from '@playwright/test';
import { resolve } from 'node:path';

const url = '/src/test/accessibility/index.html';
for (const mobile of [false, true]) {
	const suffix = mobile ? '&mobile' : '';
	test(`Reader pinyin preserves content and settings (${mobile ? 'phone' : 'desktop'})`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize(
			mobile ? { width: 393, height: 852 } : { width: 1100, height: 800 }
		);
		await page.goto(`${url}?pinyin=reader${suffix}&colors&theme=sepia`);
		await expect(page.getByText('author reading')).toBeVisible();
		await expect(
			page.locator('.reader-pronunciation:not(.reader-pronunciation--imported)')
		).toHaveCount(0);
		await page.getByText('Test preferences').click();
		await page
			.getByRole('checkbox', { name: 'Show pinyin in Reader', exact: true })
			.press('Space');
		await page.getByText('Test preferences').click();
		await expect(
			page.locator('.reader-pronunciation:not(.reader-pronunciation--imported)').first()
		).toBeVisible();
		await expect(page.getByText('author reading')).toHaveCount(1);
		await page.getByRole('button', { name: 'Reader settings', exact: true }).click();
		await expect(
			page.getByRole('checkbox', { name: 'Show pinyin', exact: true })
		).toBeChecked();
		await page.getByRole('checkbox', { name: 'Show pinyin', exact: true }).press('Space');
		await page.keyboard.press('Escape');
		await expect(page.getByText('author reading')).toBeVisible();
		await expect(
			page.locator('.reader-pronunciation:not(.reader-pronunciation--imported)')
		).toHaveCount(0);
		await page.getByText('Test preferences').click();
		await expect(
			page.getByRole('checkbox', { name: 'Show pinyin in Reader', exact: true })
		).not.toBeChecked();
		await page
			.getByRole('checkbox', { name: 'Show pinyin in Reader', exact: true })
			.press('Space');
		await page.getByText('Test preferences').click();
		await page.reload();
		await expect(
			page.locator('.reader-pronunciation:not(.reader-pronunciation--imported)').first()
		).toBeVisible();
		const overflow = await page
			.locator('.reader-text-line')
			.evaluateAll((lines) => lines.some((line) => line.scrollWidth > line.clientWidth + 2));
		expect(overflow).toBe(false);
		expect(
			await page
				.locator('.reader-pronunciation')
				.evaluateAll((items) =>
					items.every((item) => item.scrollHeight <= item.clientHeight + 2)
				)
		).toBe(true);
		await page.screenshot({ path: testInfo.outputPath('pinyin-reader.png') });
		// Page turns prepare the destination and retain annotations throughout the curl.
		if (!mobile) {
			await page.getByRole('button', { name: 'Next page', exact: true }).click();
			await expect(page.locator('.reader__page-count')).toContainText(/2\s*\//);
			await expect(
				page.locator('.reader-pronunciation:not(.reader-pronunciation--imported)').first()
			).toBeVisible();
			const before = await page.evaluate(() =>
				(Reflect.get(window, '__pinyinReadingPosition') as () => number)()
			);
			for (let index = 0; index < 2; index += 1) {
				await page.getByRole('button', { name: 'Reader settings', exact: true }).click();
				await page
					.getByRole('checkbox', { name: 'Show pinyin', exact: true })
					.press('Space');
				await page.keyboard.press('Escape');
			}
			await expect
				.poll(() =>
					page.evaluate(() =>
						(Reflect.get(window, '__pinyinReadingPosition') as () => number)()
					)
				)
				.toBe(before);
		}

		await page
			.locator('.reader-word')
			.filter({
				has: page.locator('.reader-pronunciation:not(.reader-pronunciation--imported)'),
			})
			.first()
			.click();
		await expect(page.getByText('to learn', { exact: true })).toBeVisible();
	});

	test(`Flashcard fronts and animation labels (${mobile ? 'phone' : 'desktop'})`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize(
			mobile ? { width: 320, height: 852 } : { width: 1100, height: 800 }
		);
		await page.goto(`${url}?pinyin=flashcards${suffix}&fontSize=20`);
		await expect(page.getByTestId('flashcard-front-simplified')).toBeVisible();
		await expect(page.locator('.preferred-characters__pinyin')).toHaveCount(0);
		await page.getByText('Test preferences').click();
		await page
			.getByRole('checkbox', { name: 'Show pinyin on flashcard fronts' })
			.press('Space');
		await page.getByText('Test preferences').click();
		await expect(page.locator('.preferred-characters__pinyin')).toHaveCount(2);
		await page.getByRole('button', { name: 'Next', exact: true }).click();
		await expect(page.getByTestId('flashcard-status')).toContainText('2 of 2');
		await page.screenshot({ path: testInfo.outputPath('pinyin-flashcards.png') });
		await page.route('**/resources/hanzi-writer-data/data/*.json', async (route) => {
			const name = decodeURIComponent(
				new URL(route.request().url()).pathname.split('/').at(-1)!
			);
			await route.fulfill({
				path: resolve('src/views/resources/hanzi-writer-data/data', name),
				contentType: 'application/json',
			});
		});
		await page.goto(`${url}?pinyin=characters${suffix}`);
		await expect(page.locator('[data-character-writer] svg')).toHaveCount(2);
		await expect(page.locator('.pronunciation')).toHaveCount(0);
		await page.getByText('Test preferences').click();
		await page
			.getByRole('checkbox', { name: 'Show pinyin in character animations' })
			.press('Space');
		await page.getByText('Test preferences').click();
		await expect(page.locator('.pronunciation')).toHaveText(['xué', 'xí']);
		await page.screenshot({ path: testInfo.outputPath('pinyin-characters.png') });
	});
}

test('Reader annotations fit headings and table cells at enlarged text sizes', async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 393, height: 900 });
	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto(
		`${url}?pinyin=reader&mobile&complex&theme=dark&appearance=contrast&fontSize=24`
	);
	await page.getByText('Test preferences').click();
	await page.getByRole('checkbox', { name: 'Show pinyin in Reader', exact: true }).press('Space');
	await page.getByText('Test preferences').click();
	await expect(page.locator('table .reader-pronunciation').first()).toBeVisible();
	expect(
		await page
			.locator('table')
			.evaluate((element) => element.scrollWidth <= element.clientWidth + 2)
	).toBe(true);
	expect(
		await page
			.locator('.reader-pronunciation')
			.evaluateAll((items) =>
				items.every((item) => item.scrollHeight <= item.clientHeight + 2)
			)
	).toBe(true);
	await page.screenshot({ path: testInfo.outputPath('pinyin-table-dark.png') });
});

for (const mobile of [false, true]) {
	test(`Native imported Reader text stays within the page (${mobile ? 'phone' : 'desktop'})`, async ({
		page,
	}, testInfo) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.setViewportSize(
			mobile ? { width: 393, height: 852 } : { width: 1300, height: 760 }
		);
		await page.goto(`${url}?pinyin=reader&nativeStory${mobile ? '&mobile' : ''}`);
		await page.getByText('Test preferences').click();
		await page
			.getByRole('checkbox', { name: 'Show pinyin in Reader', exact: true })
			.press('Space');
		await page.getByText('Test preferences').click();
		await expect(page.locator('.reader-text-line').first()).toBeVisible();
		const pageSelector = mobile ? '.mobile-reader-document__page--base' : '.reader__page--base';
		const pageElement = page.locator(pageSelector);
		async function expectContentFits() {
			await expect
				.poll(() =>
					pageElement.evaluate((element) => {
						const rect = element.getBoundingClientRect();
						const styles = getComputedStyle(element);
						const bottom = rect.bottom - parseFloat(styles.paddingBottom);
						const right = rect.right - parseFloat(styles.paddingRight);
						return Array.from(
							element.querySelectorAll('.reader-text-line, .reader-pronunciation')
						).every((item) => {
							const box = item.getBoundingClientRect();
							return box.bottom <= bottom + 1 && box.right <= right + 1;
						});
					})
				)
				.toBe(true);
		}
		await expectContentFits();
		await page.screenshot({ path: testInfo.outputPath('native-reader-pinyin.png') });
		if (!mobile) {
			for (let index = 0; index < 3; index += 1) {
				await page.getByRole('button', { name: 'Next page', exact: true }).click();
				await expect(page.locator('.reader__page-count')).toContainText(
					new RegExp(`${index + 2}\\s*/`)
				);
				await expect(
					page.getByRole('button', { name: 'Previous page', exact: true })
				).toBeEnabled();
				await expectContentFits();
			}
		}
		expect(errors).toEqual([]);
	});
}
