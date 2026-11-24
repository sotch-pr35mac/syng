import type { Meta, StoryObj } from '@storybook/svelte-vite';
import DesktopWalkthrough from './DesktopWalkthrough.svelte';

const meta = {
	title: 'Desktop/Walkthrough',
	component: DesktopWalkthrough,
	parameters: { layout: 'fullscreen' },
	argTypes: { sample: { control: false } },
} satisfies Meta<typeof DesktopWalkthrough>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SettingsGuidePicker: Story = { args: { sample: 'settings' } };
export const ContextualHelpLink: Story = { args: { sample: 'help' } };
