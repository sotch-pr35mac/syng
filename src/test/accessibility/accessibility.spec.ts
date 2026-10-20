import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const fixtureUrl = '/src/test/accessibility/index.html';

test.describe('touch dropdown activation', () => {
	test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });
	for (const triggerName of ['Choose list', 'List actions']) {
		test(`${triggerName} keeps the current snap when tapped`, async ({ page }) => {
			for (const snap of ['collapsed', 'partial']) {
				await page.goto(`${fixtureUrl}?sheet&mobile&snap=${snap}`);
				const handle = page.getByRole('separator', { name: 'Resize panel' });
				await expect(handle).toHaveAttribute('aria-valuetext', snap);
				await page.getByRole('button', { name: triggerName, exact: true }).tap();
				await expect(page.getByRole('menu')).toBeVisible();
				await expect(handle).toHaveAttribute('aria-valuetext', snap);
				await page.getByRole('menuitem', { name: 'First action' }).tap();
				await expect(page.getByRole('menu')).toHaveCount(0);
				await expect(handle).toHaveAttribute('aria-valuetext', snap);
			}
		});
	}
});

for (const triggerName of ['Choose list', 'List actions']) {
	test(`${triggerName} menu follows snap-sheet animation and dragging`, async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await page.goto(`${fixtureUrl}?sheet&mobile`);
		const trigger = page.getByRole('button', { name: triggerName, exact: true });
		await trigger.click();
		const menu = page.getByRole('menu');
		await expect(menu).toBeVisible();
		await expect(menu).toHaveCSS('transition-property', 'opacity');
		const triggerId = await trigger.getAttribute('id');

		// Dispatch the sheet's real resize keys without moving focus away from the
		// menu, so both the transition and the up/down direction change stay visible.
		for (const key of ['End', 'ArrowDown']) {
			const samples = await page.evaluate(
				async ({ key, triggerId, rightAligned }) => {
					const handle = document.querySelector('[role="separator"]')!;
					const trigger = document.getElementById(triggerId!)!;
					const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
					handle.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
					// Let the direction change register its positioning callback first.
					await Promise.resolve();
					const samples: { gap: number; horizontalError: number; triggerTop: number }[] =
						[];
					const started = performance.now();
					while (performance.now() - started < 450) {
						await new Promise<void>((resolve) =>
							requestAnimationFrame(() => resolve())
						);
						const triggerBounds = trigger.getBoundingClientRect();
						const menuBounds = menu.getBoundingClientRect();
						// The menu can flip to fit the viewport; measure its visible edge.
						samples.push({
							gap:
								menuBounds.bottom <= triggerBounds.top
									? triggerBounds.top - menuBounds.bottom
									: menuBounds.top - triggerBounds.bottom,
							horizontalError: rightAligned
								? menuBounds.right - triggerBounds.right
								: menuBounds.left - triggerBounds.left,
							triggerTop: triggerBounds.top,
						});
					}
					return samples;
				},
				{ key, triggerId, rightAligned: triggerName === 'List actions' }
			);
			expect(samples.length).toBeGreaterThan(5);
			expect(
				Math.max(...samples.map((sample) => sample.triggerTop)) -
					Math.min(...samples.map((sample) => sample.triggerTop))
			).toBeGreaterThan(100);
			// Compositor motion and JS bounds reads can sample slightly different
			// instants (up to ~3px in WebKit here). Require tight tracking throughout
			// the animation, and subpixel alignment once the sheet settles.
			expect(Math.max(...samples.map((sample) => Math.abs(sample.gap - 4)))).toBeLessThan(5);
			expect(Math.abs(samples[samples.length - 1].gap - 4)).toBeLessThan(1);
			expect(
				Math.max(...samples.map((sample) => Math.abs(sample.horizontalError)))
			).toBeLessThan(2);
		}

		const handleBounds = await page
			.getByRole('separator', { name: 'Resize panel' })
			.boundingBox();
		const triggerBefore = await trigger.boundingBox();
		await page.mouse.move(
			handleBounds!.x + handleBounds!.width / 2,
			handleBounds!.y + handleBounds!.height / 2
		);
		await page.mouse.down();
		await page.mouse.move(
			handleBounds!.x + handleBounds!.width / 2,
			handleBounds!.y + handleBounds!.height / 2 - 80,
			{ steps: 8 }
		);
		await expect
			.poll(async () => (await trigger.boundingBox())!.y)
			.toBeLessThan(triggerBefore!.y - 70);
		await expect
			.poll(async () => {
				const triggerBounds = await trigger.boundingBox();
				const menuBounds = await menu.boundingBox();
				return Math.abs(triggerBounds!.y - menuBounds!.y - menuBounds!.height - 4);
			})
			.toBeLessThan(2);
		await page.mouse.up();
	});
}

test('appearance control remains readable at 320px with doubled text', async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 320, height: 740 });
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto(`${fixtureUrl}?palette&mobile&fontSize=32`);
	const control = page.getByTestId('appearance-control');
	const description = control.locator('.increase-contrast-settings > label');
	expect(
		await description.evaluate((element) => element.scrollWidth <= element.clientWidth)
	).toBe(true);
	const toggle = page.getByRole('checkbox', { name: 'Increase Contrast' });
	await toggle.focus();
	await page.keyboard.press('Space');
	await expect(toggle).toBeChecked();
	const results = await new AxeBuilder({ page })
		.include('[data-testid="appearance-control"]')
		.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
		.analyze();
	expect(results.violations).toEqual([]);
	await page.screenshot({
		path: testInfo.outputPath('appearance-320px-32px.png'),
		animations: 'disabled',
	});
});

for (const colorScheme of ['light', 'dark'] as const) {
	for (const mobile of [false, true]) {
		test(`${colorScheme} ${mobile ? 'mobile' : 'desktop'} appearance switch is accessible, reversible and saved`, async ({
			page,
			context,
		}, testInfo) => {
			await page.emulateMedia({ colorScheme });
			if (mobile) await page.setViewportSize({ width: 390, height: 844 });
			const url = `${fixtureUrl}?palette${mobile ? '&mobile' : ''}`;
			await page.goto(url);
			const toggle = page.getByRole('checkbox', { name: 'Increase Contrast' });
			await expect(toggle).not.toBeChecked();
			await expect(page.locator('html')).toHaveAttribute('data-appearance', 'original');
			const track = toggle.locator('+ label');
			const comparisonTrack = page
				.getByRole('checkbox', { name: 'Comparison toggle' })
				.locator('+ label');
			await expect(track).toHaveCSS('background-color', 'rgb(154, 155, 156)');
			await expect(comparisonTrack).toHaveCSS('background-color', 'rgb(154, 155, 156)');
			const standardField = page.getByRole('textbox', {
				name: 'Standard field',
				exact: true,
			});
			const originalBorder = mobile
				? colorScheme === 'light'
					? 'rgba(71, 76, 90, 0.12)'
					: 'rgba(255, 255, 255, 0.1)'
				: colorScheme === 'light'
					? 'rgb(245, 245, 245)'
					: 'rgb(44, 44, 44)';
			await expect(standardField).toHaveCSS('border-top-color', originalBorder);
			const settingsIcon = page.locator(
				mobile ? 'a[href="#/settings"]' : 'a[href="#/settings"] .navigation--item'
			);
			const bookmarksIcon = page.locator(
				mobile ? 'a[href="#/bookmarks"]' : 'a[href="#/bookmarks"] .navigation--item'
			);
			await expect(settingsIcon).toHaveCSS('color', 'rgb(154, 155, 156)');
			await expect(bookmarksIcon).toHaveCSS('color', 'rgb(154, 155, 156)');
			const switchResults = await new AxeBuilder({ page })
				.include('[data-testid="appearance-control"]')
				.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
				.analyze();
			expect(switchResults.violations).toEqual([]);

			// Use the existing native checkbox's keyboard behavior, including a visible ring.
			await toggle.focus();
			await page.keyboard.press('Space');
			await expect(toggle).toBeChecked();
			await expect(page.locator('html')).toHaveAttribute('data-appearance', 'contrast');
			await expect(settingsIcon).toHaveCSS(
				'color',
				colorScheme === 'light' ? 'rgb(140, 140, 140)' : 'rgb(154, 155, 156)'
			);
			await expect(bookmarksIcon).toHaveCSS(
				'color',
				colorScheme === 'light' ? 'rgb(140, 140, 140)' : 'rgb(154, 155, 156)'
			);
			await expect(standardField).toHaveCSS(
				'border-top-color',
				colorScheme === 'light' ? 'rgb(140, 140, 140)' : 'rgb(154, 155, 156)'
			);
			await expect(toggle.locator('+ label')).toHaveCSS('outline-style', 'solid');
			const contrastResults = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
				.analyze();
			expect(contrastResults.violations).toEqual([]);
			await page.screenshot({ path: testInfo.outputPath('contrast.png'), fullPage: true });

			await page.reload();
			await expect(toggle).toBeChecked();
			await expect(page.locator('html')).toHaveAttribute('data-appearance', 'contrast');
			const secondWindow = await context.newPage();
			await secondWindow.goto(fixtureUrl);
			await expect(secondWindow.locator('html')).toHaveAttribute(
				'data-appearance',
				'contrast'
			);
			await toggle.locator('+ label').click();
			await expect(toggle).not.toBeChecked();
			await expect(track).toHaveCSS('background-color', 'rgb(154, 155, 156)');
			await expect(standardField).toHaveCSS('border-top-color', originalBorder);
			await expect(secondWindow.locator('html')).toHaveAttribute(
				'data-appearance',
				'original'
			);
			await secondWindow.close();
			await expect(page.getByRole('button', { name: 'Save word' })).toHaveCSS(
				'color',
				colorScheme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(35, 35, 35)'
			);
			await page.screenshot({ path: testInfo.outputPath('original.png'), fullPage: true });
			await page.reload();
			await expect(toggle).not.toBeChecked();
		});
	}
}

test('original light palette, row hover and unbounded ghost inputs remain visible', async ({
	page,
	browserName,
}, testInfo) => {
	await page.emulateMedia({ colorScheme: 'light' });
	await page.goto(`${fixtureUrl}?palette`);
	const navigationItem = page
		.getByRole('link', { name: 'Read', exact: true })
		.locator('.navigation--item');
	await expect(navigationItem).toHaveCSS('color', 'rgb(154, 155, 156)');
	await navigationItem.hover();
	await expect(navigationItem).toHaveCSS('color', 'rgb(118, 175, 249)');
	await page.screenshot({ path: testInfo.outputPath('navigation-hover.png') });

	const result = page.getByRole('button', { name: /mother/ });
	await expect(result).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
	await result.hover();
	await expect(result).toHaveCSS('background-color', 'rgb(245, 245, 245)');
	await expect(result).toHaveCSS('appearance', 'none');
	await page.screenshot({ path: testInfo.outputPath('result-hover.png') });
	await result.click();
	await navigationItem.hover();
	await expect(result).toHaveCSS('background-color', 'rgb(245, 245, 245)');
	await expect(result).toHaveAttribute('aria-current', 'true');

	const ghost = page.getByRole('textbox', { name: 'Search dictionary' });
	await ghost.click();
	await expect(ghost).toHaveCSS('outline-style', 'none');
	await page.getByRole('button', { name: 'EN', exact: true }).focus();
	await page.keyboard.press(
		browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab'
	);
	await expect(ghost).toBeFocused();
	await expect(ghost).toHaveCSS('outline-style', 'none');
	await ghost.evaluate((element) => element.classList.add('sy-focus-visible'));
	await expect(ghost).toHaveCSS('outline-style', 'none');
	const standard = page.getByRole('textbox', { name: 'Standard field', exact: true });
	await standard.focus();
	await expect(standard).toHaveCSS('outline-style', 'solid');
	await ghost.click();
	await page.screenshot({ path: testInfo.outputPath('restored-light-palette.png') });
});

test('Reader cards and import controls remain usable with enlarged text', async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 320, height: 740 });
	await page.goto(`${fixtureUrl}?fontSize=32&reader&appearance=contrast`);
	const card = page.getByRole('button', { name: 'Select A long book title for enlarged text' });
	await card.click();
	await expect(card).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: 'Edit A long book title for enlarged text' }).click();
	await expect(card).toHaveAttribute('aria-pressed', 'true');
	await page.getByRole('button', { name: 'Import text', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Import from Clipboard' });
	await expect(dialog).toBeVisible();
	const results = await new AxeBuilder({ page })
		.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
		.analyze();
	expect(results.violations).toEqual([]);
	const bounds = await dialog.boundingBox();
	expect(bounds?.x).toBeGreaterThanOrEqual(0);
	expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(320);
	expect(bounds?.y).toBeGreaterThanOrEqual(0);
	expect((bounds?.y ?? 0) + (bounds?.height ?? 0)).toBeLessThanOrEqual(740);
	await page.screenshot({ path: testInfo.outputPath('reader-import-32px.png') });
	await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
	await expect(dialog).toHaveCount(0);
});

for (const mobile of [false, true]) {
	test(`${mobile ? 'mobile' : 'desktop'} empty-state text follows system text size`, async ({
		page,
	}) => {
		await page.setViewportSize({ width: mobile ? 320 : 1100, height: 800 });
		const surface = mobile ? '&mobile' : '';
		const messages = [
			{
				query: '&emptySearch',
				text: 'No results found. Try another word in Chinese, English, or pinyin.',
			},
			{ query: '', text: 'This list is empty. Search for a word, then add it to this list.' },
			...(mobile ? [{ query: '&savedWord', text: 'Quiz needs at least 4 words' }] : []),
		];
		for (const message of messages) {
			await page.goto(`${fixtureUrl}?routes${surface}${message.query}`);
			const copy = page.getByText(message.text, { exact: true });
			await expect(copy).toBeVisible();
			await expect(copy).toHaveCSS('font-size', '13px');
			await page.evaluate(() =>
				document.documentElement.style.setProperty('--sy-system-font-size', '32px')
			);
			await expect(copy).toHaveCSS('font-size', '26px');
			const bounds = await copy.boundingBox();
			expect(bounds?.x).toBeGreaterThanOrEqual(0);
			expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(
				mobile ? 320 : 1100
			);
		}
	});

	for (const colorScheme of ['light', 'dark'] as const) {
		test(`${colorScheme} ${mobile ? 'mobile' : 'desktop'} bookmark errors expose validation and follow contrast`, async ({
			page,
		}) => {
			await page.emulateMedia({ colorScheme });
			await page.setViewportSize({ width: mobile ? 320 : 1100, height: 800 });
			await page.goto(`${fixtureUrl}?routes&savedWord${mobile ? '&mobile' : ''}`);
			await page.getByRole('button', { name: 'Choose list: Bookmarks' }).click();
			await page.getByRole('menuitem', { name: 'Create New' }).click();
			const dialog = page.getByRole('dialog', { name: 'Create List' });
			const input = dialog.getByRole('textbox', {
				name: 'What would you like to call this list?',
			});
			await dialog.getByRole('button', { name: 'Create', exact: true }).click();
			const error = dialog.getByRole('alert');
			await expect(error).toHaveText('Enter a name for your list.');
			await expect(input).toHaveAttribute('aria-invalid', 'true');
			await expect(input).toHaveAttribute(
				'aria-describedby',
				(await error.getAttribute('id')) as string
			);
			await expect(error).toHaveCSS('color', 'rgb(228, 57, 120)');
			await page.evaluate(() => (document.documentElement.dataset.appearance = 'contrast'));
			await expect(error).toHaveCSS(
				'color',
				colorScheme === 'light' ? 'rgb(218, 0, 105)' : 'rgb(236, 108, 157)'
			);
			// The pointer remains over Create. Wait for its existing background
			// transition to finish before sampling contrast in the changed theme.
			await expect(dialog.getByRole('button', { name: 'Create', exact: true })).toHaveCSS(
				'background-color',
				colorScheme === 'light' ? 'rgb(245, 245, 245)' : 'rgb(44, 44, 44)'
			);
			const results = await new AxeBuilder({ page })
				.include('[aria-modal="true"]')
				.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
				.analyze();
			expect(results.violations).toEqual([]);
			await input.fill('New list');
			await expect(error).toHaveCount(0);
			await expect(input).not.toHaveAttribute('aria-invalid');
			await expect(input).not.toHaveAttribute('aria-describedby');
			await dialog.getByRole('button', { name: 'Cancel' }).click();
			if (mobile) {
				const requirement = page.getByText('Quiz needs at least 4 words', { exact: true });
				await expect(requirement).toHaveCSS(
					'color',
					colorScheme === 'light' ? 'rgb(112, 112, 112)' : 'rgb(154, 155, 156)'
				);
				await page.evaluate(
					() => (document.documentElement.dataset.appearance = 'original')
				);
				await expect(requirement).toHaveCSS('color', 'rgb(154, 155, 156)');
			}
		});
	}
}

for (const colorScheme of ['light', 'dark'] as const) {
	test(`${colorScheme} Reader import errors are alerts with contrast colors`, async ({
		page,
	}) => {
		await page.emulateMedia({ colorScheme });
		await page.setViewportSize({ width: 320, height: 740 });
		await page.goto(`${fixtureUrl}?reader&importError&fontSize=32`);
		await page.getByRole('button', { name: 'Import text', exact: true }).click();
		const dialog = page.getByRole('dialog', { name: 'Import from Clipboard' });
		await dialog.getByRole('textbox', { name: 'Text', exact: true }).fill('Keep this passage');
		await dialog.getByRole('button', { name: 'Import', exact: true }).focus();
		await page.keyboard.press('Enter');
		const error = dialog.getByRole('alert');
		await expect(error).toHaveText('Could not save the document. Please try again.');
		await expect(error).toHaveCSS('color', 'rgb(228, 57, 120)');
		await page.evaluate(() => (document.documentElement.dataset.appearance = 'contrast'));
		await expect(error).toHaveCSS(
			'color',
			colorScheme === 'light' ? 'rgb(218, 0, 105)' : 'rgb(236, 108, 157)'
		);
		const results = await new AxeBuilder({ page })
			.include('[aria-modal="true"]')
			.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
			.analyze();
		expect(results.violations).toEqual([]);
	});
}

test('navigation tooltips escape the scroll container and dismiss with Escape', async ({
	page,
}) => {
	await page.goto(fixtureUrl);
	await expect(page.getByRole('heading', { name: 'Syng shared controls' })).toBeVisible();
	await page.evaluate(() => {
		const navigation = document.createElement('nav');
		navigation.setAttribute('aria-label', 'Tooltip fixture');
		navigation.style.cssText =
			'position:fixed;bottom:0;left:0;width:92px;height:80px;overflow-y:auto;z-index:100;';
		navigation.innerHTML =
			'<button aria-label="Navigation help" class="sy-tooltip--container" data-sy-fixed-tooltip style="margin:16px;width:40px;height:40px">?<span class="sy-tooltip--body sy-tooltip--body-right" aria-hidden="true">Navigation help</span></button>';
		document.body.append(navigation);
	});
	await page.getByRole('button', { name: 'Navigation help' }).focus();
	const tooltip = page.locator('[data-sy-fixed-tooltip] .sy-tooltip--body');
	await expect(tooltip).toHaveCSS('opacity', '1');
	expect(
		await tooltip.evaluate((element) => {
			const bounds = element.getBoundingClientRect();
			return element.contains(
				document.elementFromPoint(bounds.right - 2, bounds.top + bounds.height / 2)
			);
		})
	).toBe(true);
	await page.keyboard.press('Escape');
	await expect(tooltip).toHaveCSS('opacity', '0');
});

test('keyboard focus is visible while ordinary button clicks remain quiet', async ({
	page,
	browserName,
}) => {
	await page.goto(fixtureUrl);
	const opener = page.getByRole('button', { name: 'Open dialog', exact: true });
	await expect(opener).toBeVisible();
	// macOS WebKit follows the host's keyboard-navigation preference. Option-Tab
	// reaches all controls without changing the user's system settings.
	await page.keyboard.press(
		browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab'
	);
	await expect(opener).toBeFocused();
	await expect(opener).toHaveCSS('outline-style', 'solid');
	await page.getByRole('button', { name: 'Ghost action' }).click();
	await expect(page.getByRole('button', { name: 'Ghost action' })).not.toHaveCSS(
		'outline-style',
		'solid'
	);
});

test('menus, portaled menus and nested dialogs preserve keyboard focus', async ({
	page,
	browserName,
}) => {
	await page.goto(fixtureUrl);
	await expect(page.getByRole('button', { name: 'Open dialog', exact: true })).toBeVisible();
	await page.keyboard.press(
		browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab'
	);
	await page.keyboard.press('Enter');
	const dialog = page.getByRole('dialog', { name: 'Accessible dialog', exact: true });
	await expect(dialog).toBeVisible();
	await expect(dialog.getByRole('heading')).toBeFocused();
	await dialog.getByRole('button', { name: 'Dialog actions' }).focus();
	await page.keyboard.press('ArrowDown');
	await expect(page.getByRole('menuitem', { name: 'First action' })).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(dialog.getByRole('button', { name: 'Dialog actions' })).toBeFocused();
	await expect(dialog).toBeVisible();
	await dialog.getByRole('button', { name: 'Open nested dialog' }).click();
	await expect(page.getByRole('dialog', { name: 'Nested dialog', exact: true })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Nested dialog', exact: true })).toHaveCount(0);
	await expect(dialog).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('button', { name: 'Open dialog', exact: true })).toBeFocused();
});

for (const colorScheme of ['light', 'dark'] as const) {
	test(`${colorScheme} Contrast controls pass axe at default and enlarged sizes`, async ({
		page,
	}, testInfo) => {
		await page.emulateMedia({ colorScheme });
		for (const fontSize of [16, 32]) {
			await page.goto(`${fixtureUrl}?fontSize=${fontSize}&appearance=contrast`);
			await expect(page.getByRole('heading', { name: 'Syng shared controls' })).toBeVisible();
			const results = await new AxeBuilder({ page })
				.withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
				.analyze();
			expect(results.violations).toEqual([]);
			await page.screenshot({
				path: testInfo.outputPath(`${colorScheme}-${fontSize}px.png`),
				fullPage: true,
			});
		}
	});
}

test('large text reflows at narrow widths without horizontal clipping', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 740 });
	await page.goto(`${fixtureUrl}?fontSize=32`);
	await expect(page.locator('.panes')).toHaveClass(/stacked/);
	const overflowing = await page.evaluate(() =>
		[...document.querySelectorAll('main *')]
			.filter((element) => element.getBoundingClientRect().right > window.innerWidth)
			.map((element) => `${element.tagName}.${element.className}`)
	);
	expect(overflowing).toEqual([]);
	await page.getByRole('button', { name: 'Open dialog', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Accessible dialog', exact: true });
	const bounds = await dialog.boundingBox();
	expect(bounds?.x).toBeGreaterThanOrEqual(0);
	expect((bounds?.x ?? 0) + (bounds?.width ?? 0)).toBeLessThanOrEqual(320);
	await dialog.getByRole('button', { name: 'Done' }).click();
	await expect(dialog).toHaveCount(0);
});
