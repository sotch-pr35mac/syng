export const HSK_LEVELS = {
	ONE: 'One',
	TWO: 'Two',
	THREE: 'Three',
	FOUR: 'Four',
	FIVE: 'Five',
	SIX: 'Six',
	SEVEN_TO_NINE: 'SevenToNine',
} as const;
export type HskLevel = (typeof HSK_LEVELS)[keyof typeof HSK_LEVELS];
export type HskLevels = {
	hsk_2015?: HskLevel[];
	proficiency_standard_2021?: HskLevel[];
	hsk_exam_syllabus_2025?: HskLevel[];
};
