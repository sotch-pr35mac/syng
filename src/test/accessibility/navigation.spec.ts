import { expect, test } from '@playwright/test';

for (const colorScheme of ['light', 'dark'] as const) {
	test(`desktop rail uses chrome color and selection pill responds to hover in ${colorScheme}`, async ({
		page,
	}, testInfo) => {
		await page.emulateMedia({ colorScheme });
		await page.setViewportSize({ width: 1200, height: 852 });
		await page.goto('/src/test/accessibility/index.html?settings#/settings');
		const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
		const pill = navigation.locator('.navigation--selection-pill');
		const settings = navigation.getByRole('link', { name: 'Settings', exact: true });
		await expect(settings).toHaveAttribute('aria-current', 'page');
		await expect(navigation).toHaveCSS(
			'background-color',
			colorScheme === 'light' ? 'rgb(250, 250, 250)' : 'rgb(36, 36, 36)'
		);
		await expect(pill).toHaveCSS(
			'background-color',
			colorScheme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(30, 30, 30)'
		);
		const fills = await page.evaluate(() => {
			const theme = getComputedStyle(document.documentElement);
			return {
				selection: theme.getPropertyValue('--sy-navigation-selection-fill').trim(),
				content: theme.getPropertyValue('--sy-surface--content').trim(),
			};
		});
		expect(fills.selection).toBe(fills.content);
		const restingShadow = await pill.evaluate((element) => getComputedStyle(element).boxShadow);
		await settings.hover();
		await expect
			.poll(() => pill.evaluate((element) => getComputedStyle(element).boxShadow))
			.not.toBe(restingShadow);
		await page.screenshot({ path: testInfo.outputPath('desktop-settings-hover.png') });
		await page.mouse.move(300, 100);
		await expect(pill).toHaveCSS('box-shadow', restingShadow);
	});

	test(`mobile selected navigation uses the shared pill fill in ${colorScheme}`, async ({
		page,
	}, testInfo) => {
		await page.emulateMedia({ colorScheme });
		await page.setViewportSize({ width: 393, height: 852 });
		await page.goto('/src/test/accessibility/index.html?settings&mobile#/settings');
		const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
		await expect(navigation.locator('.mobile-nav__indicator')).toHaveCSS(
			'background-color',
			colorScheme === 'light' ? 'rgb(255, 255, 255)' : 'rgb(30, 30, 30)'
		);
		await navigation.screenshot({ path: testInfo.outputPath('mobile-navigation.png') });
	});
}

test('mobile navigation centers icons in the pill and keeps matching corner insets', async ({
	page,
}) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.setViewportSize({ width: 393, height: 852 });
	await page.goto('/src/test/accessibility/index.html?settings&mobile#/settings');
	const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
	const geometry = async () =>
		navigation.evaluate((element) => {
			const track = element.querySelector<HTMLElement>('.mobile-nav__tabs')!;
			const pill = element.querySelector<HTMLElement>('.mobile-nav__indicator')!;
			const selected = element.querySelector<HTMLElement>(
				'.mobile-nav__tab[aria-current="page"]'
			)!;
			const icon = selected.querySelector<SVGElement>('svg')!;
			const trackBounds = track.getBoundingClientRect();
			const pillBounds = pill.getBoundingClientRect();
			const selectedBounds = selected.getBoundingClientRect();
			const iconBounds = icon.getBoundingClientRect();
			return {
				trackHeight: trackBounds.height,
				targetHeight: selectedBounds.height,
				pillLeftInset: pillBounds.left - trackBounds.left,
				pillRightInset: trackBounds.right - pillBounds.right,
				pillTopInset: pillBounds.top - trackBounds.top,
				pillBottomInset: trackBounds.bottom - pillBounds.bottom,
				iconCenterX: iconBounds.left + iconBounds.width / 2,
				iconCenterY: iconBounds.top + iconBounds.height / 2,
				pillCenterX: pillBounds.left + pillBounds.width / 2,
				pillCenterY: pillBounds.top + pillBounds.height / 2,
				outerRadius: Number.parseFloat(getComputedStyle(track).borderTopLeftRadius),
				innerRadius: Number.parseFloat(getComputedStyle(pill).borderTopLeftRadius),
			};
		});
	for (const selectedTab of ['Settings', 'Search']) {
		if (selectedTab === 'Search') {
			const link = navigation.getByRole('link', { name: selectedTab });
			await link.click();
			await expect(link).toHaveAttribute('aria-current', 'page');
			await expect
				.poll(async () => {
					const bounds = await geometry();
					return Math.abs(bounds.iconCenterX - bounds.pillCenterX);
				})
				.toBeLessThan(1);
		}
		const bounds = await geometry();
		expect(bounds.trackHeight).toBe(43);
		expect(bounds.targetHeight).toBeGreaterThanOrEqual(44);
		expect(Math.abs(bounds.iconCenterX - bounds.pillCenterX)).toBeLessThan(1);
		expect(Math.abs(bounds.iconCenterY - bounds.pillCenterY)).toBeLessThan(1);
		expect(Math.abs(bounds.pillTopInset - bounds.pillBottomInset)).toBeLessThan(1);
		expect(bounds.outerRadius - bounds.innerRadius).toBe(4);
		const outerEdgeInset =
			selectedTab === 'Settings' ? bounds.pillRightInset : bounds.pillLeftInset;
		expect(Math.abs(outerEdgeInset - bounds.pillTopInset)).toBeLessThan(1);
	}
});

test('mobile navigation pill jiggles on reselect and honors reduced motion', async ({ page }) => {
	await page.setViewportSize({ width: 393, height: 852 });
	await page.goto('/src/test/accessibility/index.html?settings&mobile#/settings');
	const navigation = page.getByRole('navigation', { name: 'Primary navigation' });
	const selected = navigation.getByRole('link', { name: 'Settings' });
	const pill = navigation.locator('.mobile-nav__indicator');
	await pill.evaluate((element) => {
		const samples: number[] = [];
		const start = performance.now();
		const sample = () => {
			samples.push(new DOMMatrixReadOnly(getComputedStyle(element).transform).a);
			if (performance.now() - start < 800) requestAnimationFrame(sample);
			else element.setAttribute('data-motion-samples', JSON.stringify(samples));
		};
		requestAnimationFrame(sample);
	});
	await selected.click();
	await expect(pill).toHaveAttribute('data-motion-samples', /\[/);
	const samples = JSON.parse((await pill.getAttribute('data-motion-samples'))!) as number[];
	expect(Math.max(...samples)).toBeGreaterThan(1.005);
	expect(samples.at(-1)).toBeCloseTo(1, 2);

	await page.emulateMedia({ reducedMotion: 'reduce' });
	await selected.click();
	expect(
		await pill.evaluate(
			(element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).a
		)
	).toBe(1);
});

test('mobile wordmark stays inside its shrinking header', async ({ page }) => {
	await page.setViewportSize({ width: 393, height: 852 });
	for (const progress of [0, 0.5, 0.75, 0.9, 0.98, 1]) {
		await page.goto(
			`/src/test/accessibility/index.html?settings&mobile&brandProgress=${progress}#/settings`
		);
		const dimensions = await page.locator('.mobile-nav__brand').evaluate((brand) => {
			const wordmark = brand.querySelector<HTMLElement>('span')!;
			const brandBounds = brand.getBoundingClientRect();
			const wordmarkBounds = wordmark.getBoundingClientRect();
			return {
				brandHeight: brandBounds.height,
				wordmarkHeight: wordmarkBounds.height,
				wordmarkTop: wordmarkBounds.top - brandBounds.top,
				wordmarkBottom: brandBounds.bottom - wordmarkBounds.bottom,
			};
		});
		expect(dimensions.wordmarkHeight).toBeLessThanOrEqual(dimensions.brandHeight + 0.5);
		expect(dimensions.wordmarkTop).toBeGreaterThanOrEqual(-0.5);
		expect(dimensions.wordmarkBottom).toBeGreaterThanOrEqual(-0.5);
	}
});

test('mobile wordmark remains centered with reduced motion', async ({ page }) => {
	await page.setViewportSize({ width: 393, height: 852 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	for (const progress of [0, 0.5]) {
		await page.goto(
			`/src/test/accessibility/index.html?settings&mobile&brandProgress=${progress}#/settings`
		);
		const centers = await page.locator('.mobile-nav__brand').evaluate((brand) => {
			const wordmark = brand.querySelector<HTMLElement>('span')!;
			const brandBounds = brand.getBoundingClientRect();
			const wordmarkBounds = wordmark.getBoundingClientRect();
			return {
				brandX: brandBounds.left + brandBounds.width / 2,
				brandY: brandBounds.top + brandBounds.height / 2,
				wordmarkX: wordmarkBounds.left + wordmarkBounds.width / 2,
				wordmarkY: wordmarkBounds.top + wordmarkBounds.height / 2,
				scale: new DOMMatrixReadOnly(getComputedStyle(wordmark).transform).a,
			};
		});
		expect(Math.abs(centers.wordmarkX - centers.brandX)).toBeLessThan(0.5);
		expect(Math.abs(centers.wordmarkY - centers.brandY)).toBeLessThan(0.5);
		expect(centers.scale).toBe(1);
	}
});

test('desktop selection pill completes one smooth trip when its target is hovered', async ({
	page,
}) => {
	await page.setViewportSize({ width: 1100, height: 800 });
	await page.goto('/src/test/accessibility/index.html?settings#/settings');
	const pill = page.locator('.navigation--selection-pill');
	await expect(pill).toBeVisible();
	await expect
		.poll(() =>
			pill.evaluate(
				(element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).m42
			)
		)
		.toBeGreaterThan(300);
	const samples = page.evaluate(
		() =>
			new Promise<number[]>((resolve) => {
				const pill = document.querySelector<HTMLElement>('.navigation--selection-pill')!;
				const widths: number[] = [];
				const started = performance.now();
				const sample = () => {
					widths.push(new DOMMatrixReadOnly(getComputedStyle(pill).transform).a);
					if (performance.now() - started < 1000) requestAnimationFrame(sample);
					else resolve(widths);
				};
				requestAnimationFrame(sample);
			})
	);
	const search = page.getByRole('link', { name: 'Search', exact: true });
	await search.click();
	await page.mouse.move(300, 100);
	await search.hover();
	const widths = await samples;
	const narrowest = widths.indexOf(Math.min(...widths));
	expect(widths[narrowest]).toBeLessThan(0.8);
	expect(widths.at(-1)).toBeCloseTo(1, 1);
	for (let index = narrowest + 1; index < widths.length; index += 1) {
		expect(widths[index]).toBeGreaterThanOrEqual(widths[index - 1] - 0.03);
	}
});

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
