<script lang="ts">
	import DictionaryLink from '@/components/DictionaryContent/DictionaryLink.svelte';
	import type {
		ChineseVariety,
		MeasureWordReference,
		Sourced,
	} from '@/types/dictionary.js';

	type DictionaryLinkDetail = {
		text: string;
		lexicalId?: string;
		anchor?: DOMRect;
	};

	type LegacyMeasureWordReference = Pick<MeasureWordReference, 'traditional' | 'simplified'> &
		Partial<Pick<MeasureWordReference, 'lexical_id' | 'varieties'>>;

	interface Props {
		value: Sourced<MeasureWordReference> | LegacyMeasureWordReference;
		onevent?: (detail: DictionaryLinkDetail) => void;
	}

	const { value, onevent }: Props = $props();

	const VARIETY_LABELS: Partial<Record<ChineseVariety, string>> = {
		mandarin: 'Mandarin',
		cantonese: 'Cantonese',
		taishanese: 'Taishanese',
		sichuanese: 'Sichuanese',
		dungan: 'Dungan',
		gan: 'Gan',
		hakka: 'Hakka',
		jin: 'Jin',
		'northern-min': 'Northern Min',
		'middle-chinese': 'Middle Chinese',
		'eastern-min': 'Eastern Min',
		hokkien: 'Hokkien',
		teochew: 'Teochew',
		'leizhou-min': 'Leizhou Min',
		'puxian-min': 'Puxian Min',
		'southern-pinghua': 'Southern Pinghua',
		wu: 'Wu',
		xiang: 'Xiang',
		'loudi-xiang': 'Loudi Xiang',
		'hengyang-xiang': 'Hengyang Xiang',
		'old-chinese': 'Old Chinese',
	};

	function formatVariety(variety: string): string {
		return (
			VARIETY_LABELS[variety as ChineseVariety] ??
			variety
				.split('-')
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(' ')
		);
	}

	function isSourcedMeasureWord(
		measureWord: Props['value']
	): measureWord is Sourced<MeasureWordReference> {
		return 'value' in measureWord && typeof measureWord.value === 'object';
	}

	const measureWord = $derived(
		isSourcedMeasureWord(value) ? value.value : value
	);
	const varieties = $derived(
		(measureWord.varieties ?? []).map(formatVariety).filter(Boolean)
	);

	function handleOpenLink(event: { detail: DictionaryLinkDetail }): void {
		onevent?.(event.detail);
	}
</script>

<div class="dictionary-content--mw sy-text--selectable">
	<DictionaryLink
		link={measureWord.traditional}
		simplified={measureWord.simplified}
		traditional={measureWord.traditional}
		lexicalId={measureWord.lexical_id ?? undefined}
		onopen={handleOpenLink}
	/>
	{#if varieties.length}
		<span class="dictionary-content--mw__varieties"> · {varieties.join(', ')}</span>
	{/if}
</div>

<style>
	.dictionary-content--mw {
		padding: var(--sy-space--large);
	}
</style>
