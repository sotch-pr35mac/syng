import {
	segmentsToCharacterText,
	segmentsToPinyinText,
	toolsStore,
} from '@/composables/tools.svelte.js';
import type { ToolName } from '@/types/tools.js';
import type {
	TextConversionControlGroup,
	TextConversionToolConfig,
	TextConversionToolVariant,
} from '@/types/textConversionTool.js';

export const textConversionTabs: { name: ToolName; label: string }[] = [
	{ name: 'pinyinify', label: 'Pinyinify' },
	{ name: 'converter', label: 'Convert' },
	{ name: 'colorize', label: 'Colorize' },
	{ name: 'prettify', label: 'Prettify' },
];

export const textConversionPlaceholders: Record<ToolName, string[]> = {
	pinyinify: ['中文', '你好，今天怎么样？', 'Paste Chinese text to add pinyin.'],
	converter: ['繁體字', '简体字', 'Paste Simplified or Traditional Chinese.'],
	colorize: ['中文', 'ni3 hao3', 'nǐ hǎo', 'Paste characters or pinyin to color by tone.'],
	prettify: ['ni3 hao3', 'nǐ hǎo', 'Paste pinyin with numbers or tone marks.'],
};

export const textConversionToolInfo: Record<ToolName, { title: string; body: string }> = {
	pinyinify: {
		title: 'Pinyinify',
		body: 'Pinyinify segments Chinese text with the dictionary and adds pinyin with tone marks while preserving punctuation, spacing, and non-Chinese text.',
	},
	converter: {
		title: 'Convert',
		body: 'Convert switches Chinese text between Simplified and Traditional. Automatic mode detects the current script and converts to the opposite script.',
	},
	colorize: {
		title: 'Colorize',
		body: 'Colorize applies your tone colors to Chinese characters or pinyin. Automatic mode detects whether the input is characters or pinyin and preserves the original character script.',
	},
	prettify: {
		title: 'Prettify',
		body: 'Prettify switches pinyin between tone-number notation and tone marks. Automatic mode detects the notation in your input and converts to the other style.',
	},
};

export function textConversionHeadingId(
	tool: ToolName,
	variant: TextConversionToolVariant
): string {
	return `${variant === 'mobile' ? 'mobile-' : ''}${tool}-heading`;
}

export function colorizeModeForOutput(): 'characters' | 'pinyin' {
	return (
		toolsStore.colorizeResolvedMode ??
		(toolsStore.colorizeMode === 'pinyin' ? 'pinyin' : 'characters')
	);
}

export function colorizeOutputText(): string {
	if (colorizeModeForOutput() === 'pinyin') {
		return toolsStore.colorizeTokens.length > 0
			? toolsStore.colorizeTokens.map((token) => token.text).join('')
			: segmentsToPinyinText(toolsStore.colorizeResult);
	}
	return segmentsToCharacterText(toolsStore.colorizeResult, toolsStore.colorizeResolvedScript);
}

export const textConversionToolConfigs: Record<ToolName, TextConversionToolConfig> = {
	pinyinify: {
		name: 'pinyinify',
		label: 'Pinyinify',
		inputLabel: 'Pinyinify input',
		outputLabel: 'Pinyinify output',
		getInput: () => toolsStore.pinyinifyInput,
		setInput: toolsStore.setPinyinifyInput,
		process: toolsStore.doPinyinify,
		getOutputText: () => segmentsToPinyinText(toolsStore.pinyinifyResult),
	},
	converter: {
		name: 'converter',
		label: 'Convert',
		inputLabel: 'Converter input',
		outputLabel: 'Converter output',
		getInput: () => toolsStore.converterInput,
		setInput: toolsStore.setConverterInput,
		process: toolsStore.doConvert,
		getOutputText: () => toolsStore.converterResult,
		getDecisionText: () => toolsStore.converterDecision,
		getControlGroups: converterControlGroups,
	},
	colorize: {
		name: 'colorize',
		label: 'Colorize',
		inputLabel: 'Colorize input',
		outputLabel: 'Colorize output',
		outputLarge: true,
		getInput: () => toolsStore.colorizeInput,
		setInput: toolsStore.setColorizeInput,
		process: toolsStore.doColorize,
		getOutputText: colorizeOutputText,
		getDecisionText: () => toolsStore.colorizeDecision,
		getControlGroups: colorizeControlGroups,
	},
	prettify: {
		name: 'prettify',
		label: 'Prettify',
		inputLabel: 'Prettify input',
		outputLabel: 'Prettify output',
		getInput: () => toolsStore.prettifyInput,
		setInput: toolsStore.setPrettifyInput,
		process: toolsStore.doPrettify,
		getOutputText: () => toolsStore.prettifyResult,
		getDecisionText: () => toolsStore.prettifyDecision,
		getControlGroups: prettifyControlGroups,
	},
};

function converterControlGroups(): TextConversionControlGroup[] {
	return [
		{
			id: 'converter-direction',
			ariaLabel: 'Conversion direction',
			options: [
				{
					id: 'automatic',
					label: 'Automatic',
					mobileLabel: 'Auto',
					active: toolsStore.converterDirection === 'automatic',
					onSelect: () => toolsStore.setConverterDirection('automatic'),
				},
				{
					id: 'to-simplified',
					label: 'To Simplified',
					mobileLabel: 'Simplified',
					active: toolsStore.converterDirection === 'to_simplified',
					onSelect: () => toolsStore.setConverterDirection('to_simplified'),
				},
				{
					id: 'to-traditional',
					label: 'To Traditional',
					mobileLabel: 'Traditional',
					active: toolsStore.converterDirection === 'to_traditional',
					onSelect: () => toolsStore.setConverterDirection('to_traditional'),
				},
			],
		},
	];
}

function colorizeControlGroups(): TextConversionControlGroup[] {
	return [
		{
			id: 'colorize-mode',
			ariaLabel: 'Colorize mode',
			options: [
				{
					id: 'automatic',
					label: 'Automatic',
					mobileLabel: 'Auto',
					active: toolsStore.colorizeMode === 'automatic',
					onSelect: () => toolsStore.setColorizeMode('automatic'),
				},
				{
					id: 'characters',
					label: 'Characters',
					active: toolsStore.colorizeMode === 'characters',
					onSelect: () => toolsStore.setColorizeMode('characters'),
				},
				{
					id: 'pinyin',
					label: 'Pinyin',
					mobileLabel: 'Pinyinify',
					active: toolsStore.colorizeMode === 'pinyin',
					onSelect: () => toolsStore.setColorizeMode('pinyin'),
				},
			],
		},
		{
			id: 'colorize-script',
			ariaLabel: 'Character script',
			visible: toolsStore.colorizeMode !== 'pinyin',
			options: [
				{
					id: 'automatic',
					label: 'Automatic',
					mobileLabel: 'Auto',
					active: toolsStore.colorizeScript === 'automatic',
					onSelect: () => toolsStore.setColorizeScript('automatic'),
				},
				{
					id: 'simplified',
					label: 'Simplified',
					active: toolsStore.colorizeScript === 'simplified',
					onSelect: () => toolsStore.setColorizeScript('simplified'),
				},
				{
					id: 'traditional',
					label: 'Traditional',
					active: toolsStore.colorizeScript === 'traditional',
					onSelect: () => toolsStore.setColorizeScript('traditional'),
				},
			],
		},
	];
}

function prettifyControlGroups(): TextConversionControlGroup[] {
	return [
		{
			id: 'prettify-direction',
			ariaLabel: 'Prettify direction',
			options: [
				{
					id: 'automatic',
					label: 'Automatic',
					mobileLabel: 'Auto',
					active: toolsStore.prettifyDirection === 'automatic',
					onSelect: () => toolsStore.setPrettifyDirection('automatic'),
				},
				{
					id: 'to-marks',
					label: 'To Marks',
					mobileLabel: 'Marks',
					active: toolsStore.prettifyDirection === 'to_marks',
					onSelect: () => toolsStore.setPrettifyDirection('to_marks'),
				},
				{
					id: 'to-numbers',
					label: 'To Numbers',
					mobileLabel: 'Numbers',
					active: toolsStore.prettifyDirection === 'to_numbers',
					onSelect: () => toolsStore.setPrettifyDirection('to_numbers'),
				},
			],
		},
	];
}
