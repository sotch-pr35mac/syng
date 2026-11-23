import { expect, test } from '@playwright/test';

for (const fontSize of [16, 32]) {
	test(`Study header matches Library geometry at ${fontSize}px text`, async ({ page }) => {
		await page.setViewportSize({ width: 1600, height: 900 });
		await page.goto(
			`/src/test/accessibility/index.html?routes&headerComparison&fontSize=${fontSize}`
		);
		const libraryHeader = page.locator('.reader-library-route__header');
		const studyHeader = page.locator('.study--title');
		await expect(libraryHeader).toBeVisible();
		await expect(studyHeader).toBeVisible();
		const geometry = await page.evaluate(() => {
			const read = (selector: string) => {
				const element = document.querySelector<HTMLElement>(selector)!;
				const title = element.querySelector<HTMLElement>('h1')!;
				const box = element.getBoundingClientRect();
				const titleBox = title.getBoundingClientRect();
				const style = getComputedStyle(element);
				const titleStyle = getComputedStyle(title);
				return {
					height: box.height,
					paddingTop: style.paddingTop,
					paddingBottom: style.paddingBottom,
					paddingLeft: style.paddingLeft,
					backgroundColor: style.backgroundColor,
					boxShadow: style.boxShadow,
					titleHeight: titleBox.height,
					titleTop: titleBox.top - box.top,
					titleLeft: titleBox.left - box.left,
					titleFontSize: titleStyle.fontSize,
					titleLineHeight: titleStyle.lineHeight,
				};
			};
			return {
				library: read('.reader-library-route__header'),
				study: read('.study--title'),
			};
		});
		expect(geometry.study).toEqual(geometry.library);
	});
}
