import { describe, expect, it } from 'vitest';
import { CHARACTER_SETS } from '@/types/dictionaryDisplay.js';
import {
	formatDictionarySources,
	formatPartOfSpeech,
	formatQualifierCategory,
	lexicalExamples,
	lexicalPartsOfSpeech,
} from '@/types/dictionary.js';
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

	it('falls back to the available script when the preferred script is missing', () => {
		expect(resolveCharacterForms(null, '傳統', CHARACTER_SETS.SIMPLIFIED)).toEqual([
			{
				script: CHARACTER_SETS.TRADITIONAL,
				characters: '傳統',
				showLabel: true,
			},
		]);
		expect(resolveCharacterForms('简体', null, CHARACTER_SETS.TRADITIONAL)).toEqual([
			{
				script: CHARACTER_SETS.SIMPLIFIED,
				characters: '简体',
				showLabel: true,
			},
		]);
	});

	it('returns only available forms for the both preference', () => {
		expect(resolveCharacterForms(null, '傳統', CHARACTER_SETS.BOTH)).toEqual([
			{
				script: CHARACTER_SETS.TRADITIONAL,
				characters: '傳統',
				showLabel: true,
			},
		]);
	});
});

describe('dictionary metadata helpers', () => {
	const dictionaryUnit = {
		english: [
			{
				gloss: { value: 'first', sources: ['cc-cedict'] },
				examples: [
					{
						value: { simplified: '一', traditional: '一', english: 'one' },
						sources: ['cc-cedict'],
					},
				],
				parts_of_speech: [
					{ value: 'noun', sources: ['cc-cedict'] },
					{ value: 'verb', sources: ['wiktionary'] },
				],
			},
			{
				gloss: { value: 'second', sources: ['wiktionary'] },
				examples: [
					{
						value: { simplified: '二', traditional: '二', english: null },
						sources: ['wiktionary'],
					},
				],
				parts_of_speech: [
					{ value: 'noun', sources: ['wiktionary', 'cc-cedict'] },
					{ value: 'verb', sources: ['chinese-notes'] },
				],
			},
		],
	} as never;

	it('aggregates POS in insertion order and merges source attributions', () => {
		expect(lexicalPartsOfSpeech(dictionaryUnit)).toEqual([
			{ value: 'noun', sources: ['cc-cedict', 'wiktionary'] },
			{ value: 'verb', sources: ['wiktionary', 'chinese-notes'] },
		]);
	});

	it('flattens examples in definition order', () => {
		expect(lexicalExamples(dictionaryUnit)).toEqual([
			{ simplified: '一', traditional: '一', english: 'one' },
			{ simplified: '二', traditional: '二', english: null },
		]);
	});

	it('formats labels and source tooltips for metadata tags', () => {
		expect(formatPartOfSpeech('auxiliary-verb')).toBe('Auxiliary Verb');
		expect(formatDictionarySources(['cc-cedict'])).toBe('Source: CC-CEDICT');
		expect(formatDictionarySources(['cc-cedict', 'wiktionary'])).toBe(
			'Sources: CC-CEDICT, Wiktionary'
		);
		expect(formatQualifierCategory('domain')).toBe('Domain');
		expect(formatQualifierCategory('register')).toBe('Register');
	});
});
