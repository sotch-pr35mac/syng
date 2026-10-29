import { test, expect } from '@playwright/test';

const url = '/src/test/accessibility/index.html?pinyin=reader';

for (const pinyin of [false, true]) {
	test(`Reader restores the desktop word underline with pinyin ${pinyin ? 'on' : 'off'}`, async ({
		page,
	}) => {
		await page.goto(url);
		await expect(page.getByText('author reading')).toBeVisible();
		if (pinyin) {
			await page.getByText('Test preferences').click();
			await page
				.getByRole('checkbox', { name: 'Show pinyin in Reader', exact: true })
				.press('Space');
			await page.getByText('Test preferences').click();
			await expect(
				page.locator('.reader-pronunciation:not(.reader-pronunciation--imported)').first()
			).toBeVisible();
		}

		const word = page.locator('p.reader__block').nth(1).locator('.reader-word').first();
		await word.scrollIntoViewIfNeeded();
		await page.mouse.move(0, 0);
		const beforeHover = await word.boundingBox();
		await expect(word).toHaveCSS('border-bottom-color', 'rgba(0, 0, 0, 0)');
		await word.hover();
		await expect(word).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
		await expect(word).toHaveCSS('border-bottom-width', '1px');
		await expect(word).toHaveCSS('border-bottom-style', 'solid');
		expect(
			await word.evaluate((element) => {
				const style = getComputedStyle(element);
				return (
					style.borderBottomColor === style.color && style.color !== 'rgba(0, 0, 0, 0)'
				);
			})
		).toBe(true);
		expect(await word.boundingBox()).toEqual(beforeHover);

		// The restored mouse treatment must retain the shared keyboard focus indicator.
		await page.mouse.move(0, 0);
		await page.keyboard.press('Tab');
		await word.focus();
		await expect(word).toBeFocused();
		expect(
			await word.evaluate((element) => {
				const style = getComputedStyle(element);
				return (
					element.matches(':focus-visible') &&
					style.outlineStyle !== 'none' &&
					parseFloat(style.outlineWidth) > 0
				);
			})
		).toBe(true);
		await word.press('Enter');
		await expect(page.getByText('to learn', { exact: true })).toBeVisible();
		await expect(word).toHaveClass(/reader-word--active/);
		await expect(word).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
		expect(
			await word.evaluate((element) => {
				const style = getComputedStyle(element);
				return style.borderBottomColor === style.color;
			})
		).toBe(true);
	});

	test(`Reader preserves mobile selected-word highlighting with pinyin ${pinyin ? 'on' : 'off'}`, async ({
		page,
	}) => {
		await page.setViewportSize({ width: 393, height: 852 });
		await page.goto(`${url}&mobile`);
		await expect(page.getByText('author reading')).toBeVisible();
		if (pinyin) {
			await page.getByText('Test preferences').click();
			await page
				.getByRole('checkbox', { name: 'Show pinyin in Reader', exact: true })
				.press('Space');
			await page.getByText('Test preferences').click();
		}
		const word = page.locator('.mobile-reader-document__page--base .reader-word').first();
		await word.click();
		await expect(page.getByText('to learn', { exact: true })).toBeVisible();
		await expect(word).toHaveClass(/reader-word--active/);
		await expect(word).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
		await expect(word).toHaveCSS('border-bottom-width', '0px');
		await expect(word).toHaveCSS('border-bottom-color', 'rgba(0, 0, 0, 0)');
		await expect(word).toHaveCSS('border-radius', '3px');
	});
}
