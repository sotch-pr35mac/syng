import type { ToolName } from '@/types/tools.js';

export type TextConversionToolVariant = 'desktop' | 'mobile';

export interface TextConversionControlOption {
	id: string;
	label: string;
	mobileLabel?: string;
	active: boolean;
	onSelect: () => void;
}

export interface TextConversionControlGroup {
	id: string;
	ariaLabel: string;
	visible?: boolean;
	options: TextConversionControlOption[];
}

export interface TextConversionToolConfig {
	name: ToolName;
	label: string;
	inputLabel: string;
	outputLabel: string;
	outputLarge?: boolean;
	getInput: () => string;
	setInput: (text: string) => void;
	process: () => void;
	getOutputText: () => string;
	getDecisionText?: () => string;
	getControlGroups?: () => TextConversionControlGroup[];
}
