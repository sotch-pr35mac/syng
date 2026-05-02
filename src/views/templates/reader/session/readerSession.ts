import { ReaderNavigator } from '@/reader/navigation/navigator.js';
import type {
	ReaderLocator,
	ReaderLookupTarget,
	ReaderPublication,
	ReaderResource,
	ReaderThemeSettings,
} from '@/reader/types.js';

export interface ReaderSessionState {
	publication: ReaderPublication;
	resource: ReaderResource;
	locator: ReaderLocator;
	settings: ReaderThemeSettings;
	lookupTarget?: ReaderLookupTarget;
	canGoBackward: boolean;
	canGoForward: boolean;
}

export class ReaderSession {
	#navigator: ReaderNavigator;
	#settings: ReaderThemeSettings;
	#lookupTarget: ReaderLookupTarget | undefined;

	constructor(
		publication: ReaderPublication,
		settings: ReaderThemeSettings,
		locator?: ReaderLocator
	) {
		this.#navigator = new ReaderNavigator(publication, locator);
		this.#settings = settings;
	}

	get state(): ReaderSessionState {
		const navigationState = this.#navigator.state;
		const resource =
			this.#navigator.publication.resources.find(
				(candidate) => candidate.href === navigationState.resource.href
			) ?? this.#navigator.publication.resources[0];
		return {
			publication: this.#navigator.publication,
			resource,
			locator: navigationState.locator,
			settings: this.#settings,
			lookupTarget: this.#lookupTarget,
			canGoBackward: navigationState.canGoBackward,
			canGoForward: navigationState.canGoForward,
		};
	}

	updateSettings(settings: ReaderThemeSettings): ReaderSessionState {
		this.#settings = settings;
		return this.state;
	}

	goForward(): ReaderSessionState {
		this.#navigator.goForward();
		this.#lookupTarget = undefined;
		return this.state;
	}

	goBackward(): ReaderSessionState {
		this.#navigator.goBackward();
		this.#lookupTarget = undefined;
		return this.state;
	}

	goTo(locator: ReaderLocator): ReaderSessionState {
		this.#navigator.goTo(locator);
		this.#lookupTarget = undefined;
		return this.state;
	}

	setLookupTarget(target: ReaderLookupTarget | undefined): ReaderSessionState {
		this.#lookupTarget = target;
		return this.state;
	}
}
