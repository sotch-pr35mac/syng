import IncreaseContrastSettings from '@/components/SettingsOption/IncreaseContrastSettings.svelte';
import { BookOpen, Contrast, Settings } from 'lucide-svelte';
import { RELEASES } from '@/utils/whatsNew.js';
import type { ReleaseContent } from '@/types/whatsNew.js';

export const releaseContent: ReleaseContent[] = [
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
