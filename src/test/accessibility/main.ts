/// <reference types="vite/client" />
import { mount } from 'svelte';
import '@/styles/theme.css';
import '@/styles/syui.css';
import { initializeAccessibility } from '@/composables/accessibility.js';
import { contrastStore } from '@/stores/contrast.svelte.js';

Reflect.set(window, '__TAURI_OS_PLUGIN_INTERNALS__', {
	platform: new URLSearchParams(location.search).has('ipad')
		? 'ios'
		: new URLSearchParams(location.search).has('mobile')
			? 'android'
			: 'linux',
});
initializeAccessibility();
contrastStore.initialize();
if (new URLSearchParams(location.search).get('appearance') === 'contrast') {
	document.documentElement.dataset.appearance = 'contrast';
}
const fontSize = Number(new URLSearchParams(location.search).get('fontSize')) || 16;
document.documentElement.style.setProperty('--sy-system-font-size', `${fontSize}px`);
document.documentElement.style.setProperty('--sy-system-text-scale', `${fontSize / 16}`);
const { default: Fixture } = new URLSearchParams(location.search).has('settings')
	? await import('@test/accessibility/SettingsFixture.svelte')
	: new URLSearchParams(location.search).has('walkthrough')
		? await import('@test/accessibility/WalkthroughFixture.svelte')
		: new URLSearchParams(location.search).has('quizFeedback')
			? await import('@test/accessibility/QuizFeedbackFixture.svelte')
			: new URLSearchParams(location.search).has('palette')
				? await import('@test/accessibility/PaletteFixture.svelte')
				: new URLSearchParams(location.search).has('routes')
					? await import('@test/accessibility/RoutesFixture.svelte')
					: await import('@test/accessibility/Fixture.svelte');
mount(Fixture, { target: document.getElementById('fixture')! });
