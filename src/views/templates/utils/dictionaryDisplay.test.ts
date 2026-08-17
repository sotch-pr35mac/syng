import { describe, expect, it } from 'vitest';
import { CHARACTER_SETS } from '@/types/dictionaryDisplay.js';
import { resolveCharacterForms } from '@/utils/dictionaryDisplay.js';

describe('resolveCharacterForms', () => {
	it('returns only the simplified form for the simplified preference', () => {
		expect(resolveCharacterForms('实验', '實驗', CHARACTER_SETS.SIMPLIFIED)).toEqual([
			{
				script: CHARACTER_SETS.SIMPLIFIED,
				characters: '实验',
				showLabel: false,
			},
		]);
	});

	it('returns only the traditional form for the traditional preference', () => {
		expect(resolveCharacterForms('实验', '實驗', CHARACTER_SETS.TRADITIONAL)).toEqual([
			{
				script: CHARACTER_SETS.TRADITIONAL,
				characters: '實驗',
				showLabel: false,
			},
		]);
	});

	it('returns both labeled forms when they differ', () => {
		expect(resolveCharacterForms('实验', '實驗', CHARACTER_SETS.BOTH)).toEqual([
			{
				script: CHARACTER_SETS.SIMPLIFIED,
				characters: '实验',
				showLabel: true,
			},
			{
				script: CHARACTER_SETS.TRADITIONAL,
				characters: '實驗',
				showLabel: true,
			},
		]);
	});

	it('returns an identical form once without a label', () => {
		expect(resolveCharacterForms('中国', '中国', CHARACTER_SETS.BOTH)).toEqual([
			{
				script: CHARACTER_SETS.SIMPLIFIED,
				characters: '中国',
				showLabel: false,
			},
		]);
	});
});
