/**
 * Parses a CSS variable color value into RGB components
 * @param {string} color - CSS variable (e.g., "var(--sy-color--blue)")
 * @returns {number[]} Array of [r, g, b] values
 */
export function parseColor(color) {
	const variableName = color.match(/\(([^)]+)\)/)[1];
	let hex = getComputedStyle(document.documentElement)
		.getPropertyValue(variableName)
		.trim();

	hex = hex.replace('#', '');
	const r = parseInt(hex.substring(0, 2), 16);
	const g = parseInt(hex.substring(2, 4), 16);
	const b = parseInt(hex.substring(4, 6), 16);

	return [r, g, b];
}

/**
 * Interpolates between two colors based on a progress value
 * @param {string} startColor - Starting CSS variable color
 * @param {string} endColor - Ending CSS variable color
 * @param {number} progress - Progress value between 0 and 1
 * @returns {string} RGB color string
 */
export function interpolateColor(startColor, endColor, progress) {
	if (!endColor) return startColor;

	const color1 = parseColor(startColor);
	const color2 = parseColor(endColor);

	const r = Math.round(color1[0] + (color2[0] - color1[0]) * progress);
	const g = Math.round(color1[1] + (color2[1] - color1[1]) * progress);
	const b = Math.round(color1[2] + (color2[2] - color1[2]) * progress);

	return `rgb(${r}, ${g}, ${b})`;
} 