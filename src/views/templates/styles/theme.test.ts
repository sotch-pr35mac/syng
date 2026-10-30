// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { READER_COLOR_THEMES, getReaderColorTheme } from '@/utils/readerSettings.js';

const themeCss = readFileSync(new URL('./theme.css', import.meta.url), 'utf8');
const schemes = ['light', 'dark'] as const;
const appearances = ['original', 'contrast'] as const;
const semanticColors = ['blue', 'yellow', 'red', 'green'];
const textTokens = [
	'--sy-color--black',
	'--sy-text--dark',
	'--sy-text--light',
	'--sy-text--muted',
	'--sy-text--secondary',
	'--sy-text--placeholder',
	...semanticColors.map((color) => `--sy-text--${color}`),
	...Array.from({ length: 5 }, (_, index) => `--sy-tone-theme--${index + 1}`),
	...Array.from({ length: 5 }, (_, index) => `--sy-tone-color--${index + 1}`),
];

function declarations(css: string): Record<string, string> {
	return Object.fromEntries(
		[...css.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((match) => [match[1], match[2].trim()])
	);
}

function block(css: string, opening: RegExp): string {
	const match = opening.exec(css);
	if (!match) {
		return '';
	}
	const contentStart = match.index + match[0].length;
	let depth = 1;
	for (let position = contentStart; position < css.length; position += 1) {
		if (css[position] === '{') {
			depth += 1;
		}
		if (css[position] === '}') {
			depth -= 1;
		}
		if (depth === 0) {
			return css.slice(contentStart, position);
		}
	}
	throw new Error('Unclosed theme rule');
}

function themeColors(
	scheme: (typeof schemes)[number],
	appearance: (typeof appearances)[number] = 'original'
): (token: string) => string {
	const base = themeCss.slice(0, themeCss.indexOf('@media'));
	const schemeBlock = block(
		themeCss,
		new RegExp(`@media \\(prefers-color-scheme: ${scheme}\\)\\s*\\{`)
	);
	expect(schemeBlock, `Missing ${scheme} theme declarations`).toBeTruthy();
	const originalSelector = /:root\s*\{/;
	const contrastSelector = /:root\[data-appearance='contrast'\]\s*\{/;
	// Attribute selectors outrank the base :root rules even inside a media query.
	const tokens = {
		...declarations(block(base, originalSelector)),
		...declarations(block(schemeBlock, originalSelector)),
		...(appearance === 'contrast'
			? {
					...declarations(block(base, contrastSelector)),
					...declarations(block(schemeBlock, contrastSelector)),
				}
			: {}),
	};
	const resolve = (token: string, visited = new Set<string>()): string => {
		if (!tokens[token] || visited.has(token)) {
			throw new Error(`Missing or circular theme token: ${token}`);
		}
		visited.add(token);
		const alias = tokens[token].match(/^var\((--[\w-]+)\)$/)?.[1];
		return alias ? resolve(alias, visited) : tokens[token];
	};
	return resolve;
}

function luminance(hex: string): number {
	expect(hex, 'Contrast colors must resolve to opaque six-digit hex values').toMatch(
		/^#[0-9a-f]{6}$/i
	);
	const channels = [1, 3, 5].map((offset) => {
		const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
		return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
	});
	return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function checkContrast(label: string, foreground: string, background: string, minimum = 4.5): void {
	const foregroundLuminance = luminance(foreground);
	const backgroundLuminance = luminance(background);
	const ratio =
		(Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
		(Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
	expect(
		ratio,
		`${label}: ${foreground} on ${background} is ${ratio.toFixed(3)}:1`
	).toBeGreaterThanOrEqual(minimum);
}

describe.each(schemes)('%s Contrast appearance', (scheme) => {
	const color = themeColors(scheme, 'contrast');

	it.each(textTokens)('%s remains readable on application and pressed surfaces', (token) => {
		for (const surface of [
			'--sy-color--white',
			'--sy-color--grey-2',
			'--sy-mobile-state-pressed',
		]) {
			checkContrast(`${token} / ${surface}`, color(token), color(surface));
		}
	});

	it.each(semanticColors)('%s filled controls retain readable labels', (hue) => {
		checkContrast(hue, color('--sy-text--on-fill'), color(`--sy-fill--${hue}`));
	});

	it.each([
		'--sy-focus-color',
		'--sy-control--border',
		'--sy-icon--muted',
		'--sy-icon--hover',
		'--sy-control--track-off',
	])('%s identifies controls on both surfaces', (token) => {
		for (const surface of ['--sy-color--white', '--sy-color--grey-2']) {
			checkContrast(`${token} / ${surface}`, color(token), color(surface), 3);
		}
	});

	it('keeps toggle knobs distinguishable in both states', () => {
		for (const track of ['--sy-control--track-off', '--sy-fill--blue']) {
			checkContrast('Toggle knob', color('--sy-control--knob'), color(track), 3);
		}
	});
});

describe.each(schemes)('%s theme roles', (scheme) => {
	it.each(appearances)('%s Android safe areas match the navigation chrome', (appearance) => {
		const resourceDirectory = new URL(
			`../../../native/gen/android/app/src/main/res/${scheme === 'dark' ? 'values-night' : 'values'}/`,
			import.meta.url
		);
		const themesXml = readFileSync(new URL('themes.xml', resourceDirectory), 'utf8');
		const nativeTheme = themesXml.match(
			/<style name="Theme\.syng"[^>]*>([\s\S]*?)<\/style>/
		)?.[1];
		const backgroundResource = nativeTheme?.match(
			/<item name="android:windowBackground">@color\/([^<]+)<\/item>/
		)?.[1];
		expect(
			backgroundResource,
			'Android must explicitly color its native safe areas'
		).toBeTruthy();
		const colorsXml = readFileSync(new URL('colors.xml', resourceDirectory), 'utf8');
		const nativeColor = colorsXml.match(
			new RegExp(`<color name="${backgroundResource}">#FF([0-9a-f]{6})</color>`, 'i')
		)?.[1];
		expect(nativeColor, 'The native background must be opaque').toBeTruthy();
		expect(`#${nativeColor?.toLowerCase()}`).toBe(
			themeColors(scheme, appearance)('--sy-color--white')
		);
	});

	it.each(appearances)('%s uses the theme white for filled labels', (appearance) => {
		const color = themeColors(scheme, appearance);
		expect(color('--sy-text--on-fill')).toBe(color('--sy-color--white'));
	});

	it('preserves Original brand colors, neutral roles, and tones', () => {
		const color = themeColors(scheme);
		expect(color('--sy-text--muted')).toBe('#9a9b9c');
		expect(color('--sy-text--secondary')).toBe('#788598');
		expect(color('--sy-text--placeholder')).toBe('#cdd1d6');
		expect(color('--sy-text--light')).toBe(scheme === 'light' ? '#d7d7d7' : '#9f9fa0');
		expect(color('--sy-icon--muted')).toBe('#9a9b9c');
		expect(color('--sy-icon--hover')).toBe('#76aff9');
		expect(color('--sy-control--track-off')).toBe('#9a9b9c');
		const originalAccents = [
			'#76aff9',
			'#e48e1c',
			'#e43978',
			scheme === 'light' ? '#43b866' : '#bada55',
		];
		expect(semanticColors.map((hue) => color(`--sy-text--${hue}`))).toEqual(originalAccents);
		expect(semanticColors.map((hue) => color(`--sy-fill--${hue}`))).toEqual(originalAccents);
		expect(
			Array.from({ length: 5 }, (_, index) => color(`--sy-tone-color--${index + 1}`))
		).toEqual(['#2880f2', '#e48e1c', '#e43978', '#43b866', '#9a9b9c']);
		// Original is preserved, not asserted to meet normal-text contrast thresholds.
	});
});

it.each(READER_COLOR_THEMES)(
	'$label Reader preset with Increase Contrast keeps page and surrounding text readable',
	(preset) => {
		const theme = getReaderColorTheme(preset.id, false, true);
		checkContrast('Page text', theme.textColor, theme.backgroundColor);
		checkContrast('Dictionary links', theme.linkColor, theme.backgroundColor);
		checkContrast('Muted page text', theme.mutedTextColor, theme.backgroundColor);
		checkContrast('Muted stage text', theme.mutedTextColor, theme.stageBackgroundColor);
		checkContrast('Selected text', theme.selectionTextColor, theme.selectionBackgroundColor);
	}
);

it('retains the original Reader muted palette unless Increase Contrast is enabled', () => {
	expect(getReaderColorTheme('light').mutedTextColor).toBe('#6b7280');
	expect(getReaderColorTheme('sepia').mutedTextColor).toBe('#76593d');
	expect(getReaderColorTheme('light', false, true).mutedTextColor).toBe('#667080');
	expect(getReaderColorTheme('sepia', false, true).mutedTextColor).toBe('#664a31');
	expect(getReaderColorTheme('dark', false, true)).toBe(getReaderColorTheme('dark'));
});

it.each([false, true])(
	'automatic Reader colors follow the system with Increase Contrast set to %s',
	(increaseContrast) => {
		expect(getReaderColorTheme('automatic', false, increaseContrast)).toBe(
			getReaderColorTheme('light', false, increaseContrast)
		);
		expect(getReaderColorTheme('automatic', true, increaseContrast)).toBe(
			getReaderColorTheme('dark', true, increaseContrast)
		);
	}
);
