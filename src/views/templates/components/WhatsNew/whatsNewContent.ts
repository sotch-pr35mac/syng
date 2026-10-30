import IncreaseContrastSettings from '@/components/SettingsOption/IncreaseContrastSettings.svelte';
import { Blocks, BookOpen, Contrast, Languages, Settings } from 'lucide-svelte';
import { RELEASES } from '@/utils/whatsNew.js';
import type { ReleaseContent } from '@/types/whatsNew.js';

export const releaseContent: ReleaseContent[] = [
	{
		...RELEASES.find((release) => release.version === '2.7.0')!,
		highlights: [
			{
				title: 'Character breakdowns',
				body: 'Open Character Breakdown from any dictionary entry to explore how each character is formed, inspect its components and radical, and look up related characters.',
				credit: 'Thanks to an anonymous Syng user for suggesting this feature.',
				icon: Blocks,
			},
			{
				title: 'Pinyin where you want it',
				body: 'Choose whether to show pinyin in Reader, on flashcard fronts, and beneath character animations, with your tone colors applied throughout.',
				credit: 'Thanks to Daniel for suggesting these additional pinyin options.',
				icon: Languages,
			},
		],
		feedback: {
			prompt: 'Is there a feature you wish Syng had?',
			email: 'hello@bytecraft.xyz',
			outcome: 'and it might make it into a future release.',
			subject: 'Syng feature request',
		},
		improvements: [
			{
				text: 'Fixed incorrect alternative pronunciations appearing in some dictionary entries.',
			},
			{
				text: 'Fixed unexpected navigation scrollbars and misplaced tooltips.',
			},
			{
				text: 'Improved dictionary entry layouts so actions, metadata, and long pronunciation text remain readable in narrow windows and with larger text.',
			},
			{
				text: 'Fixed quiz feedback rendering artifacts on Android.',
			},
			{
				text: 'Fixed the background behind Android status and navigation safe areas in dark mode.',
			},
		],
	},
	{
		...RELEASES.find((release) => release.version === '2.6.0')!,
		highlights: [
			{
				title: 'Guided walkthroughs',
				body: 'Explore Syng at your own pace with optional feature tours, available in Settings.',
				icon: BookOpen,
			},
			{
				title: 'Easier to read',
				body: 'Make text and controls easier to distinguish.',
				icon: Contrast,
				component: IncreaseContrastSettings,
				controlHint: 'Changes apply immediately and are saved.',
			},
			{
				title: 'Organized settings',
				body: 'Find what you need in Help & Maintenance, Chinese & Dictionary, and Appearance.',
				icon: Settings,
			},
		],
		improvements: [
			{
				text: 'Syng follows iOS Dynamic Type, including changes to system text size while the app is open.',
				platform: 'ios',
			},
			{
				text: 'Improved keyboard navigation, focus indicators, screen-reader labels, and layouts for larger text and narrow windows.',
			},
			{
				text: 'Introducing Awa, our new mascot.',
			},
			{
				text: 'Improved empty states with clearer next steps in Search, Bookmarks, Reader, and Study.',
			},
			{
				text: 'Start flashcards and quizzes directly from bookmark lists. Flashcards show the active list, card position, and last-card status.',
			},
			{
				text: 'Reader import forms keep your entries after failed imports. List creation gives clearer validation and selects newly created lists.',
			},
			{
				text: 'Flashcards and quizzes refresh when you change lists. Study counts update when vocabulary changes, and leaving study restores the originating bookmark list.',
			},
		],
	},
];
