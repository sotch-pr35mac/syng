import type { WordFrequencyResult, WordFrequencyEntry } from '@/types/tools.js';
import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
import { HSK_VARIANTS, type HskVariant } from '@/types/dictionaryDisplay.js';
import { resolveHskLevels } from '@/utils/hsk.js';
import { invoke } from '@tauri-apps/api/core';
import { handleError } from '@/utils/error.js';
import { telemetry } from '@/utils/telemetry.js';
import { lexicalPinyin, lexicalUnitFromToolSegment } from '@/types/dictionary.js';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import type {
	ToolName,
	TextConversionToolName,
	CharacterScript,
	ColorizeMode,
	ConvertCharactersResult,
	ConvertDirection,
	PinyinSegment,
	PinyinToken,
	PrettifyPinyinResult,
	PrettifyDirection,
	ResolvedConvertDirection,
	ResolvedPrettifyDirection,
} from '@/types/tools.js';

const toolRequestIds: Record<TextConversionToolName, number> = {
	pinyinify: 0,
	converter: 0,
	colorize: 0,
	prettify: 0,
};
const operationStates = $state<Record<TextConversionToolName, { busy: boolean; status: string }>>({
	pinyinify: { busy: false, status: '' },
	converter: { busy: false, status: '' },
	colorize: { busy: false, status: '' },
	prettify: { busy: false, status: '' },
});

function beginOperation(tool: TextConversionToolName, input: string): number {
	toolRequestIds[tool] += 1;
	operationStates[tool] = { busy: Boolean(input), status: input ? 'Processing…' : '' };
	return toolRequestIds[tool];
}

function finishOperation(tool: TextConversionToolName, requestId: number, failed = false): void {
	if (requestId === toolRequestIds[tool]) {
		operationStates[tool] = {
			busy: false,
			status: failed ? 'Processing failed.' : 'Output ready.',
		};
	}
}

/** Only static tool/mode identifiers and length leave the device, never pasted text. */
function trackToolCompletion(tool: ToolName, mode: string, input: string): void {
	void telemetry
		.trackEvent('tools.completed', {
			tool,
			mode,
			input_length: Array.from(input.trim()).length,
		})
		.catch(() => {});
}

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
let colorizeTokens = $state<PinyinToken[]>([]);
let colorizeDecision = $state('');
let prettifyInput = $state('');
let prettifyDirection = $state<PrettifyDirection>('automatic');
let prettifyResult = $state('');
let prettifyResolvedDirection = $state<ResolvedPrettifyDirection | null>(null);
let prettifyDecision = $state('');

function doPinyinify(): void {
	const requestId = beginOperation('pinyinify', pinyinifyInput);
	if (!pinyinifyInput) {
		pinyinifyResult = [];
		return;
	}

	const input = pinyinifyInput;
	invoke<PinyinSegment[]>(NATIVE_COMMANDS.TOOLS.PINYINIFY, { text: input })
		.then((result) => {
			if (requestId !== toolRequestIds.pinyinify) {
				return undefined;
			}
			pinyinifyResult = result;
			finishOperation('pinyinify', requestId);
			trackToolCompletion('pinyinify', 'automatic', input);
			return undefined;
		})
		.catch((error) => {
			finishOperation('pinyinify', requestId, true);
			handleError('Pinyinify failed.', error);
		});
}

function doConvert(): void {
	const requestId = beginOperation('converter', converterInput);
	if (!converterInput) {
		converterResult = '';
		converterResolvedDirection = null;
		converterDecision = '';
		return;
	}

	const input = converterInput;
	const direction = converterDirection;
	invoke<ConvertCharactersResult>(NATIVE_COMMANDS.TOOLS.CONVERT_CHARACTERS, {
		text: input,
		direction,
	})
		.then((result) => {
			if (requestId !== toolRequestIds.converter) {
				return undefined;
			}
			converterResult = result.text;
			finishOperation('converter', requestId);
			trackToolCompletion('converter', direction, input);
			converterResolvedDirection = result.direction;
			converterDecision =
				converterDirection === 'automatic'
					? `Automatic: ${describeScript(result.detected_script)} -> ${describeConvertDirection(
							result.direction
						)}`
					: '';
			return undefined;
		})
		.catch((error) => {
			finishOperation('converter', requestId, true);
			handleError('Character conversion failed.', error);
		});
}

function doColorize(): void {
	const requestId = beginOperation('colorize', colorizeInput);
	if (!colorizeInput) {
		colorizeResult = [];
		colorizeTokens = [];
		colorizeResolvedMode = null;
		colorizeResolvedScript = 'automatic';
		colorizeDecision = '';
		return;
	}

	const input = colorizeInput;
	const mode = colorizeMode;
	const script = colorizeScript;
	const trackCompletion = () => {
		finishOperation('colorize', requestId);
		trackToolCompletion('colorize', `${mode}:${script}`, input);
	};
	// Segment first; whether any token resolved to a dictionary word tells us if the
	// input is Chinese characters (color the characters) or free-form pinyin (color
	// the syllables) — no separate front-end CJK detector needed.
	invoke<PinyinSegment[]>(NATIVE_COMMANDS.TOOLS.PINYINIFY, { text: input })
		.then((segments) => {
			if (requestId !== toolRequestIds.colorize) {
				return undefined;
			}
			const hasChinese = segments.some(
				(segment) => lexicalUnitFromToolSegment(segment) !== null
			);
			const resolvedMode =
				mode === 'automatic' ? (hasChinese ? 'characters' : 'pinyin') : mode;
			colorizeResolvedMode = resolvedMode;
			colorizeResolvedScript = resolvedMode === 'characters' ? script : 'automatic';
			colorizeDecision = describeColorizeDecision(resolvedMode);
			colorizeResult = segments;

			// Free-form pinyin (no dictionary words): tokenize natively so each syllable
			// is colored by its tone.
			if (resolvedMode === 'pinyin' && !hasChinese) {
				return invoke<PinyinToken[]>(NATIVE_COMMANDS.TOOLS.TOKENIZE_PINYIN, {
					text: input,
				}).then((tokens) => {
					if (requestId !== toolRequestIds.colorize) {
						return undefined;
					}
					colorizeTokens = tokens;
					void trackCompletion();
					return undefined;
				});
			}

			colorizeTokens = [];
			void trackCompletion();
			return undefined;
		})
		.catch((error) => {
			finishOperation('colorize', requestId, true);
			handleError('Colorize failed.', error);
		});
}

function describeColorizeDecision(resolvedMode: Exclude<ColorizeMode, 'automatic'>): string {
	const shouldDescribe =
		colorizeMode === 'automatic' ||
		(resolvedMode === 'characters' && colorizeScript === 'automatic');
	if (!shouldDescribe) {
		return '';
	}
	if (resolvedMode !== 'characters') {
		return 'Automatic: pinyin';
	}
	const script =
		colorizeScript === 'automatic'
			? 'original script'
			: describeCharacterScript(colorizeScript);
	return `Automatic: Chinese characters, ${script}`;
}

function doPrettify(): void {
	const requestId = beginOperation('prettify', prettifyInput);
	if (!prettifyInput) {
		prettifyResult = '';
		prettifyResolvedDirection = null;
		prettifyDecision = '';
		return;
	}

	const input = prettifyInput;
	const direction = prettifyDirection;
	invoke<PrettifyPinyinResult>(NATIVE_COMMANDS.TOOLS.PRETTIFY_PINYIN, {
		text: input,
		direction,
	})
		.then((result) => {
			if (requestId !== toolRequestIds.prettify) {
				return undefined;
			}
			prettifyResult = result.text;
			finishOperation('prettify', requestId);
			trackToolCompletion('prettify', direction, input);
			prettifyResolvedDirection = result.direction;
			prettifyDecision =
				prettifyDirection === 'automatic'
					? `Automatic: ${describePinyinStyle(result.detected_style)} -> ${describePrettifyDirection(
							result.direction
						)}`
					: '';
			return undefined;
		})
		.catch((error) => {
			finishOperation('prettify', requestId, true);
			handleError('Pinyin prettify failed.', error);
		});
}

export function segmentsToPinyinText(segments: PinyinSegment[]): string {
	return segments
		.map((segment, index) => {
			const lexicalUnit = lexicalUnitFromToolSegment(segment);
			if (!lexicalUnit) {
				return segment.source;
			}

			return `${index > 0 && lexicalUnitFromToolSegment(segments[index - 1]) ? ' ' : ''}${lexicalPinyin(lexicalUnit).marks}`;
		})
		.join('');
}

export function segmentsToCharacterText(
	segments: PinyinSegment[],
	script: CharacterScript
): string {
	return segments
		.map((segment) => {
			const lexicalUnit = lexicalUnitFromToolSegment(segment);
			if (!lexicalUnit) {
				return segment.source;
			}
			if (script === 'automatic') {
				return segment.source;
			}
			return script === 'simplified' ? lexicalUnit.simplified : lexicalUnit.traditional;
		})
		.join('');
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
	operationState(tool: TextConversionToolName): { busy: boolean; status: string } {
		return operationStates[tool];
	},
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
	get colorizeTokens(): PinyinToken[] {
		return colorizeTokens;
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
	for (const tool of Object.keys(operationStates) as TextConversionToolName[]) {
		toolRequestIds[tool] += 1;
		operationStates[tool] = { busy: false, status: '' };
	}
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
	colorizeTokens = [];
	colorizeDecision = '';
	prettifyInput = '';
	prettifyDirection = 'automatic';
	prettifyResult = '';
	prettifyResolvedDirection = null;
	prettifyDecision = '';
}

// Frequency results retain only dictionary metadata; full definitions load on demand.

export const commonFrequencyWords: readonly string[] =
	'的 地 得 了 着 著 过 過 是 在 和 与 與 也 都 就 吗 嗎 呢 吧 啊'.split(' ');
const frequencyState = $state({
	input: '',
	analyzedInput: '',
	result: null as WordFrequencyResult | null,
	busy: false,
	error: '',
	collapsed: false,
	hideCommon: false,
	visibleRows: 50,
	hskVariant: null as HskVariant | null,
});
let frequencyRequest = 0;

export function frequencyLevels(entry: WordFrequencyEntry, variant: HskVariant): string[] {
	const memberships = resolveHskLevels(entry.hsk, variant);
	return ['1', '2', '3', '4', '5', '6', '7–9'].filter((level) => memberships.includes(level));
}
export function frequencyBreakdown(entries: WordFrequencyEntry[], variant: HskVariant) {
	const labels =
		variant === HSK_VARIANTS.HSK_2015
			? ['1', '2', '3', '4', '5', '6']
			: ['1', '2', '3', '4', '5', '6', '7–9'];
	return [...labels, 'Not listed'].map((level) => {
		const words = entries.filter(
			(entry) => (frequencyLevels(entry, variant)[0] ?? 'Not listed') === level
		);
		return {
			level,
			distinct: words.length,
			occurrences: words.reduce((total, entry) => total + entry.count, 0),
		};
	});
}
export const frequencyTool = {
	state: frequencyState,
	initialize() {
		frequencyState.hskVariant ??= dictionaryDisplaySettingsStore.settings.hskVariant;
	},
	setInput(value: string) {
		frequencyRequest += 1;
		frequencyState.input = value;
		frequencyState.busy = false;
		frequencyState.error = '';
	},
	async analyze() {
		const request = ++frequencyRequest;
		const input = frequencyState.input;
		frequencyState.error = '';
		if (!input.trim()) {
			frequencyState.result = null;
			frequencyState.busy = false;
			return;
		}
		frequencyState.busy = true;
		try {
			const result = await invoke<WordFrequencyResult>(
				NATIVE_COMMANDS.TOOLS.ANALYZE_WORD_FREQUENCY,
				{ text: input }
			);
			if (request !== frequencyRequest) {
				return;
			}
			frequencyState.result = result;
			frequencyState.analyzedInput = input;
			frequencyState.visibleRows = 50;
			trackToolCompletion('frequency', 'automatic', input);
		} catch {
			if (request === frequencyRequest) {
				frequencyState.error = 'Analysis failed. Please try again.';
			}
		} finally {
			if (request === frequencyRequest) {
				frequencyState.busy = false;
			}
		}
	},
};
