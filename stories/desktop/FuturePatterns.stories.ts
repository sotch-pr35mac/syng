import type { Meta, StoryObj } from '@storybook/svelte-vite';
import FuturePatterns from './FuturePatterns.svelte';

const meta = {
	title: 'Desktop/Future pattern requirements',
	component: FuturePatterns,
	parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof FuturePatterns>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SharedContracts: Story = { args: { sample: 'shared' } };
export const ListenAndRead: Story = { args: { sample: 'audio' } };
export const ArticleFeeds: Story = { args: { sample: 'rss' } };
export const SentenceDecomposition: Story = { args: { sample: 'sentence' } };
export const StudyHistory: Story = { args: { sample: 'history' } };
export const StudyConfiguration: Story = { args: { sample: 'configuration' } };
export const LearningStats: Story = { args: { sample: 'stats' } };
