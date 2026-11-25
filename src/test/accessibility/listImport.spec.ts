import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function expectFits(dialog: Locator, page: Page): Promise<void> {
	await dialog.evaluate(async (element) => {
		await Promise.all(element.getAnimations().map((animation) => animation.finished));
	});
	const bounds = await dialog.boundingBox();
	const viewport = page.viewportSize()!;
	expect(bounds!.x).toBeGreaterThanOrEqual(0);
	expect(bounds!.y).toBeGreaterThanOrEqual(0);
	expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
	expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
	expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(
		true
	);
}

for (const scenario of [
	{ name: 'desktop', width: 1100, mobile: false, fontSize: 16 },
	{ name: 'dark desktop', width: 1100, mobile: false, fontSize: 16 },
	{ name: 'phone', width: 393, mobile: true, fontSize: 16 },
	{ name: 'large-text phone', width: 393, mobile: true, fontSize: 32 },
]) {
	test(`${scenario.name}: file import remains accessible through review and completion`, async ({
		page,
	}, testInfo) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.emulateMedia({
			colorScheme: scenario.name === 'dark desktop' ? 'dark' : 'light',
		});
		await page.setViewportSize({ width: scenario.width, height: 852 });
		await page.goto(
			`/src/test/accessibility/index.html?listImport&appearance=contrast&fontSize=${scenario.fontSize}${scenario.mobile ? '&mobile' : ''}`
		);
		const opener = page.getByRole('button', { name: 'Open import' });
		await opener.focus();
		await opener.press('Enter');
		const dialog = page.getByRole('dialog', { name: 'Import List', exact: true });
		await expect(dialog).toBeVisible();
		await page.evaluate(() => document.fonts.ready);
		await expectFits(dialog, page);
		// Read both panels in one frame, after the modal entrance transition finishes.
		const [browseBounds, fileBounds] = await dialog
			.locator('.source-panel')
			.evaluateAll((panels) => panels.map((panel) => panel.getBoundingClientRect().toJSON()));
		if (scenario.mobile) {
			expect(fileBounds.y).toBeGreaterThanOrEqual(browseBounds.y + browseBounds.height);
		} else {
			expect(Math.abs(browseBounds.y - fileBounds.y)).toBeLessThan(1);
			expect(fileBounds.x).toBeGreaterThan(browseBounds.x + browseBounds.width);
		}
		await dialog.getByText('Supported imports', { exact: true }).click();
		await expect(dialog.getByText(/The file format is detected automatically/)).toBeVisible();
		await expectFits(dialog, page);
		await dialog.getByText('Supported imports', { exact: true }).click();
		await dialog.getByRole('heading', { name: 'Import List', exact: true }).focus();
		if (scenario.name === 'phone') {
			await expect(
				dialog.getByRole('button', { name: 'Cancel', exact: true })
			).toBeInViewport();
		}
		await page.screenshot({ path: testInfo.outputPath('import-file.png') });
		await expect(
			dialog.getByRole('button', { name: 'Choose file', exact: true })
		).toBeVisible();
		await expect(dialog.getByText('Drop a list file here')).toHaveCount(
			scenario.mobile ? 0 : 1
		);
		const fileScan = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
		expect(fileScan.violations).toEqual([]);
		await page.keyboard.press('Escape');
		await expect(dialog).toBeHidden();
		await expect(opener).toBeFocused();
		await opener.press('Enter');
		await dialog.getByRole('button', { name: 'Choose file', exact: true }).click();
		await expect(dialog.getByRole('group', { name: 'Review word 1 of 1' })).toBeVisible();
		await expect(
			dialog.getByRole('button', { name: 'Import 1 list', exact: true })
		).toBeDisabled();
		await expectFits(dialog, page);
		await page.screenshot({ path: testInfo.outputPath('import-review.png') });
		const scan = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
		expect(scan.violations).toEqual([]);
		const candidate = dialog.getByRole('radio').first();
		await candidate.focus();
		await candidate.press('Space');
		await expect(candidate).toBeChecked();
		await expect(
			dialog.getByRole('button', { name: 'Import 2 lists', exact: true })
		).toBeEnabled();
		await dialog.getByText('Skipped words', { exact: true }).click();
		await expect(
			dialog.getByText('No exact dictionary entry.', { exact: false })
		).toBeVisible();
		await expectFits(dialog, page);
		await dialog.getByRole('button', { name: 'Import 2 lists', exact: true }).click();
		await expect(dialog.getByRole('status')).toHaveText('Added 2 new lists.');
		await dialog.getByRole('button', { name: 'Close', exact: true }).click();
		await expect(page.getByTestId('saved-lists')).toHaveText('2 lists saved');
		await expect(opener).toBeFocused();
		expect(errors).toEqual([]);
	});
}

test.describe('native drop on a high-DPI desktop', () => {
	test.use({ deviceScaleFactor: 2 });
	test('logical coordinates open the same review without saving', async ({ page }) => {
		await page.goto('/src/test/accessibility/index.html?listImport');
		await page.getByRole('button', { name: 'Open import' }).click();
		const dropArea = page.getByRole('button', { name: 'Choose file', exact: true });
		await expect(dropArea).toBeVisible();
		await expect
			.poll(async () => {
				await dropArea.evaluate(async (element) => {
					const bounds = element.getBoundingClientRect();
					await Reflect.get(window, '__LIST_IMPORT_EMIT__')('tauri://drag-enter', {
						paths: ['/tmp/words.xml'],
						position: {
							x: bounds.x + 20,
							y: bounds.y + 20,
						},
					});
				});
				return dropArea.getAttribute('class');
			})
			.toContain('drop-area--active');
		await dropArea.evaluate(async (element) => {
			const bounds = element.getBoundingClientRect();
			await Reflect.get(window, '__LIST_IMPORT_EMIT__')('tauri://drag-drop', {
				paths: ['/tmp/words.xml'],
				position: {
					x: bounds.x + 20,
					y: bounds.y + 20,
				},
			});
		});
		await expect(page.getByRole('group', { name: 'Review word 1 of 1' })).toBeVisible();
		await expect(page.getByTestId('imported-path')).toHaveText('/tmp/words.xml');
		await expect(page.getByTestId('saved-lists')).toHaveText('0 lists saved');
	});
});

for (const scenario of [
	{ name: 'desktop', width: 1100, query: '' },
	{ name: 'large-text phone', width: 393, query: '&mobile&fontSize=32' },
]) {
	test(`${scenario.name}: built-in HSK lists select exact levels and import offline`, async ({
		page,
	}, testInfo) => {
		await page.setViewportSize({ width: scenario.width, height: 852 });
		await page.goto(
			`/src/test/accessibility/index.html?listImport&appearance=contrast${scenario.query}`
		);
		await page.getByRole('button', { name: 'Open import' }).click();
		const dialog = page.getByRole('dialog', { name: 'Import List', exact: true });
		await dialog.getByRole('button', { name: 'Browse lists' }).click();
		await page.context().setOffline(true);
		await expect(dialog.getByRole('option', { name: 'Level 7–9' })).toHaveCount(1);
		await dialog
			.getByRole('combobox', { name: 'Level', exact: true })
			.selectOption('SevenToNine');
		await dialog
			.getByRole('combobox', { name: 'HSK standard', exact: true })
			.selectOption('hsk_2015');
		await expect(dialog.getByRole('combobox', { name: 'Level', exact: true })).toHaveValue(
			'One'
		);
		await expect(dialog.getByRole('option', { name: 'Level 7–9' })).toHaveCount(0);
		await dialog
			.getByRole('combobox', { name: 'HSK standard', exact: true })
			.selectOption('hsk_exam_syllabus_2025');
		await dialog.getByRole('combobox', { name: 'Level', exact: true }).selectOption('Two');
		await expectFits(dialog, page);
		const actions = await dialog.evaluate((element) => {
			const back = element.querySelector('[aria-label="Back"]')!.getBoundingClientRect();
			const title = element.querySelector('h2')!.getBoundingClientRect();
			const cancel = element
				.querySelector('.sy-modal--footer-start button')!
				.getBoundingClientRect();
			const add = element
				.querySelector('.sy-modal--footer > button')!
				.getBoundingClientRect();
			return {
				back: back.toJSON(),
				title: title.toJSON(),
				cancel: cancel.toJSON(),
				add: add.toJSON(),
			};
		});
		expect(actions.back.x).toBeLessThan(actions.title.x);
		expect(actions.cancel.x + actions.cancel.width).toBeLessThanOrEqual(actions.add.x);
		await dialog.getByRole('button', { name: 'Back', exact: true }).click();
		const browse = dialog.getByRole('button', { name: 'Browse lists', exact: true });
		await expect(browse).toBeFocused();
		await browse.press('Enter');
		await expect(dialog.getByRole('heading', { name: 'From Collection' })).toBeFocused();
		await expect(dialog.getByRole('combobox', { name: 'Level', exact: true })).toHaveValue(
			'Two'
		);
		await expect(dialog.getByRole('button', { name: 'Choose file' })).toHaveCount(0);
		await expectFits(dialog, page);
		expect(
			(await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations
		).toEqual([]);
		await dialog.getByRole('button', { name: 'Add List' }).scrollIntoViewIfNeeded();
		await page.screenshot({ path: testInfo.outputPath('hsk-selection.png') });
		await expect(page.getByTestId('saved-lists')).toHaveText('0 lists saved');
		await dialog.getByRole('button', { name: 'Add List' }).click();
		await expect(dialog.getByText('HSK Exam Syllabus 2025 — Level 2')).toBeVisible();
		await expect(dialog.getByRole('status')).toHaveText('Added 1 word to a new list.');
		await dialog.getByRole('button', { name: 'Close', exact: true }).click();
		await expect(page.getByTestId('saved-lists')).toHaveText('1 lists saved');
		await expect(page.getByTestId('saved-words')).toHaveText('1 words saved');
		await expect(page.getByTestId('opened-list')).toHaveText(
			'HSK Exam Syllabus 2025 — Level 2'
		);
	});
}

test('both import sources respond to presses and respect Reduce Motion', async ({ page }) => {
	await page.goto('/src/test/accessibility/index.html?listImport');
	await page.getByRole('button', { name: 'Open import' }).click();
	const dialog = page.getByRole('dialog', { name: 'Import List', exact: true });
	await page.evaluate(() => document.fonts.ready);
	await expectFits(dialog, page);
	for (const reducedMotion of ['no-preference', 'reduce'] as const) {
		await page.emulateMedia({ reducedMotion });
		for (const name of ['Browse lists', 'Choose file']) {
			const panel = dialog.getByRole('button', { name, exact: true });
			await panel.hover();
			await panel.evaluate(async (element) => {
				await Promise.all(element.getAnimations().map((animation) => animation.finished));
			});
			const restingShadow = await panel.evaluate(
				(element) => getComputedStyle(element).boxShadow
			);
			await page.mouse.down();
			await expect(panel).not.toHaveCSS('box-shadow', restingShadow);
			await expect(panel).toHaveCSS(
				'transform',
				reducedMotion === 'reduce' ? 'none' : 'matrix(1, 0, 0, 1, 0, 1)'
			);
			// Releasing outside verifies feedback without opening the picker or catalog.
			await page.mouse.move(0, 0);
			await page.mouse.up();
			await expect(panel).toHaveCSS('transform', 'none');
			await expect(panel).toHaveCSS('box-shadow', restingShadow);
		}
	}
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	const browse = dialog.getByRole('button', { name: 'Browse lists', exact: true });
	await browse.focus();
	await page.keyboard.down('Space');
	await expect(browse).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 1)');
	await page.keyboard.up('Space');
	await expect(dialog.getByRole('heading', { name: 'From Collection' })).toBeFocused();
});
