<script lang="ts">
	import { invoke } from '@tauri-apps/api/core';
	import CharacterSetLabel from '@/components/DictionaryContent/CharacterSetLabel.svelte';
	import { dictionaryDisplaySettingsStore } from '@/stores/dictionaryDisplaySettings.svelte.js';
	import { CHARACTER_SETS, type CharacterScript } from '@/types/dictionaryDisplay.js';
	import type { Example, Sourced } from '@/types/dictionary.js';
	import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
	import type { ReaderSegment } from '@/utils/readerPagination.js';
	import { alignReaderTokens, type NativeReaderToken } from '@/utils/readerDocument.js';
	import { createReaderSegments, type ReaderPageBlock } from '@/utils/readerPagination.js';
	import { resolveCharacterForms, type CharacterForm } from '@/utils/dictionaryDisplay.js';

	type DictionaryLinkDetail = {
		text: string;
		anchor?: DOMRect;
	};

	interface Props {
		value: Example | Sourced<Example>;
		onevent?: (detail: DictionaryLinkDetail) => void;
	}

	const { value, onevent }: Props = $props();
	const HAN_CHARACTER = /\p{Script=Han}/u;
	let tokenizedSegments = $state<Partial<Record<CharacterScript, ReaderSegment[]>>>({});
	let tokenizationRequest = 0;

	function readExample(exampleValue: Props['value']): Example {
		const candidateValue: unknown =
			exampleValue && typeof exampleValue === 'object' && 'value' in exampleValue
				? exampleValue.value
				: exampleValue;
		if (!candidateValue || typeof candidateValue !== 'object') {
			return { simplified: null, traditional: null, english: null };
		}
		const candidate = candidateValue as Partial<Example>;
		return {
			simplified: typeof candidate.simplified === 'string' ? candidate.simplified : null,
			traditional: typeof candidate.traditional === 'string' ? candidate.traditional : null,
			english: typeof candidate.english === 'string' ? candidate.english : null,
		};
	}

	const example = $derived(readExample(value));
	const characterForms = $derived(
		resolveCharacterForms(
			example.simplified,
			example.traditional,
			dictionaryDisplaySettingsStore.settings.characterSet
		)
	);

	function createExampleBlock(characters: string, script: CharacterScript): ReaderPageBlock {
		return {
			id: `dictionary-example-${script}`,
			sourceBlockId: `dictionary-example-${script}`,
			kind: 'paragraph',
			text: characters,
			sourceText: characters,
			sourceStart: 0,
			sourceEnd: characters.length,
			start_offset: 0,
			end_offset: characters.length,
			layout_mode: 'flow',
		};
	}

	async function tokenizeForm(form: CharacterForm): Promise<ReaderSegment[]> {
		const tokenTexts = await invoke<Array<string | NativeReaderToken>>(
			NATIVE_COMMANDS.READER.TOKENIZE_TEXT,
			{ text: form.characters }
		);
		if (!Array.isArray(tokenTexts)) {
			throw new Error('Reader tokenizer returned an invalid result.');
		}
		const tokens = alignReaderTokens(
			form.characters,
			tokenTexts,
			`dictionary-example-${form.script}`
		);
		return createReaderSegments(createExampleBlock(form.characters, form.script), tokens);
	}

	$effect(() => {
		const formsToTokenize = characterForms;
		const requestId = ++tokenizationRequest;
		tokenizedSegments = {};

		const loadSegments = async (): Promise<void> => {
			const results = await Promise.all(
				formsToTokenize.map(async (form) => {
					try {
						const segments = await tokenizeForm(form);
						return [form.script, segments] as const;
					} catch {
						// The sentence remains rendered as ordinary text when tokenization is unavailable.
						return undefined;
					}
				})
			);
			if (requestId !== tokenizationRequest) {
				return;
			}
			tokenizedSegments = Object.fromEntries(results.filter(Boolean));
		};

		void loadSegments();
	});

	function isClickableSegment(segment: ReaderSegment): boolean {
		return segment.type === 'token' && HAN_CHARACTER.test(segment.text);
	}

	function handleTokenClick(event: MouseEvent, segment: ReaderSegment): void {
		if (!segment.token) {
			return;
		}
		onevent?.({
			text: segment.token.text,
			anchor:
				event.currentTarget instanceof HTMLElement
					? event.currentTarget.getBoundingClientRect()
					: undefined,
		});
	}

	function renderFormText(form: CharacterForm): ReaderSegment[] {
		return tokenizedSegments[form.script] ?? [{ type: 'text', text: form.characters }];
	}
</script>

<div class="dictionary-content--example-sentence sy-text--selectable">
	{#each characterForms as form (form.script)}
		<div class="dictionary-content--example-sentence__form">
			{#if form.showLabel}
				<CharacterSetLabel script={form.script} />
			{/if}
			<span
				class="dictionary-content--example-sentence__text"
				lang={form.script === CHARACTER_SETS.SIMPLIFIED ? 'zh-Hans' : 'zh-Hant'}
			>
				{#each renderFormText(form) as segment, segmentIndex (segmentIndex)}
					{#if isClickableSegment(segment)}
						<button
							type="button"
							class="dictionary-content--example-sentence__token"
							data-testid="example-dictionary-link"
							onclick={(event) => handleTokenClick(event, segment)}
						>
							{segment.text}
						</button>
					{:else}
						{segment.text}
					{/if}
				{/each}
			</span>
		</div>
	{/each}
	{#if example.english?.trim()}
		<div class="dictionary-content--example-sentence__translation">{example.english}</div>
	{/if}
</div>

<style>
	.dictionary-content--example-sentence {
		padding: var(--sy-space--large);
	}
	.dictionary-content--example-sentence__form {
		display: flex;
		align-items: baseline;
		min-height: 1.5em;
	}
	.dictionary-content--example-sentence__text {
		font-size: var(--sy-font-size--medium);
		line-height: 1.5;
	}
	.dictionary-content--example-sentence__token {
		padding: 0;
		border: 0;
		background: transparent;
		color: var(--sy-color--blue);
		font: inherit;
		cursor: pointer;
	}
	.dictionary-content--example-sentence__token:hover {
		color: var(--sy-color--blue-2);
	}
	.dictionary-content--example-sentence__translation {
		margin-top: var(--sy-space--small);
		color: var(--sy-color--grey-4);
		font-size: var(--sy-font-size--small);
		font-style: italic;
	}
</style>
