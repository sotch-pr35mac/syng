import type { Meta, StoryObj } from '@storybook/svelte-vite';
import DarkPaletteStudy from './DarkPaletteStudy.svelte';

const meta = {
	title: 'Desktop/Proposals/Dark surface roles',
	component: DarkPaletteStudy,
	parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DarkPaletteStudy>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CompareOrder: Story = {};
