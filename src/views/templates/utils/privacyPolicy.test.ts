import { describe, expect, it } from 'vitest';
import {
	childPrivacyModeFrom,
	filterRegionOptions,
	isPrivacyStepComplete,
	normalizeRegionCode,
	privacyPolicyFor,
	REGION_OPTIONS,
	regionNameFor,
} from '@/utils/privacyPolicy.js';
import { PRIVACY_REGIMES } from '@/types/privacy.js';

describe('privacyPolicyFor', () => {
	it.each([
		['US', PRIVACY_REGIMES.US, 13],
		['PR', PRIVACY_REGIMES.US, 13],
		['GU', PRIVACY_REGIMES.US, 13],
		['DE', PRIVACY_REGIMES.EEA, 16],
		['FR', PRIVACY_REGIMES.EEA, 16],
		['IS', PRIVACY_REGIMES.EEA, 16],
		['NO', PRIVACY_REGIMES.EEA, 16],
		['AX', PRIVACY_REGIMES.EEA, 16],
		['RE', PRIVACY_REGIMES.EEA, 16],
		['GB', PRIVACY_REGIMES.UK, 18],
		['IM', PRIVACY_REGIMES.UK, 18],
		['AU', PRIVACY_REGIMES.AU, 18],
		['CA', PRIVACY_REGIMES.CA, 13],
		['JP', PRIVACY_REGIMES.JP, 15],
		['BR', PRIVACY_REGIMES.BR, 18],
	])('maps %s to the expected regime and threshold', (regionCode, regime, ageThreshold) => {
		expect(privacyPolicyFor(regionCode)).toEqual({ regime, ageThreshold });
	});

	it('treats unknown, empty, and grouping-excluded codes as other with no age question', () => {
		expect(privacyPolicyFor('CN')).toEqual({
			regime: PRIVACY_REGIMES.OTHER,
			ageThreshold: null,
		});
		expect(privacyPolicyFor(null)).toEqual({
			regime: PRIVACY_REGIMES.OTHER,
			ageThreshold: null,
		});
		expect(privacyPolicyFor('EU')).toEqual({
			regime: PRIVACY_REGIMES.OTHER,
			ageThreshold: null,
		});
		expect(privacyPolicyFor('ZZ')).toEqual({
			regime: PRIVACY_REGIMES.OTHER,
			ageThreshold: null,
		});
	});

	it('normalizes lowercase region codes', () => {
		expect(privacyPolicyFor('us')).toEqual({
			regime: PRIVACY_REGIMES.US,
			ageThreshold: 13,
		});
		expect(normalizeRegionCode(' jp ')).toBe('JP');
	});
});

describe('childPrivacyModeFrom', () => {
	it('is independent of any telemetry flag and requires both a threshold region and a yes answer', () => {
		expect(childPrivacyModeFrom('US', true)).toBe(true);
		expect(childPrivacyModeFrom('US', false)).toBe(false);
		expect(childPrivacyModeFrom('US', null)).toBe(false);
		expect(childPrivacyModeFrom('CN', true)).toBe(false);
		expect(childPrivacyModeFrom(null, true)).toBe(false);
	});

	it('clears stale derivation when the region changes', () => {
		expect(childPrivacyModeFrom('US', true)).toBe(true);
		expect(childPrivacyModeFrom('CN', true)).toBe(false);
		expect(childPrivacyModeFrom('DE', null)).toBe(false);
	});
});

describe('isPrivacyStepComplete', () => {
	it('requires a region, and an age answer only when the regime has a threshold', () => {
		expect(isPrivacyStepComplete(null, null)).toBe(false);
		expect(isPrivacyStepComplete('CN', null)).toBe(true);
		expect(isPrivacyStepComplete('US', null)).toBe(false);
		expect(isPrivacyStepComplete('US', false)).toBe(true);
		expect(isPrivacyStepComplete('US', true)).toBe(true);
	});
});

describe('region dataset', () => {
	it('vendors ISO 3166-1 alpha-2 English names and excludes grouping codes', () => {
		expect(REGION_OPTIONS.some((region) => region.code === 'US')).toBe(true);
		expect(regionNameFor('US')).toBe('United States');
		expect(REGION_OPTIONS.some((region) => region.code === 'EU')).toBe(false);
		expect(REGION_OPTIONS.some((region) => region.code === 'UN')).toBe(false);
		expect(REGION_OPTIONS.some((region) => region.code === 'ZZ')).toBe(false);
	});

	it('filters regions by English name or code', () => {
		const matches = filterRegionOptions('united');
		expect(matches.some((region) => region.code === 'US')).toBe(true);
		expect(filterRegionOptions('JP')[0]?.code).toBe('JP');
	});
});
