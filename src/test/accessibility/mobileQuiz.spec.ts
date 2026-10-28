import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
test.beforeEach(async ({ page }) => {
	await page.route('**/resources/**', async (route) => {
		const relative = new URL(route.request().url()).pathname.split('/resources/')[1];
		try {
			await route.fulfill({
				body: await readFile(resolve('src/views/resources', decodeURIComponent(relative))),
				contentType: 'application/json',
			});
		} catch {
			await route.fulfill({ status: 404, body: '' });
		}
	});
});

for (const breakdown of [false, true]) {
	test(`mobile quiz keeps one dock through answers (breakdown=${breakdown})`, async ({
		page,
	}) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(
			'/src/test/accessibility/index.html?mobileQuiz&mobile#/study/quiz?list=Review'
		);
		for (let i = 0; i < 4; i++) {
			await page.getByRole('button', { name: 'Answer', exact: true }).click();
			await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveCount(
				1
			);
			await expect(page.getByRole('button', { name: 'Exit', exact: true })).toHaveCount(1);
			await expect(page.locator('[data-testid="chinese-characters"]')).toContainText(
				['不妨', '杯子', '清', '要'][i]
			);
			await expect(page.locator('.mobile-quiz__bar')).toHaveCount(1);
			const quiz = await page.locator('.mobile-quiz').boundingBox();
			const dock = await page.locator('.mobile-quiz__dock').boundingBox();
			expect(Math.abs(dock.y + dock.height - (quiz.y + quiz.height))).toBeLessThan(1);
			await page.screenshot({ path: test.info().outputPath(`answer-${i}.png`) });
			if (breakdown) {
				await page
					.getByRole('button', { name: 'Character Breakdown', exact: true })
					.click();
				await expect(page).toHaveURL(/#\/breakdown$/);
				await page.getByRole('button', { name: 'Back to dictionary', exact: true }).click();
				await expect(page).toHaveURL(/#\/study\/quiz\?list=Review$/);
				await expect(page.locator('.mobile-quiz')).toHaveCount(1);
				await expect(page.locator('[data-testid="chinese-characters"]')).toContainText(
					['不妨', '杯子', '清', '要'][i]
				);
				await expect(
					page.getByRole('button', { name: 'Continue', exact: true })
				).toHaveCount(1);
				await expect(page.getByRole('button', { name: 'Exit', exact: true })).toHaveCount(
					1
				);
			}
			await page.getByRole('button', { name: 'Continue', exact: true }).click();
		}
		expect(errors).toEqual([]);
	});
}
