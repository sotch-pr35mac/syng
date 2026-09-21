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

export type DictionaryDefinition = Definition | string;

const DICTIONARY_SOURCE_LABELS: Record<DictionarySource, string> = {
	'cc-cedict': 'CC-CEDICT',
	'chinese-notes': 'Chinese Notes',
	wiktionary: 'Wiktionary',
};

const PART_OF_SPEECH_LABELS: Record<PartOfSpeech, string> = {
	adjective: 'Adjective',
	adverb: 'Adverb',
	'auxiliary-verb': 'Auxiliary Verb',
	conjunction: 'Conjunction',
	determiner: 'Determiner',
	interjection: 'Interjection',
	'interrogative-pronoun': 'Interrogative Pronoun',
	'measure-word': 'Measure Word',
	noun: 'Noun',
	number: 'Number',
	onomatopoeia: 'Onomatopoeia',
	ordinal: 'Ordinal',
	particle: 'Particle',
	postposition: 'Postposition',
	preposition: 'Preposition',
	pronoun: 'Pronoun',
	'proper-noun': 'Proper Noun',
	quantity: 'Quantity',
	verb: 'Verb',
};

const QUALIFIER_CATEGORY_LABELS: Record<QualifierCategory, string> = {
	domain: 'Domain',
	register: 'Register',
	region: 'Region',
	usage: 'Usage',
	restriction: 'Restriction',
	information: 'Information',
	explanation: 'Explanation',
};

const isDictionarySource = (value: unknown): value is DictionarySource =>
	value === 'cc-cedict' || value === 'chinese-notes' || value === 'wiktionary';

const normalizeSources = (sources: unknown): DictionarySource[] =>
	Array.isArray(sources)
		? sources
				.filter(isDictionarySource)
				.filter(
					(source, sourceIndex, sourceList) => sourceList.indexOf(source) === sourceIndex
				)
		: [];

const isDefinition = (value: unknown): value is Definition =>
	Boolean(value) && typeof value === 'object' && 'gloss' in value;

const getDefinitionValue = (definition: unknown): string => {
	if (typeof definition === 'string') {
		return definition;
	}
	if (!definition || typeof definition !== 'object') {
		return '';
	}

	const gloss = (definition as { gloss?: unknown }).gloss;
	if (typeof gloss === 'string') {
		return gloss;
	}
	if (
		gloss &&
		typeof gloss === 'object' &&
		typeof (gloss as { value?: unknown }).value === 'string'
	) {
		return (gloss as { value: string }).value;
	}
	return '';
};

/** Keep structured definitions intact for dictionary rendering and legacy strings usable. */
export const lexicalDefinitions = (unit: LexicalUnit): DictionaryDefinition[] => {
	const definitions = Array.isArray(unit.english) ? (unit.english as unknown[]) : [];
	return definitions.filter(
		(definition): definition is DictionaryDefinition =>
			typeof definition === 'string' || isDefinition(definition)
	);
};

/** Flatten only fields the existing previews already render. */
export const lexicalGlosses = (unit: LexicalUnit): string[] => {
	return lexicalDefinitions(unit).map(getDefinitionValue);
};

/** Merge POS source attributions in definition order without duplicating a POS or source. */
export const lexicalPartsOfSpeech = (unit: LexicalUnit): Sourced<PartOfSpeech>[] => {
	const merged = new Map<PartOfSpeech, Sourced<PartOfSpeech>>();
	for (const definition of lexicalDefinitions(unit)) {
		if (typeof definition === 'string' || !Array.isArray(definition.parts_of_speech)) {
			continue;
		}
		for (const sourcedPartOfSpeech of definition.parts_of_speech) {
			if (!sourcedPartOfSpeech || typeof sourcedPartOfSpeech.value !== 'string') {
				continue;
			}
			const partOfSpeech = sourcedPartOfSpeech.value as PartOfSpeech;
			const sources = normalizeSources(sourcedPartOfSpeech.sources);
			const existing = merged.get(partOfSpeech);
			if (existing) {
				for (const source of sources) {
					if (!existing.sources.includes(source)) {
						existing.sources.push(source);
					}
				}
			} else {
				merged.set(partOfSpeech, { value: partOfSpeech, sources });
			}
		}
	}
	return [...merged.values()];
};

/** Flatten valid examples in definition order, retaining examples with only one script. */
export const lexicalExamples = (unit: LexicalUnit): Example[] => {
	const examples: Example[] = [];
	for (const definition of lexicalDefinitions(unit)) {
		if (typeof definition === 'string' || !Array.isArray(definition.examples)) {
			continue;
		}
		for (const sourcedExample of definition.examples) {
			const example = sourcedExample?.value;
			if (!example || typeof example !== 'object') {
				continue;
			}
			const normalizedExample = example as Partial<Example>;
			const simplified =
				typeof normalizedExample.simplified === 'string'
					? normalizedExample.simplified
					: null;
			const traditional =
				typeof normalizedExample.traditional === 'string'
					? normalizedExample.traditional
					: null;
			const english =
				typeof normalizedExample.english === 'string' ? normalizedExample.english : null;
			if (!simplified?.trim() && !traditional?.trim()) {
				continue;
			}
			examples.push({ simplified, traditional, english });
		}
	}
	return examples;
};

/** Read only word-level alternatives; gloss-level alternatives stay attached to their definition. */
export const lexicalAlternativePronunciations = (
	unit: LexicalUnit
): Sourced<AlternativePronunciation>[] => {
	if (!Array.isArray(unit.alternative_pronunciations)) {
		return [];
	}

	return unit.alternative_pronunciations.filter(
		(sourcedAlternative): sourcedAlternative is Sourced<AlternativePronunciation> => {
			const alternative = sourcedAlternative?.value;
			return Boolean(
				alternative &&
				typeof alternative.label === 'string' &&
				alternative.pronunciation &&
				typeof alternative.pronunciation.marks === 'string' &&
				typeof alternative.pronunciation.numbers === 'string' &&
				Array.isArray(alternative.pronunciation.tones)
			);
		}
	);
};

export const formatDictionarySource = (source: DictionarySource): string =>
	DICTIONARY_SOURCE_LABELS[source] ?? source;

export const formatDictionarySources = (
	sources: readonly DictionarySource[]
): string | undefined => {
	const labels = normalizeSources(sources).map(formatDictionarySource);
	if (!labels.length) {
		return undefined;
	}
	return `${labels.length === 1 ? 'Source' : 'Sources'}: ${labels.join(', ')}`;
};

export const formatPartOfSpeech = (partOfSpeech: PartOfSpeech): string =>
	PART_OF_SPEECH_LABELS[partOfSpeech] ??
	partOfSpeech
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');

export const formatQualifierCategory = (category: QualifierCategory): string =>
	QUALIFIER_CATEGORY_LABELS[category] ??
	category
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');

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
