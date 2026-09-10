export const CHARACTER_SETS = {
	SIMPLIFIED: 'simplified',
	TRADITIONAL: 'traditional',
	BOTH: 'both',
} as const;

export type CharacterSet = (typeof CHARACTER_SETS)[keyof typeof CHARACTER_SETS];
export type CharacterScript = Exclude<CharacterSet, (typeof CHARACTER_SETS)['BOTH']>;

export const CHARACTER_SET_VALUES: readonly CharacterSet[] = Object.values(CHARACTER_SETS);

export const HSK_VARIANTS = {
	HSK_EXAM_SYLLABUS_2025: 'hsk_exam_syllabus_2025',
	HSK_2015: 'hsk_2015',
	PROFICIENCY_STANDARD_2021: 'proficiency_standard_2021',
	NONE: 'none',
} as const;
export type HskVariant = (typeof HSK_VARIANTS)[keyof typeof HSK_VARIANTS];
export const HSK_VARIANT_VALUES: readonly HskVariant[] = Object.values(HSK_VARIANTS);
export const HSK_VARIANT_LABELS: Record<HskVariant, string> = {
	[HSK_VARIANTS.HSK_2015]: 'HSK 2015',
	[HSK_VARIANTS.PROFICIENCY_STANDARD_2021]: 'Proficiency Standard 2021',
	[HSK_VARIANTS.HSK_EXAM_SYLLABUS_2025]: 'HSK Exam Syllabus 2025',
	[HSK_VARIANTS.NONE]: 'None',
};

export interface DictionaryDisplaySettings {
	characterSet: CharacterSet;
	colorCharactersByTone: boolean;
	colorPinyinByTone: boolean;
	colorListsByTone: boolean;
	hskVariant: HskVariant;
}
