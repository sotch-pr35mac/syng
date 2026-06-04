import {
	textConversionPlaceholders,
	textConversionToolConfigs,
	textConversionToolInfo,
} from '@/composables/textConversionTools.js';
import { toolsActiveTabStore } from '@/stores/tools.svelte.js';
import { handleError } from '@/utils/error.js';
import type { ToolName } from '@/types/tools.js';
import type { TextConversionToolConfig } from '@/types/textConversionTool.js';

/**
 * Shared, app-lifetime controller for the Extras route. Both the desktop
 * (`Tools.svelte`) and mobile (`MobileTools.svelte`) shells consume this so the
 * tab/placeholder/info/collapse/toast logic lives in exactly one place; the
 * routes only own their platform chrome. `activeTab` is backed by
 * `toolsActiveTabStore` so it persists across navigation and platforms.
 */
const PLACEHOLDER_ROTATION_MS = 2000;

let placeholderIndex = $state(0);
let infoTool = $state<ToolName | null>(null);
let showCopyToast = $state(false);
let inputCollapsed = $state<Record<ToolName, boolean>>({
	pinyinify: false,
	converter: false,
	colorize: false,
	prettify: false,
});

function setActiveTab(tab: ToolName): void {
	toolsActiveTabStore.set(tab);
}

function toggleInput(tool: ToolName): void {
	inputCollapsed = { ...inputCollapsed, [tool]: !inputCollapsed[tool] };
}

function openInfo(tool: ToolName): void {
	infoTool = tool;
}

function closeInfo(): void {
	infoTool = null;
}

function dismissToast(): void {
	showCopyToast = false;
}

async function copyText(text: string): Promise<void> {
	try {
		await navigator.clipboard.writeText(text);
		showCopyToast = true;
	} catch (error) {
		handleError('Copy failed.', error);
	}
}

function getActiveTool(): TextConversionToolConfig {
	return textConversionToolConfigs[toolsActiveTabStore.value];
}

function getActiveInfo(): { title: string; body: string } | null {
	return infoTool ? textConversionToolInfo[infoTool] : null;
}

function getActivePlaceholder(): string {
	const placeholders = textConversionPlaceholders[toolsActiveTabStore.value];
	return placeholders[placeholderIndex % placeholders.length];
}

/**
 * Rotates the input placeholder while the route is mounted. Call from the route's
 * `onMount` and return the teardown so the ticker never runs while the route is hidden.
 */
function startPlaceholderRotation(): () => void {
	const interval = window.setInterval(() => {
		placeholderIndex += 1;
	}, PLACEHOLDER_ROTATION_MS);
	return () => window.clearInterval(interval);
}

export const toolsRoute = {
	get activeTab(): ToolName {
		return toolsActiveTabStore.value;
	},
	get activeTool(): TextConversionToolConfig {
		return getActiveTool();
	},
	get activeInfo(): { title: string; body: string } | null {
		return getActiveInfo();
	},
	get activePlaceholder(): string {
		return getActivePlaceholder();
	},
	get infoTool(): ToolName | null {
		return infoTool;
	},
	get showCopyToast(): boolean {
		return showCopyToast;
	},
	isInputCollapsed(tool: ToolName): boolean {
		return inputCollapsed[tool];
	},
	setActiveTab,
	toggleInput,
	openInfo,
	closeInfo,
	dismissToast,
	copyText,
	startPlaceholderRotation,
};
