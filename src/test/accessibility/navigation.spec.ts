import { expect, test } from '@playwright/test';

for (const height of [800, 300]) {
	for (const fontSize of [16, 32]) {
		test(`desktop navigation has no horizontal overflow at height ${height}, text size ${fontSize}`, async ({
			page,
		}, testInfo) => {
			await page.setViewportSize({ width: 1100, height });
			await page.goto(`/src/test/accessibility/index.html?palette&fontSize=${fontSize}`);
			const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
			await expect(navigation).toBeVisible();

			const expectNoHorizontalScroll = async () => {
				const bounds = await navigation.evaluate((element) => {
					element.scrollLeft = 100;
					return {
						width: element.clientWidth,
						scrollWidth: element.scrollWidth,
						scrollLeft: element.scrollLeft,
					};
				});
				expect(bounds.scrollWidth).toBe(bounds.width);
				expect(bounds.scrollLeft).toBe(0);
			};

			// Check before any tooltip has been positioned by hover or focus.
			await expectNoHorizontalScroll();
			if (height === 300) {
				expect(
					await navigation.evaluate(
						(element) => element.scrollHeight > element.clientHeight
					)
				).toBe(true);
			}

			const settings = navigation.getByRole('link', { name: 'Settings', exact: true });
			await settings.focus();
			await expect(settings).toBeFocused();
			await expect(settings).toBeInViewport();
			await expect(settings).toHaveCSS('outline-style', 'solid');
			if (height === 300) {
				expect(await navigation.evaluate((element) => element.scrollTop)).toBeGreaterThan(
					0
				);
			}
			const tooltip = settings.locator('.sy-tooltip--body');
			await expect(tooltip).toHaveCSS('opacity', '1');
			// The tooltip must remain visible outside the scrolling sidebar.
			expect(
				await tooltip.evaluate((element) => {
					const bounds = element.getBoundingClientRect();
					return element.contains(
						document.elementFromPoint(bounds.right - 2, bounds.top + bounds.height / 2)
					);
				})
			).toBe(true);
			await expectNoHorizontalScroll();
			await page.keyboard.press('Escape');
			await expect(tooltip).toHaveCSS('opacity', '0');

			const search = navigation.getByRole('link', { name: 'Search', exact: true });
			await search.hover();
			await expect(search.locator('.sy-tooltip--body')).toHaveCSS('opacity', '1');
			await expectNoHorizontalScroll();
			await page.screenshot({ path: testInfo.outputPath('navigation-tooltip.png') });
		});
	}
}

for (const colorScheme of ['light', 'dark'] as const) {
	for (const appearance of ['original', 'contrast']) {
		for (const fontSize of [16, 32]) {
			test(`navigation matches dictionary button tooltips: ${colorScheme}, ${appearance}, ${fontSize}px`, async ({
				page,
			}, testInfo) => {
				await page.emulateMedia({ colorScheme });
				await page.goto(
					`/src/test/accessibility/index.html?tooltips&appearance=${appearance}&fontSize=${fontSize}`
				);
				const search = page.getByRole('link', { name: 'Search', exact: true });
				const writeCharacters = page.getByRole('button', { name: 'Write Characters' });
				await search.focus();
				await writeCharacters.hover();
				const navigationTooltip = search.locator('.sy-tooltip--body');
				const buttonTooltip = writeCharacters.locator('.sy-tooltip--body');
				await expect(navigationTooltip).toHaveCSS('opacity', '1');
				await expect(buttonTooltip).toHaveCSS('opacity', '1');
				const appearanceOf = (element: Element) => {
					const style = getComputedStyle(element);
					return {
						height: element.getBoundingClientRect().height,
						fontSize: style.fontSize,
						fontFamily: style.fontFamily,
						fontWeight: style.fontWeight,
						lineHeight: style.lineHeight,
						padding: style.padding,
						color: style.color,
						backgroundColor: style.backgroundColor,
						borderRadius: style.borderRadius,
						boxShadow: style.boxShadow,
					};
				};
				expect(await navigationTooltip.evaluate(appearanceOf)).toEqual(
					await buttonTooltip.evaluate(appearanceOf)
				);
				// Default-size tooltips retain the 33px height shipped in release 2.5.0.
				expect((await buttonTooltip.boundingBox())!.height).toBeCloseTo(
					fontSize === 16 ? 33 : 55,
					1
				);
				await page.screenshot({
					path: testInfo.outputPath('navigation-and-button-tooltips.png'),
				});
			});
		}
	}
}
