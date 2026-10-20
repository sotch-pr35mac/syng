import type { Component } from 'svelte';
import type { Icon } from 'lucide-svelte';

export interface ReleaseRange {
	from: string | null;
	to: string;
	/** First known release when the original upgrade version was unavailable. */
	first?: string;
}

export interface ReleaseHistory {
	lastOpenedVersion: string | null;
	handledThroughVersion: string | null;
	pending: ReleaseRange | null;
}

export interface ReleaseMetadata {
	version: string;
	date: string;
	announce: boolean;
	platforms?: ReleasePlatform[];
}

export type ReleasePlatform = 'desktop' | 'ios' | 'android';

export interface ReleaseHighlight {
	title: string;
	body: string;
	icon?: typeof Icon;
	controlHint?: string;
	platforms?: ReleasePlatform[];
	action?: { label: string; section: string; setting?: string };
	component?: Component<{ variant?: 'desktop' | 'mobile'; source?: 'settings' | 'whats_new' }>;
}

export interface ReleaseContent extends ReleaseMetadata {
	highlights: ReleaseHighlight[];
	improvements: { text: string; platform?: 'ios' }[];
}
