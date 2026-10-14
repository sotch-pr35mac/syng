<script lang="ts">
	import { ChevronDown } from 'lucide-svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyDropdown from '@/components/SyDropdown/SyDropdown.svelte';
	import StudyDropdownItem from '@/components/StudyListItem/StudyDropdownItem.svelte';
	import {
		getStudyEligibility,
		studyHref,
		type StudyAction,
		type StudyContentStatus,
	} from '@/composables/study.js';
	import {
		DROPDOWN_DIRECTIONS,
		DROPDOWN_POSITIONS,
		type DropdownDirection,
	} from '@/types/dropdown.js';

	const {
		list,
		wordCount,
		status,
		mobile = false,
		direction = DROPDOWN_DIRECTIONS.DOWN,
	} = $props<{
		list: string;
		wordCount: number;
		status: StudyContentStatus;
		mobile?: boolean;
		direction?: DropdownDirection;
	}>();
	const eligibility = $derived(getStudyEligibility(wordCount, status));
	const options = $derived([
		{
			id: 'flashcards',
			text: 'Flashcards',
			description: eligibility.flashcards ? '' : eligibility.message,
			disabled: !eligibility.flashcards,
			component: StudyDropdownItem,
		},
		{
			id: 'quiz',
			text: 'Quiz',
			description: eligibility.quiz ? '' : eligibility.message,
			disabled: !eligibility.quiz,
			component: StudyDropdownItem,
		},
	]);
	const MOBILE_ICON_SIZE = 16;
	const DESKTOP_ICON_SIZE = 20;
	const iconSize = $derived(mobile ? MOBILE_ICON_SIZE : DESKTOP_ICON_SIZE);
	function startStudy(action: StudyAction): void {
		if (eligibility[action]) {
			window.location.hash = studyHref(action, list, 'bookmarks');
		}
	}
</script>

<SyDropdown
	values={options}
	onselection={startStudy}
	{direction}
	fixed={mobile}
	position={DROPDOWN_POSITIONS.RIGHT}
>
	<SyButton style="ghost" size={mobile ? 'small' : 'medium'}
		>Study&nbsp;<ChevronDown size={iconSize} /></SyButton
	>
</SyDropdown>
