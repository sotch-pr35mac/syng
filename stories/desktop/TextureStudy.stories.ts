import type { Meta, StoryObj } from '@storybook/svelte-vite';
import TextureStudy from './TextureStudy.svelte';

const meta = {
	title: 'Desktop/Proposals/Surface texture',
	component: TextureStudy,
	parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof TextureStudy>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CompareTreatments: Story = {};
