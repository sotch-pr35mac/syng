import { invoke } from '@tauri-apps/api/core';
import { NATIVE_COMMANDS } from '@/types/nativeCommands.js';
import type { RegionOption } from '@/types/privacy.js';

interface NativeRegionOption {
	code: string;
	fallbackName: string;
}

let regionOptionsPromise: Promise<readonly RegionOption[]> | null = null;

function createDisplayNames(locale: string): Intl.DisplayNames | null {
	if (typeof Intl.DisplayNames !== 'function') {
		return null;
	}
	try {
		return new Intl.DisplayNames([locale], { type: 'region' });
	} catch {
		return null;
	}
}

function localizedName(region: NativeRegionOption, displayNames: Intl.DisplayNames | null): string {
	const name = displayNames?.of(region.code);
	return name && name !== region.code ? name : region.fallbackName;
}

export function loadRegionOptions(
	locale: string = globalThis.navigator?.language ?? 'en'
): Promise<readonly RegionOption[]> {
	if (regionOptionsPromise) {
		return regionOptionsPromise;
	}

	regionOptionsPromise = invoke<NativeRegionOption[]>(NATIVE_COMMANDS.APP.GET_REGION_OPTIONS)
		.then((regions) => {
			const displayNames = createDisplayNames(locale);
			return regions
				.map((region) => ({
					code: region.code,
					name: localizedName(region, displayNames),
				}))
				.sort((left, right) => left.name.localeCompare(right.name, locale));
		})
		.catch((error) => {
			regionOptionsPromise = null;
			throw error;
		});

	return regionOptionsPromise;
}

export function regionNameFor(
	regions: readonly RegionOption[],
	regionCode: string | null | undefined
): string | null {
	if (!regionCode) {
		return null;
	}
	return regions.find((region) => region.code === regionCode.trim().toUpperCase())?.name ?? null;
}

export function filterRegionOptions(
	regions: readonly RegionOption[],
	query: string
): RegionOption[] {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return [...regions];
	}
	return regions.filter(
		(region) =>
			region.name.toLowerCase().includes(normalizedQuery) ||
			region.code.toLowerCase().includes(normalizedQuery)
	);
}

export function resetRegionOptionsForTest(): void {
	regionOptionsPromise = null;
}
