import type { Meta, StoryObj } from '@storybook/svelte-vite';
import DesktopElements from './DesktopElements.svelte';

const meta = {
	title: 'Desktop/Elements',
	component: DesktopElements,
	parameters: { layout: 'fullscreen' },
	argTypes: { sample: { control: false } },
} satisfies Meta<typeof DesktopElements>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SyButton: Story = { args: { sample: 'button' } };
export const SyButtonBar: Story = { args: { sample: 'buttonBar' } };
export const SyCollapsibleList: Story = { args: { sample: 'collapsibleList' } };
export const SyDropdown: Story = { args: { sample: 'dropdown' } };
export const SyList: Story = { args: { sample: 'list' } };
export const SyModal: Story = { args: { sample: 'modal' } };
export const SyPopover: Story = { args: { sample: 'popover' } };
export const SyProgressLine: Story = { args: { sample: 'progress' } };
export const SyRadio: Story = { args: { sample: 'radio' } };
export const SyTab: Story = { args: { sample: 'tab' } };
export const SyTag: Story = { args: { sample: 'tag' } };
export const SyTextInput: Story = { args: { sample: 'textInput' } };
export const SyTimer: Story = { args: { sample: 'timer' } };
export const SyToast: Story = { args: { sample: 'toast' } };
export const SyToggle: Story = { args: { sample: 'toggle' } };
