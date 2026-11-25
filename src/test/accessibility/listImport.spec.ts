import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function expectFits(dialog: Locator, page: Page): Promise<void> {
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
	{ name: 'phone', width: 393, mobile: true, fontSize: 16 },
	{ name: 'large-text phone', width: 393, mobile: true, fontSize: 32 },
]) {
	test(`${scenario.name}: file import remains accessible through review and completion`, async ({
		page,
	}, testInfo) => {
		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		await page.setViewportSize({ width: scenario.width, height: 852 });
		await page.goto(
			`/src/test/accessibility/index.html?listImport&appearance=contrast&fontSize=${scenario.fontSize}${scenario.mobile ? '&mobile' : ''}`
		);
		const opener = page.getByRole('button', { name: 'Open import' });
		await opener.focus();
		await opener.press('Enter');
		const dialog = page.getByRole('dialog', { name: 'Import lists', exact: true });
		await expect(dialog).toBeVisible();
		await expectFits(dialog, page);
		await page.screenshot({ path: testInfo.outputPath('import-file.png') });
		await expect(
			dialog.getByRole('button', { name: 'Choose file', exact: true })
		).toBeVisible();
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
		await dialog.getByText('Skipped records', { exact: true }).click();
		await expect(
			dialog.getByText('No exact dictionary entry.', { exact: false })
		).toBeVisible();
		await expectFits(dialog, page);
		await dialog.getByRole('button', { name: 'Import 2 lists', exact: true }).click();
		await expect(dialog.getByRole('status')).toHaveText(
			'Imported 2 word records into 2 lists.'
		);
		await dialog.getByRole('button', { name: 'Close', exact: true }).click();
		await expect(page.getByTestId('saved-lists')).toHaveText('2 lists saved');
		await expect(opener).toBeFocused();
		expect(errors).toEqual([]);
	});
}
