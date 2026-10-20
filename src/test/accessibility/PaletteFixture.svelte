<script lang="ts">
	import Navigation from '@/components/Navigation/Navigation.svelte';
	import MobileNavigation from '@/components/Navigation/MobileNavigation.svelte';
	import IncreaseContrastSettings from '@/components/SettingsOption/IncreaseContrastSettings.svelte';
	import SyTextInput from '@/components/SyTextInput/SyTextInput.svelte';
	import SyButton from '@/components/SyButton/SyButton.svelte';
	import SyToggle from '@/components/SyToggle/SyToggle.svelte';
	import SyListPreview from '@/components/SyList/SyListPreview.svelte';
	import ChineseCharacters from '@/components/DictionaryContent/ChineseCharacters.svelte';
	import { setPreferenceManagerForTest } from '@/utils/appServices.js';
	import { contrastStore } from '@/stores/contrast.svelte.js';

	const mobile = new URLSearchParams(location.search).has('mobile');
	const preferenceKey = 'syng-fixture:increaseContrast';

	setPreferenceManagerForTest({
		waitForInit: async () => undefined,
		get: (key: string) =>
			key === 'increaseContrast' && localStorage.getItem(preferenceKey) === 'true',
		set: (key: string, value: boolean) => {
			if (key === 'increaseContrast') localStorage.setItem(preferenceKey, String(value));
		},
	} as unknown as Parameters<typeof setPreferenceManagerForTest>[0]);
	void contrastStore.loadSettings();
	const words = [
		{ key: 'mother', headline: '妈', subtitle: 'mā', content: 'mother' },
		{ key: 'hemp', headline: '麻', subtitle: 'má', content: 'hemp; numb' },
		{ key: 'horse', headline: '马', subtitle: 'mǎ', content: 'horse' },
	];
</script>

<div class="shell" class:mobile>
	{#if mobile}<MobileNavigation />{:else}<aside><Navigation /></aside>{/if}
	<main>
		<div class="appearance-control" data-testid="appearance-control">
			<IncreaseContrastSettings variant={mobile ? 'mobile' : 'desktop'} />
			<SyToggle accessibleLabel="Comparison toggle" />
		</div>
		<div class="search-bar">
			<SyButton style="ghost">EN</SyButton>
			<SyTextInput
				style="ghost"
				size="large"
				aria-label="Search dictionary"
				placeholder="Search..."
			/>
		</div>
		<div class="content">
			<section class="results" aria-label="Search results">
				<SyListPreview values={words} />
			</section>
			<section class="dictionary" aria-label="Dictionary">
				<h1>Tone colors</h1>
				<p class="characters" lang="zh">
					<ChineseCharacters characters="妈麻马骂吗" tones={[1, 2, 3, 4, 5]} />
				</p>
				<p class="secondary">mā · má · mǎ · mà · ma</p>
				<p>Syng colors, with distinct tones and visible hover feedback.</p>
				<SyButton color="blue">Save word</SyButton>
				<label
					>Standard field<SyTextInput
						aria-label="Standard field"
						value="A bounded input"
					/></label
				>
			</section>
		</div>
	</main>
</div>

<style>
	.shell {
		display: flex;
		height: 100vh;
	}
	.shell.mobile {
		flex-direction: column;
	}
	.appearance-control {
		padding: 1rem;
		background: var(--sy-color--white);
	}
	.mobile .content {
		flex-direction: column;
		overflow: auto;
	}
	.mobile .results {
		width: 100%;
	}
	aside {
		width: 92px;
		flex-shrink: 0;
	}
	main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.search-bar {
		display: flex;
		align-items: center;
		min-height: 54px;
		background: var(--sy-color--white);
	}
	.content {
		display: flex;
		flex: 1;
		min-height: 0;
	}
	.results {
		width: 220px;
		flex-shrink: 0;
		background: var(--sy-color--white);
	}
	.dictionary {
		padding: 1.25rem;
		min-width: 0;
	}
	.characters {
		font-size: 3rem;
	}
	.secondary {
		color: var(--sy-text--muted);
		font-size: 1.6rem;
	}
</style>
