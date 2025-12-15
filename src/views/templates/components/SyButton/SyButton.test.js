import { render } from '@testing-library/svelte';
import SyButton from './SyButton.svelte';

it('should use the correct default values', async () => {
	const { getByTestId } = render(SyButton, {});
	const classes = getByTestId('sy-button').className.split(' ');

	expect(classes).toContain('sy-button--filled');
	expect(classes).toContain('sy-button--medium');
	expect(classes).toContain('sy-button--rectangle');
	expect(classes).not.toContain('sy-button--grouped');
});
it('should include the classes passed in as props', async () => {
	const { getByTestId } = render(SyButton, {
		classes: ['test-class'],
	});
	const classes = getByTestId('sy-button').className.split(' ');

	expect(classes).toContain('test-class');
});
it('should respond to the grouped prop', async () => {
	const { getByTestId } = render(SyButton, {
		grouped: true,
	});
	const classes = getByTestId('sy-button').className.split(' ');

	expect(classes).toContain('sy-button--grouped');
});
it('should not respond to click events when disbaled', async () => {
	const { getByTestId } = render(SyButton, {
		disabled: true,
	});
	const button = getByTestId('sy-button');

	expect(button.disabled).toBe(true);
});
it('should respond to different shapes, styles, and sizes', async () => {
	const { getByTestId } = render(SyButton, {
		style: 'ghost',
		size: 'large',
		shape: 'circle',
	});
	const classes = getByTestId('sy-button').className.split(' ');

	expect(classes).toContain('sy-button--ghost');
	expect(classes).toContain('sy-button--large');
	expect(classes).toContain('sy-button--circle');
});
