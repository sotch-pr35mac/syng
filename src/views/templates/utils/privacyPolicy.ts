import type { PrivacyPolicy, PrivacyRegime, RegionOption } from '@/types/privacy.js';
import { PRIVACY_REGIMES } from '@/types/privacy.js';
import cldrTerritoriesEn from '@/utils/cldrTerritoriesEn.json';

const US_AGE_THRESHOLD = 13;
const EEA_AGE_THRESHOLD = 16;
const UK_AGE_THRESHOLD = 18;
const AU_AGE_THRESHOLD = 18;
const CA_AGE_THRESHOLD = 13;
const JP_AGE_THRESHOLD = 15;
const BR_AGE_THRESHOLD = 18;

const US_REGION_CODES = new Set(['US', 'AS', 'GU', 'MP', 'PR', 'UM', 'VI']);

const EEA_REGION_CODES = new Set([
	// EU27
	'AT',
	'BE',
	'BG',
	'HR',
	'CY',
	'CZ',
	'DK',
	'EE',
	'FI',
	'FR',
	'DE',
	'GR',
	'HU',
	'IE',
	'IT',
	'LV',
	'LT',
	'LU',
	'MT',
	'NL',
	'PL',
	'PT',
	'RO',
	'SK',
	'SI',
	'ES',
	'SE',
	// EEA EFTA
	'IS',
	'LI',
	'NO',
	// Åland and French outermost regions present in CLDR
	'AX',
	'GF',
	'GP',
	'MQ',
	'RE',
	'YT',
	'MF',
	'BL',
]);

const UK_REGION_CODES = new Set(['GB', 'IM', 'JE', 'GG']);

const OTHER_POLICY: PrivacyPolicy = {
	regime: PRIVACY_REGIMES.OTHER,
	ageThreshold: null,
};

const territoryNames = cldrTerritoriesEn as Record<string, string>;

export const REGION_OPTIONS: readonly RegionOption[] = Object.entries(territoryNames)
	.map(([code, name]) => ({ code, name }))
	.sort((left, right) => left.name.localeCompare(right.name, 'en'));

export function normalizeRegionCode(regionCode: string | null | undefined): string | null {
	if (!regionCode) {
		return null;
	}
	const normalized = regionCode.trim().toUpperCase();
	return Object.prototype.hasOwnProperty.call(territoryNames, normalized) ? normalized : null;
}

export function regionNameFor(regionCode: string | null | undefined): string | null {
	const normalized = normalizeRegionCode(regionCode);
	return normalized ? territoryNames[normalized] : null;
}

export function filterRegionOptions(query: string): RegionOption[] {
	const normalizedQuery = query.trim().toLowerCase();
	if (!normalizedQuery) {
		return [...REGION_OPTIONS];
	}
	return REGION_OPTIONS.filter((region) => {
		return (
			region.name.toLowerCase().includes(normalizedQuery) ||
			region.code.toLowerCase().includes(normalizedQuery)
		);
	});
}

function policyForRegime(regime: PrivacyRegime, ageThreshold: number): PrivacyPolicy {
	return { regime, ageThreshold };
}

export function privacyPolicyFor(regionCode: string | null | undefined): PrivacyPolicy {
	const normalized = normalizeRegionCode(regionCode);
	if (!normalized) {
		return OTHER_POLICY;
	}
	if (US_REGION_CODES.has(normalized)) {
		return policyForRegime(PRIVACY_REGIMES.US, US_AGE_THRESHOLD);
	}
	if (EEA_REGION_CODES.has(normalized)) {
		return policyForRegime(PRIVACY_REGIMES.EEA, EEA_AGE_THRESHOLD);
	}
	if (UK_REGION_CODES.has(normalized)) {
		return policyForRegime(PRIVACY_REGIMES.UK, UK_AGE_THRESHOLD);
	}
	if (normalized === 'AU') {
		return policyForRegime(PRIVACY_REGIMES.AU, AU_AGE_THRESHOLD);
	}
	if (normalized === 'CA') {
		return policyForRegime(PRIVACY_REGIMES.CA, CA_AGE_THRESHOLD);
	}
	if (normalized === 'JP') {
		return policyForRegime(PRIVACY_REGIMES.JP, JP_AGE_THRESHOLD);
	}
	if (normalized === 'BR') {
		return policyForRegime(PRIVACY_REGIMES.BR, BR_AGE_THRESHOLD);
	}
	return OTHER_POLICY;
}

export function childPrivacyModeFrom(
	regionCode: string | null | undefined,
	isBelowApplicableAge: boolean | null
): boolean {
	if (isBelowApplicableAge !== true) {
		return false;
	}
	return privacyPolicyFor(regionCode).ageThreshold !== null;
}

export function isPrivacyStepComplete(
	regionCode: string | null | undefined,
	isBelowApplicableAge: boolean | null
): boolean {
	const normalized = normalizeRegionCode(regionCode);
	if (!normalized) {
		return false;
	}
	if (privacyPolicyFor(normalized).ageThreshold === null) {
		return true;
	}
	return isBelowApplicableAge !== null;
}
