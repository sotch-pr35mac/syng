import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProposedElements from './ProposedElements.svelte';

const meta = {
	title: 'Desktop/Adopted references',
	component: ProposedElements,
	parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof ProposedElements>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CollapsibleList: Story = { args: { sample: 'collapsibleList' } };
export const Dropdown: Story = { args: { sample: 'dropdown' } };
export const RadioChoices: Story = { args: { sample: 'radioChoices' } };
