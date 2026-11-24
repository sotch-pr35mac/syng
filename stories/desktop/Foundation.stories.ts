import type { Meta, StoryObj } from '@storybook/svelte-vite';
import DesktopFoundation from './DesktopFoundation.svelte';
import DesktopCoverage from './DesktopCoverage.svelte';
import DesktopTypography from './DesktopTypography.svelte';

const meta = {
	title: 'Desktop/Foundation',
	component: DesktopFoundation,
	parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DesktopFoundation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SurfaceRoles: Story = { args: { section: 'roles' } };
export const ColorPalette: Story = { args: { section: 'palette' } };
export const Elevation: Story = { args: { section: 'elevation' } };

export const TypographyRoles = {
	render: () => ({ Component: DesktopTypography }),
	parameters: { layout: 'fullscreen' },
};

export const CoverageAndGaps = {
	render: () => ({ Component: DesktopCoverage }),
	parameters: { layout: 'fullscreen' },
};
