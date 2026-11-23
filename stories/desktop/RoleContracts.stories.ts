import type { Meta, StoryObj } from '@storybook/svelte-vite';
import DesktopRoleContracts from './DesktopRoleContracts.svelte';

const meta = {
	title: 'Desktop/Role contracts',
	component: DesktopRoleContracts,
	parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DesktopRoleContracts>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ComposedSurfaces: Story = { args: { sample: 'composition' } };
export const ComponentMapping: Story = { args: { sample: 'mapping' } };
export const InteractionAndForeground: Story = { args: { sample: 'interaction' } };
export const SpatialLayers: Story = { args: { sample: 'spatial' } };
export const ExceptionsAndOpenQuestions: Story = { args: { sample: 'gaps' } };
