import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const releaseStyles = readFileSync(
	new URL('./references/tooltips-2.5.0.css', import.meta.url),
	'utf8'
).replace(/@import[^;]+;/g, '');

for (const colorScheme of ['light', 'dark'] as const) {
	for (const example of [
		{ name: 'primary navigation', selector: 'nav a[href="#/"]' },
		{ name: 'secondary navigation', selector: 'nav a[href="#/settings"]' },
		{
			name: 'bookmark dropdown button',
			selector: 'button[aria-label="Choose bookmark lists"]',
		},
		{ name: 'character button', selector: 'button[aria-label="Write Characters"]' },
		{ name: 'HSK tag', selector: '.sy-tag.sy-tooltip--container' },
		{ name: 'study button', selector: 'button[aria-label="Flashcards for Sample words"]' },
	]) {
		test(`${colorScheme} ${example.name} retains release 2.5.0 tooltip appearance`, async ({
			page,
		}, testInfo) => {
			await page.emulateMedia({ colorScheme });
			await page.goto('/src/test/accessibility/index.html?tooltips');
			const trigger = page.locator(example.selector);
			await trigger.hover();
			const tooltip = trigger.locator('.sy-tooltip--body');
			await expect(tooltip).toHaveCSS('opacity', '1');
			const bounds = (await tooltip.boundingBox())!;
			const shadow = await tooltip.evaluate((element) => getComputedStyle(element).boxShadow);
			// Compare the tooltip itself; adjacent controls have independent hover effects.
			// Check its shadow separately so surrounding page pixels cannot mask a mismatch.
			const actual = await tooltip.screenshot({
				animations: 'disabled',
				path: testInfo.outputPath('current.png'),
			});

			// Render the released CSS AND its paragraph-wrapped markup in the same
			// browser/location. This avoids platform-specific font rasterization baselines.
			await page.addStyleTag({
				content: `${releaseStyles}\n.sy-tooltip--body > p { margin: 1em 0; }`,
			});
			await tooltip.evaluate((element) => {
				if (!element.querySelector('p')) {
					const paragraph = document.createElement('p');
					paragraph.textContent = element.textContent?.trim() ?? '';
					element.replaceChildren(paragraph);
				}
			});
			expect(await tooltip.boundingBox()).toEqual(bounds);
			await expect(tooltip).toHaveCSS('box-shadow', shadow);
			const released = await tooltip.screenshot({
				animations: 'disabled',
				path: testInfo.outputPath('release-2.5.0.png'),
			});
			expect(actual.equals(released), 'Tooltip pixels should match release 2.5.0').toBe(true);
		});
	}
}
