import { invoke } from '@tauri-apps/api/core';
import { handleError } from '@/utils/error.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import type {
	CharacterScript,
	ColorizeMode,
	ConvertCharactersResult,
	ConvertDirection,
	PinyinSegment,
	PrettifyPinyinResult,
	PrettifyDirection,
	ResolvedConvertDirection,
	ResolvedPrettifyDirection,
} from '@/types/tools.js';

let pinyinifyInput = $state('');
let pinyinifyResult = $state<PinyinSegment[]>([]);
let converterInput = $state('');
let converterDirection = $state<ConvertDirection>('automatic');
let converterResult = $state('');
let converterResolvedDirection = $state<ResolvedConvertDirection | null>(null);
let converterDecision = $state('');
let colorizeInput = $state('');
let colorizeMode = $state<ColorizeMode>('automatic');
let colorizeResolvedMode = $state<Exclude<ColorizeMode, 'automatic'> | null>(null);
let colorizeScript = $state<CharacterScript>('automatic');
let colorizeResolvedScript = $state<CharacterScript>('automatic');
let colorizeResult = $state<PinyinSegment[]>([]);
let colorizeRawPinyin = $state('');
let colorizeDecision = $state('');
let prettifyInput = $state('');
let prettifyDirection = $state<PrettifyDirection>('automatic');
let prettifyResult = $state('');
let prettifyResolvedDirection = $state<ResolvedPrettifyDirection | null>(null);
let prettifyDecision = $state('');

function doPinyinify(): void {
	if (!pinyinifyInput) {
		pinyinifyResult = [];
		return;
	}

	invoke<PinyinSegment[]>(NATIVE_COMMANDS.TOOLS.PINYINIFY, { text: pinyinifyInput })
		.then((result) => {
			pinyinifyResult = result;
			return undefined;
		})
		.catch((error) => handleError('Pinyinify failed.', error));
}

function doConvert(): void {
	if (!converterInput) {
		converterResult = '';
		converterResolvedDirection = null;
		converterDecision = '';
		return;
	}

	invoke<ConvertCharactersResult>(NATIVE_COMMANDS.TOOLS.CONVERT_CHARACTERS, {
		text: converterInput,
		direction: converterDirection,
	})
		.then((result) => {
			converterResult = result.text;
			converterResolvedDirection = result.direction;
			converterDecision =
				converterDirection === 'automatic'
					? `Automatic: ${describeScript(result.detected_script)} -> ${describeConvertDirection(
							result.direction
						)}`
					: '';
			return undefined;
		})
		.catch((error) => handleError('Character conversion failed.', error));
}

function doColorize(): void {
	if (!colorizeInput) {
		colorizeResult = [];
		colorizeRawPinyin = '';
		colorizeResolvedMode = null;
		colorizeResolvedScript = 'automatic';
		colorizeDecision = '';
		return;
	}

	const resolvedMode =
		colorizeMode === 'automatic' ? (containsCjk(colorizeInput) ? 'characters' : 'pinyin') : colorizeMode;
	colorizeResolvedMode = resolvedMode;
	colorizeResolvedScript =
		resolvedMode === 'characters' ? colorizeScript : 'automatic';
	colorizeDecision =
		colorizeMode === 'automatic' || (resolvedMode === 'characters' && colorizeScript === 'automatic')
			? `Automatic: ${
					resolvedMode === 'characters'
						? `Chinese characters, ${
								colorizeScript === 'automatic' ? 'original script' : describeCharacterScript(colorizeScript)
							}`
						: 'pinyin'
				}`
			: '';

	if (resolvedMode === 'pinyin' && !containsCjk(colorizeInput)) {
		colorizeResult = [];
		colorizeRawPinyin = colorizeInput;
		return;
	}

	colorizeRawPinyin = '';
	invoke<PinyinSegment[]>(NATIVE_COMMANDS.TOOLS.PINYINIFY, { text: colorizeInput })
		.then((result) => {
			colorizeResult = result;
			return undefined;
		})
		.catch((error) => handleError('Colorize failed.', error));
}

function doPrettify(): void {
	if (!prettifyInput) {
		prettifyResult = '';
		prettifyResolvedDirection = null;
		prettifyDecision = '';
		return;
	}

	invoke<PrettifyPinyinResult>(NATIVE_COMMANDS.TOOLS.PRETTIFY_PINYIN, {
		text: prettifyInput,
		direction: prettifyDirection,
	})
		.then((result) => {
			prettifyResult = result.text;
			prettifyResolvedDirection = result.direction;
			prettifyDecision =
				prettifyDirection === 'automatic'
					? `Automatic: ${describePinyinStyle(result.detected_style)} -> ${describePrettifyDirection(
							result.direction
						)}`
					: '';
			return undefined;
		})
		.catch((error) => handleError('Pinyin prettify failed.', error));
}

export function segmentsToPinyinText(segments: PinyinSegment[]): string {
	return segments
		.map((segment, index) => {
			if (!segment.word_data) {
				return segment.source;
			}

			return `${index > 0 && segments[index - 1].word_data ? ' ' : ''}${segment.word_data.pinyin_marks}`;
		})
		.join('');
}

export function segmentsToCharacterText(
	segments: PinyinSegment[],
	script: CharacterScript
): string {
	return segments
		.map((segment) => {
			if (!segment.word_data) {
				return segment.source;
			}
			if (script === 'automatic') {
				return segment.source;
			}
			return script === 'simplified' ? segment.word_data.simplified : segment.word_data.traditional;
		})
		.join('');
}

function containsCjk(text: string): boolean {
	return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/u.test(text);
}

function describeScript(script: ConvertCharactersResult['detected_script']): string {
	if (script === 'traditional') {
		return 'Traditional';
	}
	if (script === 'simplified') {
		return 'Simplified';
	}
	return 'Unknown script';
}

function describeCharacterScript(script: CharacterScript): string {
	if (script === 'traditional') {
		return 'traditional';
	}
	if (script === 'simplified') {
		return 'simplified';
	}
	return 'original script';
}

function describeConvertDirection(direction: ResolvedConvertDirection): string {
	return direction === 'to_simplified' ? 'Simplified' : 'Traditional';
}

function describePinyinStyle(style: PrettifyPinyinResult['detected_style']): string {
	if (style === 'marks') {
		return 'tone marks';
	}
	if (style === 'numbers') {
		return 'tone numbers';
	}
	return 'unknown style';
}

function describePrettifyDirection(direction: ResolvedPrettifyDirection): string {
	return direction === 'to_marks' ? 'tone marks' : 'tone numbers';
}

export const toolsStore = {
	get pinyinifyInput(): string {
		return pinyinifyInput;
	},
	get pinyinifyResult(): PinyinSegment[] {
		return pinyinifyResult;
	},
	get converterInput(): string {
		return converterInput;
	},
	get converterDirection(): ConvertDirection {
		return converterDirection;
	},
	get converterResult(): string {
		return converterResult;
	},
	get converterDecision(): string {
		return converterDecision;
	},
	get converterResolvedDirection(): ResolvedConvertDirection | null {
		return converterResolvedDirection;
	},
	get colorizeInput(): string {
		return colorizeInput;
	},
	get colorizeMode(): ColorizeMode {
		return colorizeMode;
	},
	get colorizeResolvedMode(): Exclude<ColorizeMode, 'automatic'> | null {
		return colorizeResolvedMode;
	},
	get colorizeScript(): CharacterScript {
		return colorizeScript;
	},
	get colorizeResolvedScript(): CharacterScript {
		return colorizeResolvedScript;
	},
	get colorizeResult(): PinyinSegment[] {
		return colorizeResult;
	},
	get colorizeRawPinyin(): string {
		return colorizeRawPinyin;
	},
	get colorizeDecision(): string {
		return colorizeDecision;
	},
	get prettifyInput(): string {
		return prettifyInput;
	},
	get prettifyDirection(): PrettifyDirection {
		return prettifyDirection;
	},
	get prettifyResult(): string {
		return prettifyResult;
	},
	get prettifyDecision(): string {
		return prettifyDecision;
	},
	get prettifyResolvedDirection(): ResolvedPrettifyDirection | null {
		return prettifyResolvedDirection;
	},
	setPinyinifyInput(text: string): void {
		pinyinifyInput = text;
	},
	setConverterInput(text: string): void {
		converterInput = text;
	},
	setConverterDirection(direction: ConvertDirection): void {
		converterDirection = direction;
	},
	setColorizeInput(text: string): void {
		colorizeInput = text;
	},
	setColorizeMode(mode: ColorizeMode): void {
		colorizeMode = mode;
	},
	setColorizeScript(script: CharacterScript): void {
		colorizeScript = script;
	},
	setPrettifyInput(text: string): void {
		prettifyInput = text;
	},
	setPrettifyDirection(direction: PrettifyDirection): void {
		prettifyDirection = direction;
	},
	doPinyinify,
	doConvert,
	doColorize,
	doPrettify,
};

export function resetToolsStoreForTest(): void {
	pinyinifyInput = '';
	pinyinifyResult = [];
	converterInput = '';
	converterDirection = 'automatic';
	converterResult = '';
	converterResolvedDirection = null;
	converterDecision = '';
	colorizeInput = '';
	colorizeMode = 'automatic';
	colorizeResolvedMode = null;
	colorizeScript = 'automatic';
	colorizeResolvedScript = 'automatic';
	colorizeResult = [];
	colorizeRawPinyin = '';
	colorizeDecision = '';
	prettifyInput = '';
	prettifyDirection = 'automatic';
	prettifyResult = '';
	prettifyResolvedDirection = null;
	prettifyDecision = '';
}
