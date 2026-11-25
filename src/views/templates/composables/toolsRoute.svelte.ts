import {
	textConversionPlaceholders,
	textConversionToolConfigs,
	textConversionToolInfo,
} from '@/composables/textConversionTools.js';
import { toolsSelectionStore } from '@/stores/tools.svelte.js';
import { handleError } from '@/utils/error.js';
import { telemetry } from '@/utils/telemetry.js';
import type { ToolName, TextConversionToolName } from '@/types/tools.js';
import { toolsStore } from '@/composables/tools.svelte.js';
import type { TextConversionToolConfig } from '@/types/textConversionTool.js';

/** Shared Extras navigation, placeholder, info, collapse, and copy state for both shells. */
export const extrasTools: { name: ToolName; label: string }[] = [
	...Object.values(textConversionToolConfigs).map(({ name, label }) => ({ name, label })),
	{ name: 'frequency', label: 'Word Frequency' },
];

const PLACEHOLDER_ROTATION_MS = 2000;

let placeholderIndex = $state(0);
let infoTool = $state<TextConversionToolName | null>(null);
let showCopyToast = $state(false);
let inputCollapsed = $state<Record<TextConversionToolName, boolean>>({
	pinyinify: false,
	converter: false,
	colorize: false,
	prettify: false,
});

function selectTool(tool: ToolName | null): void {
	if (tool && tool !== toolsSelectionStore.value) {
		telemetry.trackEvent('tools.opened', { tool }).catch(() => {});
	}
	toolsSelectionStore.set(tool);
	closeInfo();
	dismissToast();
}

function toggleInput(tool: TextConversionToolName): void {
	inputCollapsed = { ...inputCollapsed, [tool]: !inputCollapsed[tool] };
}

function openInfo(tool: TextConversionToolName): void {
	infoTool = tool;
}

function closeInfo(): void {
	infoTool = null;
}

function dismissToast(): void {
	showCopyToast = false;
}

async function copyText(text: string): Promise<void> {
	const tool = toolsSelectionStore.value;
	try {
		await navigator.clipboard.writeText(text);
		showCopyToast = true;
		if (tool) {
			telemetry.trackEvent('tools.copied', { tool }).catch(() => {});
		}
	} catch (error) {
		handleError('Copy failed.', error);
	}
}

function getActiveTool(): TextConversionToolConfig | null {
	const selected = toolsSelectionStore.value;
	return selected && selected !== 'frequency' ? textConversionToolConfigs[selected] : null;
}

function getActiveInfo(): { title: string; body: string } | null {
	return infoTool ? textConversionToolInfo[infoTool] : null;
}

function getActivePlaceholder(): string {
	if (!toolsSelectionStore.value || toolsSelectionStore.value === 'frequency') {
		return '';
	}
	const placeholders = textConversionPlaceholders[toolsSelectionStore.value];
	return placeholders[placeholderIndex % placeholders.length];
}

/**
 * Rotates the placeholder while a conversion panel is mounted. Return the teardown
 * from the view's effect so the ticker stops on the toolbox and when leaving Extras.
 */
function startPlaceholderRotation(): () => void {
	const interval = window.setInterval(() => {
		placeholderIndex += 1;
	}, PLACEHOLDER_ROTATION_MS);
	return () => window.clearInterval(interval);
}

export const toolsRoute = {
	get operationState(): { busy: boolean; status: string } {
		const tool = getActiveTool();
		return tool ? toolsStore.operationState(tool.name) : { busy: false, status: '' };
	},
	get selectedTool(): ToolName | null {
		return toolsSelectionStore.value;
	},
	get activeTool(): TextConversionToolConfig | null {
		return getActiveTool();
	},
	get activeInfo(): { title: string; body: string } | null {
		return getActiveInfo();
	},
	get activePlaceholder(): string {
		return getActivePlaceholder();
	},
	get infoTool(): TextConversionToolName | null {
		return infoTool;
	},
	get showCopyToast(): boolean {
		return showCopyToast;
	},
	isInputCollapsed(tool: TextConversionToolName): boolean {
		return inputCollapsed[tool];
	},
	selectTool,
	toggleInput,
	openInfo,
	closeInfo,
	dismissToast,
	copyText,
	startPlaceholderRotation,
};
