import { expect, test } from '@playwright/test';

const MINIMUM_TOUCH_TARGET = 44;
const PHONE_WIDTH = 393;
const DESKTOP_WIDTH = 1100;

for (const mobile of [false, true]) {
	test(`${mobile ? 'phone' : 'desktop'} App Tour switches from Study navigation to newly added lists`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize({ width: mobile ? PHONE_WIDTH : DESKTOP_WIDTH, height: 852 });
		await page.goto(
			`/src/test/accessibility/index.html?walkthrough&overviewStudy${mobile ? '&mobile' : ''}`
		);
		const card = page.getByRole('dialog');
		await expect(card.getByRole('heading')).toHaveText('Practice what you save');
		await expect(card.getByText('7 of 9')).toBeVisible();
		const navigation = page.getByRole('link', { name: 'Study', exact: true });
		await expect(navigation).toHaveAttribute('aria-describedby', 'walkthrough-description');
		await expect(page.locator('[data-walkthrough-target="study-lists"]')).toHaveCount(0);
		await expect(page.getByRole('button', { name: 'Learn how Study works' })).toHaveCSS(
			'font-size',
			'14px'
		);
		await page.screenshot({ path: testInfo.outputPath('empty-study.png') });
		await card.getByRole('button', { name: 'Add sample words' }).click();
		await expect(
			page.getByRole('button', { name: 'Flashcards for Sample Words' })
		).toBeVisible();
		await expect(page.locator('[data-walkthrough-target="study-lists"]')).toHaveAttribute(
			'aria-describedby',
			'walkthrough-description'
		);
		await expect(navigation).not.toHaveAttribute('aria-describedby');
		await card.getByRole('button', { name: 'Next', exact: true }).click();
		await expect(card.getByRole('heading')).toHaveText('Read your own material');
		await expect(card.getByRole('button', { name: 'Add sample document' })).toHaveCount(0);
		await card.getByRole('button', { name: 'Next', exact: true }).click();
		await expect(card.getByRole('heading')).toHaveText('Prepare Chinese text');
		await expect(card.getByRole('button', { name: 'Finish tour' })).toBeVisible();
	});
}

for (const scenario of [
	{ name: 'desktop', width: 1100, fontSize: 16, mobile: false },
	{ name: 'small phone', width: 320, fontSize: 16, mobile: true },
	{ name: 'large text phone', width: 393, fontSize: 32, mobile: true },
]) {
	for (const vocabulary of [false, true]) {
		test(`${scenario.name}: ${vocabulary ? 'vocabulary' : 'document'} sample stays usable and confirms saving`, async ({
			page,
		}, testInfo) => {
			await page.setViewportSize({ width: scenario.width, height: 852 });
			await page.goto(
				`/src/test/accessibility/index.html?walkthrough&fontSize=${scenario.fontSize}${scenario.mobile ? '&mobile' : ''}${vocabulary ? '&vocabulary' : ''}`
			);
			const card = page.getByRole('dialog');
			const add = card.getByRole('button', {
				name: vocabulary ? 'Add sample words' : 'Add sample document',
			});
			await expect(add).toBeVisible();
			await expect(card.getByText(vocabulary ? 'Sample Words' : "Awa's Story")).toBeVisible();
			await add.scrollIntoViewIfNeeded();
			const bounds = await add.boundingBox();
			if (scenario.mobile) {
				expect(bounds!.height).toBeGreaterThanOrEqual(MINIMUM_TOUCH_TARGET);
			}
			expect(bounds!.x).toBeGreaterThanOrEqual(0);
			expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(scenario.width);
			expect(
				await card.evaluate((element) => element.scrollWidth <= element.clientWidth)
			).toBe(true);
			await page.screenshot({ path: testInfo.outputPath('sample.png') });
			await add.focus();
			await add.press('Enter');
			await expect(card.getByRole('status')).toHaveText(
				vocabulary ? 'Added to your vocabulary lists.' : 'Added to your Reader library.'
			);
			await expect(add).toHaveCount(0);
			await expect(card.getByRole('heading')).toBeFocused();
			await page.screenshot({ path: testInfo.outputPath('added.png') });
			await card.getByRole('button', { name: 'Next', exact: true }).click();
			await expect(card.getByRole('status')).toBeEmpty();
			await card.getByRole('button', { name: 'Back', exact: true }).click();
			await card.getByRole('button', { name: 'Skip tour', exact: true }).click();
			const telemetryCalls = await page.evaluate(
				() =>
					Reflect.get(window, '__syngTelemetryCalls') as {
						name: string;
						payload: Record<string, unknown>;
					}[]
			);
			expect(telemetryCalls.map((call) => call.name)).toEqual([
				'walkthrough.started',
				'walkthrough.step_viewed',
				'walkthrough.example_requested',
				'walkthrough.example_added',
				'walkthrough.next',
				'walkthrough.step_viewed',
				'walkthrough.back',
				'walkthrough.step_viewed',
				'walkthrough.skipped',
			]);
			expect(
				telemetryCalls.find((call) => call.name === 'walkthrough.example_added')?.payload
			).toMatchObject({
				guide: vocabulary ? 'study' : 'reader-library',
				content_kind: vocabulary ? 'list' : 'document',
				fresh_copy: false,
			});
			expect(JSON.stringify(telemetryCalls)).not.toMatch(
				/sample-document|Awa's Story|Sample Words|lexical_id/
			);
		});
	}
}
