<script lang="ts">
	import { onMount } from 'svelte';
	import SyCollapsibleList from '@/components/SyCollapsibleList/SyCollapsibleList.svelte';
	import { invoke } from '@tauri-apps/api/core';
	import { openUrl } from '@tauri-apps/plugin-opener';
	import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
	import { handleError } from '@/utils/error.js';

	interface Acknowledgement {
		id: string;
		name: string;
		license: string;
		text: string;
		url?: string;
	}

	let acknowledgements = $state<Acknowledgement[]>([]);

	onMount(async () => {
		try {
			const results = await invoke<Omit<Acknowledgement, 'id'>[]>(
				NATIVE_COMMANDS.APP.GET_ACKNOWLEDGEMENTS
			);
			acknowledgements = results.map((item) => ({ ...item, id: item.name }));
		} catch (error) {
			handleError('Failed to load acknowledgements.', error);
		}
	});

	function openAttribution(event: MouseEvent, acknowledgement: Acknowledgement): void {
		event.preventDefault();
		if (!acknowledgement.url) {
			return;
		}

		openUrl(acknowledgement.url).catch((error) => {
			handleError('Failed to open acknowledgement attribution.', error);
		});
	}
</script>

<div class="acknowledgements">
	<p class="acknowledgements--intro">
		Syng is free and open-source software, built on the work of others. Each component below is
		used under its own license; the full license texts also ship alongside the application.
	</p>
	<SyCollapsibleList
		items={acknowledgements}
		emptyText="No acknowledgements available."
		itemUrl={(item) => (item.text ? undefined : item.url)}
		onlinkclick={openAttribution}
	>
		{#snippet header(item)}
			<span class="acknowledgements--heading">
				<span class="acknowledgements--name">{item.name}</span>
				<span class="acknowledgements--license">{item.license}</span>
			</span>
		{/snippet}
		{#snippet detail(item)}
			{#if item.url}
				<p class="acknowledgements--source">
					<a href={item.url} onclick={(event) => openAttribution(event, item)}
						>View source</a
					>
				</p>
			{/if}
			<pre class="acknowledgements--text sy-text--selectable">{item.text}</pre>
		{/snippet}
	</SyCollapsibleList>
</div>

<style>
	.acknowledgements {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--extra-large);
		flex: 1;
		overflow-y: auto;
	}

	.acknowledgements--intro {
		margin: 0;
		font-size: var(--sy-font-size--small);
		color: var(--sy-text--dark);
		line-height: 1.5;
	}

	.acknowledgements--heading {
		display: flex;
		flex-direction: column;
		gap: var(--sy-space--small);
		text-align: left;
	}

	.acknowledgements--name {
		font-weight: var(--sy-font-weight--bold);
	}

	.acknowledgements--license {
		font-size: var(--sy-font-size--small);
	}

	.acknowledgements--text {
		margin: 0;
		white-space: pre-wrap;
		word-break: break-word;
		font-size: var(--sy-font-size--small);
		line-height: 1.5;
	}
	.acknowledgements--source {
		margin: 0 0 var(--sy-space--large);
		font-size: var(--sy-font-size--small);
	}
	.acknowledgements--source a {
		color: var(--sy-text--blue);
	}
</style>
