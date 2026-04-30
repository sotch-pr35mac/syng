import { readable } from 'svelte/store';

type RoutePart = 'location' | 'querystring';

function getHashRoute(): string {
	if (typeof window === 'undefined') {
		return '/';
	}

	const hash = window.location.hash.startsWith('#')
		? window.location.hash.slice(1)
		: window.location.hash;

	return hash || '/';
}

function readRoutePart(part: RoutePart): string {
	const [path = '/', search = ''] = getHashRoute().split('?');
	return part === 'location' ? path || '/' : search;
}

function createRouteStore(part: RoutePart) {
	return readable(readRoutePart(part), (set) => {
		const update = () => set(readRoutePart(part));

		window.addEventListener('hashchange', update);
		window.addEventListener('popstate', update);
		update();

		return () => {
			window.removeEventListener('hashchange', update);
			window.removeEventListener('popstate', update);
		};
	});
}

export const location = createRouteStore('location');
export const querystring = createRouteStore('querystring');
