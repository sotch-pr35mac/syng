/* eslint-disable @typescript-eslint/no-magic-numbers -- Pin animation fractions and viewport sizes for this browser regression. */
import { expect, test, type Locator } from '@playwright/test';

async function sampleTransition(indicator: Locator) {
	await expect
		.poll(() => indicator.evaluate((element) => element.getAnimations().length))
		.toBeGreaterThan(0);
	return indicator.evaluate(async (element) => {
		const animation = element.getAnimations()[0];
		animation.pause();
		const duration = Number(animation.effect!.getTiming().duration);
		const content = element.querySelector<HTMLElement>('.indicator-content')!;
		const samples = [];
		for (const progress of [0.05, 0.25, 0.5, 0.75, 0.95]) {
			animation.currentTime = duration * progress;
			await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
			const bounds = content.getBoundingClientRect();
			const clippingBounds = element.getBoundingClientRect();
			samples.push({
				width: bounds.width,
				height: bounds.height,
				clippingWidth: clippingBounds.width,
				clippingHeight: clippingBounds.height,
				overflow: getComputedStyle(element).overflow,
				children: Array.from(content.children, (child) => {
					const childBounds = child.getBoundingClientRect();
					return {
						left: childBounds.left - bounds.left,
						top: childBounds.top - bounds.top,
						height: childBounds.height,
					};
				}),
			});
		}
		animation.finish();
		return samples;
	});
}

for (const colorScheme of ['light', 'dark'] as const) {
	for (const mobile of [false, true]) {
		test(`${colorScheme} ${mobile ? 'mobile' : 'desktop'} timer colors follow Increase Contrast while suspended or paused`, async ({
			page,
		}) => {
			await page.emulateMedia({ colorScheme });
			await page.clock.install();
			await page.goto(
				`/src/test/accessibility/index.html?quizFeedback&timers${mobile ? '&mobile' : ''}`
			);
			const resultTimer = page.getByRole('region', { name: 'Result timer' });
			const questionTimer = page.getByRole('region', { name: 'Question timer' });
			const toggle = page.getByRole('checkbox', { name: 'Increase Contrast' });
			async function setAppearance(appearance: 'original' | 'contrast') {
				const checked = appearance === 'contrast';
				if ((await toggle.isChecked()) !== checked) {
					await toggle.focus();
					await page.keyboard.press('Space');
				}
				await expect(toggle).toBeChecked({ checked });
			}
			await expect(questionTimer.getByRole('button')).toBeVisible();
			await page.clock.runFor(3000);
			await page.getByRole('button', { name: 'Suspend timers' }).click();

			const neutral = resultTimer.locator('circle').first();
			const resultProgress = resultTimer.locator('.mobile-timer__progress');
			const questionAccent = questionTimer.locator('circle').last();
			const progressAttribute = mobile ? 'stroke-dashoffset' : 'opacity';
			const suspendedProgress = await questionAccent.getAttribute(progressAttribute);
			const colors = {
				original: {
					neutral: 'rgb(205, 209, 214)',
					blue: 'rgb(118, 175, 249)',
					red: 'rgb(228, 57, 120)',
				},
				contrast: {
					neutral: colorScheme === 'light' ? 'rgb(140, 140, 140)' : 'rgb(154, 155, 156)',
					blue: colorScheme === 'light' ? 'rgb(0, 107, 223)' : 'rgb(118, 175, 249)',
					red: colorScheme === 'light' ? 'rgb(229, 0, 111)' : 'rgb(236, 108, 157)',
				},
			};

			for (const appearance of ['original', 'contrast', 'original'] as const) {
				await setAppearance(appearance);
				if (mobile) {
					await expect(resultProgress).toHaveCSS('stroke', colors[appearance].blue);
				} else {
					await expect(neutral).toHaveCSS('fill', colors[appearance].neutral);
					await expect(questionTimer.locator('circle').first()).toHaveCSS(
						'fill',
						colors[appearance].neutral
					);
				}
				await expect(questionAccent).toHaveCSS(
					mobile ? 'stroke' : 'fill',
					colors[appearance].red
				);
				await expect(questionAccent).toHaveAttribute(progressAttribute, suspendedProgress!);
			}

			// Manual pause must also keep following appearance changes without a tick.
			await questionTimer.getByRole('button', { name: 'Pause timer' }).click();
			await expect(questionTimer.getByRole('button', { name: 'Resume timer' })).toBeVisible();
			for (const appearance of ['contrast', 'original'] as const) {
				await setAppearance(appearance);
				if (mobile) {
					await expect(questionAccent).toHaveCSS('stroke', colors[appearance].red);
				} else {
					await expect(questionTimer.locator('svg path')).toHaveCSS(
						'fill',
						colors[appearance].neutral
					);
				}
			}
		});
	}
}

for (const mobile of [false, true]) {
	for (const answer of ['correct', 'incorrect', 'long incorrect']) {
		test(`${mobile ? 'mobile' : 'desktop'} ${answer} feedback clips without reflow during entry and exit`, async ({
			page,
		}) => {
			const longAnswer = answer.startsWith('long');
			await page.setViewportSize({
				width: mobile || longAnswer ? 320 : 1100,
				height: 800,
			});
			await page.goto(
				`/src/test/accessibility/index.html?quizFeedback${mobile ? '&mobile' : ''}${answer !== 'correct' ? '&incorrect' : ''}${longAnswer ? '&longAnswer&fontSize=32' : ''}`
			);
			await page.evaluate(() => document.fonts.ready);
			const toggle = page.getByRole('button', { name: 'Toggle feedback' });
			const indicator = page.locator('.result-indicator');

			for (const direction of ['entry', 'exit']) {
				await toggle.click();
				const samples = await sampleTransition(indicator);
				const first = samples[0];
				for (const sample of samples) {
					expect(sample.overflow).toBe('hidden');
					expect(Math.abs(sample.height - first.height), direction).toBeLessThan(1);
					expect(Math.abs(sample.width - first.width), direction).toBeLessThan(1);
					for (const [index, child] of sample.children.entries()) {
						expect(Math.abs(child.top - first.children[index].top)).toBeLessThan(1);
						expect(Math.abs(child.left - first.children[index].left)).toBeLessThan(1);
						expect(Math.abs(child.height - first.children[index].height)).toBeLessThan(
							1
						);
					}
				}
				const clippingSizes = samples.map((sample) =>
					mobile ? sample.clippingHeight : sample.clippingWidth
				);
				expect(Math.max(...clippingSizes) - Math.min(...clippingSizes)).toBeGreaterThan(10);

				if (direction === 'entry') {
					await expect
						.poll(() => indicator.evaluate((element) => element.getAnimations().length))
						.toBe(0);
					if (longAnswer) {
						const answerText = page.locator('.answer-text');
						const layout = await answerText.evaluate((element) => {
							const range = document.createRange();
							range.selectNodeContents(element);
							return {
								lines: range.getClientRects().length,
								fits: element.scrollWidth <= element.clientWidth + 1,
							};
						});
						expect(layout.fits).toBe(true);
						expect(layout.lines).toBeGreaterThan(1);
					}
				} else {
					await expect(indicator).toHaveCount(0);
				}
			}
		});
	}
}
