export const SHEET_SNAPS = ['collapsed', 'partial', 'full'] as const;
export type SheetSnap = (typeof SHEET_SNAPS)[number];
export const COLLAPSED_HEIGHT = 110;
export const PARTIAL_HEIGHT_RATIO = 0.38;
export const FULL_HEIGHT_RATIO = 0.85;
