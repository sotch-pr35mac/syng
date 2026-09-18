import type { HskLevels } from '@/types/hsk.js';

/** External, versioned schema-4 lexical identity (`1:` plus a SHA-256 digest). */
export type LexicalId = string;

export type DictionarySource = 'cc-cedict' | 'chinese-notes' | 'wiktionary';

export interface Sourced<Value> {
	value: Value;
	sources: DictionarySource[];
}

export interface Pinyin {
	marks: string;
	numbers: string;
	tones: number[];
}

export interface AlternativePronunciation {
	pronunciation: Pinyin;
	label: string;
}

/** Reviewed Chinese varieties used by a classifier reference. */
export type ChineseVariety =
	| 'mandarin'
	| 'cantonese'
	| 'taishanese'
	| 'sichuanese'
	| 'dungan'
	| 'gan'
	| 'hakka'
	| 'jin'
	| 'northern-min'
	| 'middle-chinese'
	| 'eastern-min'
	| 'hokkien'
	| 'teochew'
	| 'leizhou-min'
	| 'puxian-min'
	| 'southern-pinghua'
	| 'wu'
	| 'xiang'
	| 'loudi-xiang'
	| 'hengyang-xiang'
	| 'old-chinese';

/**
 * A classifier's spelling plus an optional unambiguous lexical identity.
 * The identity is absent when its Chinese form has multiple dictionary entries.
 */
export interface MeasureWordReference {
	traditional: string;
	simplified: string;
	lexical_id: LexicalId | null;
	varieties: ChineseVariety[];
}

export interface Example {
	simplified: string | null;
	traditional: string | null;
	english: string | null;
}

export type QualifierCategory =
	'domain' | 'register' | 'region' | 'usage' | 'restriction' | 'information' | 'explanation';

export interface Qualifier {
	category: QualifierCategory;
	value: string;
}

export type LexicalKind =
	| 'boilerplate'
	| 'bound-form'
	| 'classifier'
	| 'contraction'
	| 'expression'
	| 'foreign'
	| 'infix'
	| 'idiom'
	| 'pattern'
	| 'phrase'
	| 'phonetic'
	| 'prefix'
	| 'proverb'
	| 'radical'
	| 'set-phrase'
	| 'suffix';

export type PartOfSpeech =
	| 'adjective'
	| 'adverb'
	| 'auxiliary-verb'
	| 'conjunction'
	| 'determiner'
	| 'interjection'
	| 'interrogative-pronoun'
	| 'measure-word'
	| 'noun'
	| 'number'
	| 'onomatopoeia'
	| 'ordinal'
	| 'particle'
	| 'postposition'
	| 'preposition'
	| 'pronoun'
	| 'proper-noun'
	| 'quantity'
	| 'verb';

export interface Definition {
	gloss: Sourced<string>;
	examples: Sourced<Example>[];
	commentary: Sourced<string>[];
	qualifiers: Sourced<Qualifier>[];
	lexical_kinds: Sourced<LexicalKind>[];
	parts_of_speech: Sourced<PartOfSpeech>[];
	alternative_pronunciations: Sourced<AlternativePronunciation>[];
	measure_words: Sourced<MeasureWordReference>[];
}

/** The complete schema-4 unit serialized by native dictionary commands. */
export interface LexicalUnit {
	id: LexicalId;
	simplified: string;
	traditional: string;
	pinyin: Pinyin;
	commonness: number;
	alternative_pronunciations: Sourced<AlternativePronunciation>[];
	measure_words: Sourced<MeasureWordReference>[];
	hsk: HskLevels;
	english: Definition[];
}

export interface LegacyLexicalUnitResolution {
	unit: LexicalUnit | null;
	reason: string | null;
}

/** Flatten only fields the existing views already render. */
export const lexicalGlosses = (unit: LexicalUnit): string[] => {
	const definitions = Array.isArray(unit.english) ? (unit.english as unknown[]) : [];
	return definitions.map((definition) => {
		if (typeof definition === 'string') {
			return definition;
		}
		const gloss = (definition as { gloss?: { value?: unknown } }).gloss?.value;
		return typeof gloss === 'string' ? gloss : '';
	});
};

/** Flatten the primary structured pronunciation for existing renderers. */
export const lexicalPinyin = (unit: LexicalUnit): Pinyin => {
	const legacyUnit = unit as unknown as {
		pinyin_marks?: unknown;
		pinyin_numbers?: unknown;
		tone_marks?: unknown;
	};
	return (
		unit.pinyin ?? {
			marks: Array.isArray(legacyUnit.pinyin_marks)
				? legacyUnit.pinyin_marks
						.filter((value): value is string => typeof value === 'string')
						.join(' ')
				: typeof legacyUnit.pinyin_marks === 'string'
					? legacyUnit.pinyin_marks
					: '',
			numbers: typeof legacyUnit.pinyin_numbers === 'string' ? legacyUnit.pinyin_numbers : '',
			tones: Array.isArray(legacyUnit.tone_marks) ? legacyUnit.tone_marks : [],
		}
	);
};

export const lexicalDisplayId = (unit: LexicalUnit): string => {
	const legacyUnit = unit as unknown as { lexical_id?: unknown; hash?: unknown };
	if (typeof unit.id === 'string') {
		return unit.id;
	}
	if (typeof legacyUnit.lexical_id === 'string') {
		return legacyUnit.lexical_id;
	}
	return typeof legacyUnit.hash === 'string' ? legacyUnit.hash : '';
};

const isMeasureWordReference = (value: unknown): value is MeasureWordReference => {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const reference = value as Partial<MeasureWordReference>;
	return (
		typeof reference.traditional === 'string' &&
		typeof reference.simplified === 'string' &&
		(reference.lexical_id === null || typeof reference.lexical_id === 'string') &&
		Array.isArray(reference.varieties)
	);
};

const isSourcedMeasureWord = (value: unknown): value is Sourced<MeasureWordReference> =>
	Boolean(value) &&
	typeof value === 'object' &&
	isMeasureWordReference((value as Partial<Sourced<unknown>>).value);

/** Flatten only current structured classifier references without losing their labels or fallbacks. */
export const lexicalMeasureWords = (unit: LexicalUnit): Sourced<MeasureWordReference>[] => {
	const definitions = Array.isArray(unit.english) ? (unit.english as unknown[]) : [];
	const references = [
		...(Array.isArray(unit.measure_words) ? unit.measure_words : []),
		...definitions.flatMap((definition) =>
			Array.isArray((definition as Partial<Definition>)?.measure_words)
				? (definition as Definition).measure_words
				: []
		),
	];

	return references.filter(isSourcedMeasureWord);
};

/** Render-only fallback while older component fixtures are converted to schema-4 data. */
export const lexicalLegacyMeasureWords = (unit: LexicalUnit): unknown[] => {
	const legacyUnit = unit as unknown as { measure_words?: unknown };
	return Array.isArray(legacyUnit.measure_words) ? legacyUnit.measure_words : [];
};

export const lexicalUnitFromToolSegment = (segment: {
	lexical_unit?: LexicalUnit | null;
	word_data?: unknown;
}): LexicalUnit | null =>
	segment.lexical_unit ?? (segment.word_data as LexicalUnit | undefined) ?? null;
