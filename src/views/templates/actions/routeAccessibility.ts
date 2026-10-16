import { tick } from 'svelte';

const ROUTE_TITLES: Record<string, string> = {
	'/': 'Search',
	'/read': 'Reader library',
	'/bookmarks': 'Bookmarks',
	'/study': 'Study',
	'/study/quiz': 'Quiz',
	'/study/flashcards': 'Flashcards',
	'/tools': 'Tools',
	'/settings': 'Settings',
	'/help': 'Help',
	'/characters': 'Character stroke order',
};

/** Name SPA destinations and move keyboard navigation into the destination landmark. */
export function routeAccessibility(element: HTMLElement, initialRoute: string) {
	let currentRoute = initialRoute;
	const nameDestination = (route: string) => {
		const title = route.startsWith('/read/document/')
			? 'Reader document'
			: (ROUTE_TITLES[route] ?? 'Syng');
		element.setAttribute('aria-label', title);
		document.title = `${title} — Syng`;
	};
	nameDestination(initialRoute);
	return {
		update(route: string) {
			nameDestination(route);
			if (route === currentRoute) {
				return;
			}
			currentRoute = route;
			if (document.documentElement.dataset.inputModality !== 'keyboard') {
				return;
			}
			void tick()
				.then(() => {
					if (!element.isConnected || route !== currentRoute) {
						return undefined;
					}
					const focused = document.activeElement;
					// Keep deliberate destination focus (for example Search's input autofocus).
					if (focused === document.body || focused?.closest('nav')) {
						element.focus({ preventScroll: true });
					}
					return undefined;
				})
				.catch(() => {});
		},
	};
}
