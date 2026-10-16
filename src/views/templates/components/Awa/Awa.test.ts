import { afterEach, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/svelte';
import Awa from '@/components/Awa/Awa.svelte';

let documentBase: HTMLBaseElement;

afterEach(() => {
	cleanup();
	documentBase?.remove();
});

it.each(['tauri://localhost/', 'http://tauri.localhost/', 'https://tauri.localhost/'])(
	'loads the glow mask from the same asset as Awa when CSS is nested under %s',
	(origin) => {
		documentBase = document.createElement('base');
		documentBase.href = `${origin}index.html`;
		document.head.append(documentBase);

		const view = render(Awa, { pose: 'search' });
		const mascot = view.container.querySelector<HTMLElement>('.awa')!;
		const artwork = view.container.querySelector<HTMLImageElement>('img')!;
		const maskValue = mascot.style.getPropertyValue('--awa-silhouette');
		const maskReference = maskValue.match(/^url\(["']?([^"')]+)["']?\)$/)?.[1];

		expect(maskReference).toBeTruthy();
		const stylesheetUrl = new URL('templates/build/bundle.css', document.baseURI);
		expect(new URL(maskReference!, stylesheetUrl).href).toBe(artwork.src);
	}
);
