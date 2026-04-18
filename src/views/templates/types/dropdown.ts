export const DROPDOWN_POSITIONS = {
	LEFT: 'left',
	RIGHT: 'right',
} as const;

export type DropdownPosition = (typeof DROPDOWN_POSITIONS)[keyof typeof DROPDOWN_POSITIONS];

export const DROPDOWN_DIRECTIONS = {
	DOWN: 'down',
	UP: 'up',
} as const;

export type DropdownDirection = (typeof DROPDOWN_DIRECTIONS)[keyof typeof DROPDOWN_DIRECTIONS];
