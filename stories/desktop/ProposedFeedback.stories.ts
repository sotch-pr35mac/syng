import type { Meta, StoryObj } from '@storybook/svelte-vite';
import ProposedFeedback from './ProposedFeedback.svelte';

const meta = {
	title: 'Desktop/Proposals/Feedback',
	component: ProposedFeedback,
	parameters: { layout: 'fullscreen' },
	argTypes: { sample: { control: false } },
} satisfies Meta<typeof ProposedFeedback>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlainModalReference: Story = { args: { sample: 'modal' } };
export const Popover: Story = { args: { sample: 'popover' } };
export const Toast: Story = { args: { sample: 'toast' } };
