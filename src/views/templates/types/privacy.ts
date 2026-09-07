export const PRIVACY_REGIMES = {
	US: 'us',
	EEA: 'eea',
	UK: 'uk',
	AU: 'au',
	CA: 'ca',
	JP: 'jp',
	BR: 'br',
	OTHER: 'other',
} as const;

export type PrivacyRegime = (typeof PRIVACY_REGIMES)[keyof typeof PRIVACY_REGIMES];

export interface PrivacyPolicy {
	regime: PrivacyRegime;
	ageThreshold: number | null;
}

export interface PrivacySettings {
	regionCode: string | null;
	childPrivacyMode: boolean;
	completedOnboardingVersion: number;
	forceOnboardingReplay: boolean;
}

export interface RegionOption {
	code: string;
	name: string;
}
