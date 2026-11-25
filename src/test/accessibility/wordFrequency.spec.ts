import { test, expect } from '@playwright/test';
for (const mobile of [false, true]) {
	for (const scheme of ['light', 'dark'] as const) {
		test(`frequency ${mobile ? 'phone' : 'desktop'} ${scheme}`, async ({ page }, testInfo) => {
			await page.setViewportSize(
				mobile ? { width: 390, height: 844 } : { width: 1100, height: 850 }
			);
			await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
			await page.addInitScript(() => {
				Object.defineProperty(navigator, 'clipboard', {
					value: {
						writeText: async (text: string) => {
							Reflect.set(window, '__copiedFrequency', text);
						},
					},
					configurable: true,
				});
			});
			await page.goto(
				`/src/test/accessibility/index.html?wordFrequency${mobile ? '&mobile' : ''}${scheme === 'dark' ? '&appearance=contrast' : ''}`
			);
			await page.getByRole('button', { name: 'Analyze', exact: true }).click();
			await expect(page.getByRole('heading', { name: 'Text statistics' })).toBeVisible();
			await expect(page.locator('.cloud button')).toHaveCount(5);
			const boxes = await page.locator('.cloud button').evaluateAll((buttons) =>
				buttons.map((button) => {
					const rect = button.getBoundingClientRect();
					return {
						left: rect.left,
						right: rect.right,
						top: rect.top,
						bottom: rect.bottom,
					};
				})
			);
			for (let index = 0; index < boxes.length; index += 1) {
				for (let other = index + 1; other < boxes.length; other += 1) {
					expect(
						boxes[index].right <= boxes[other].left ||
							boxes[other].right <= boxes[index].left ||
							boxes[index].bottom <= boxes[other].top ||
							boxes[other].bottom <= boxes[index].top
					).toBe(true);
				}
			}
			const firstWord = page.locator('.cloud button').filter({ hasText: '学习' });
			const cloudCharacters = firstWord.locator('.colored-characters--tone-2');
			const listCharacters = page
				.locator('tbody tr')
				.filter({ hasText: '学习' })
				.locator('.colored-characters--tone-2');
			await expect(cloudCharacters).toHaveCount(2);
			await expect(listCharacters).toHaveCount(2);
			await expect(cloudCharacters.first()).toHaveCSS('cursor', 'pointer');
			await expect(listCharacters.first()).toHaveCSS('cursor', 'pointer');
			const originalTone = await cloudCharacters
				.first()
				.evaluate((element) => getComputedStyle(element).color);
			await page.evaluate(() =>
				document.documentElement.style.setProperty('--sy-tone-color--2', '#123456')
			);
			await expect(cloudCharacters.first()).toHaveCSS('color', 'rgb(18, 52, 86)');
			await expect(listCharacters.first()).toHaveCSS('color', 'rgb(18, 52, 86)');
			await page.evaluate(() =>
				Reflect.get(window, '__setFrequencyCharacterColoring')(false)
			);
			await expect(page.locator('.cloud [class*="colored-characters--tone"]')).toHaveCount(0);
			await expect(page.locator('tbody [class*="colored-characters--tone"]')).toHaveCount(0);
			await expect(firstWord.locator('span span').first()).toHaveCSS(
				'color',
				await firstWord.evaluate((element) => getComputedStyle(element).color)
			);
			await page.evaluate(() => {
				document.documentElement.style.removeProperty('--sy-tone-color--2');
				Reflect.get(window, '__setFrequencyCharacterColoring')(true);
			});
			await expect(cloudCharacters.first()).toHaveCSS('color', originalTone);
			await firstWord.click();
			await expect(
				page.getByRole('dialog', { name: 'Dictionary', exact: true })
			).toBeVisible();
			await page.mouse.move(0, 0);
			await expect(firstWord).toHaveAttribute('aria-current', 'true');
			await expect(firstWord).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
			const secondWord = page.locator('.cloud button').filter({ hasText: '你好' });
			const unselectedColor = await secondWord.evaluate(
				(element) => getComputedStyle(element).color
			);
			await expect(firstWord).not.toHaveCSS('color', unselectedColor);
			await expect(cloudCharacters.first()).toHaveCSS(
				'color',
				await firstWord.evaluate((element) => getComputedStyle(element).color)
			);
			if (mobile) {
				await page.keyboard.press('Escape');
			} else {
				await page.mouse.click(5, 5);
			}
			await expect(page.getByRole('dialog', { name: 'Dictionary', exact: true })).toHaveCount(
				0
			);
			await expect(firstWord).not.toHaveAttribute('aria-current', 'true');
			await expect(firstWord).toHaveCSS('color', unselectedColor);
			await expect(cloudCharacters.first()).toHaveCSS('color', originalTone);
			await secondWord.click();
			const popup = page.getByRole('dialog', { name: 'Dictionary', exact: true });
			await expect(popup).toBeVisible();
			await expect(secondWord).toHaveAttribute('aria-current', 'true');
			await popup
				.getByRole('button', { name: mobile ? 'Close' : 'Close dictionary', exact: true })
				.click();
			await expect(popup).toHaveCount(0);
			await expect(page.locator('.cloud [aria-current="true"]')).toHaveCount(0);
			const hskOne = page.locator('.levels li').filter({ hasText: 'HSK 1' });
			await expect(hskOne).toContainText('33.3%');
			await expect(page.locator('.levels li').filter({ hasText: 'HSK 2' })).toContainText(
				'66.7%'
			);
			const barShare = await hskOne
				.locator('.track span')
				.evaluate((element) => (element as HTMLElement).style.width);
			expect(parseFloat(barShare)).toBeCloseTo(100 / 3);
			await page.screenshot({ path: testInfo.outputPath('frequency.png'), fullPage: true });
			await page.getByRole('checkbox', { name: 'Hide common words' }).check();
			await expect(page.locator('tbody tr')).toHaveCount(4);
			await expect(hskOne).toContainText('33.3%');
			await expect(page.locator('tbody tr').first()).toContainText('33.3%');
			await expect(
				page.getByText('Total words', { exact: true }).locator('..')
			).toContainText('6');
			await page.getByRole('button', { name: 'Copy list' }).click();
			expect(await page.evaluate(() => Reflect.get(window, '__copiedFrequency'))).toContain(
				'学习\t2\t33.3%'
			);
			const events = await page.evaluate(() => Reflect.get(window, '__syngTelemetryCalls'));
			expect(events).toEqual([
				{
					name: 'tools.completed',
					payload: { tool: 'frequency', mode: 'automatic', input_length: 17 },
				},
				{
					name: 'dictionary.word_opened',
					payload: { source: 'tools', interaction: 'link' },
				},
				{
					name: 'dictionary.word_opened',
					payload: { source: 'tools', interaction: 'link' },
				},
				{ name: 'tools.copied', payload: { tool: 'frequency' } },
			]);
			await page.getByLabel('HSK version').selectOption('none');
			await expect(page.getByRole('columnheader', { name: 'HSK', exact: true })).toHaveCount(
				0
			);
			await page.getByLabel('HSK version').selectOption('hsk_2015');
			await expect(
				page.getByRole('columnheader', { name: 'HSK', exact: true })
			).toBeVisible();
			await page
				.getByRole('textbox', { name: 'Word Frequency input', exact: true })
				.fill('你好');
			await expect(page.locator('.frequency [role="status"]')).toContainText('Text changed');
			await page.getByRole('button', { name: 'All tools' }).click();
			await page.getByRole('button', { name: 'Convert', exact: true }).click();
			await page.getByRole('button', { name: 'All tools' }).click();
			await page.getByRole('button', { name: 'Word Frequency', exact: true }).click();
			await expect(
				page.getByRole('textbox', { name: 'Word Frequency input', exact: true })
			).toHaveValue('你好');
			await expect(page.locator('body')).toHaveJSProperty('scrollWidth', mobile ? 390 : 1100);
		});
	}
}
