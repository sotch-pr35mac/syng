import type { StorybookConfig } from '@storybook/svelte-vite';
import { resolve } from 'node:path';

const config: StorybookConfig = {
	stories: ['../stories/desktop/**/*.stories.ts'],
	addons: [],
	framework: {
		name: '@storybook/svelte-vite',
		options: { docgen: false },
	},
	core: { disableTelemetry: true },
	async viteFinal(viteConfig) {
		const { mergeConfig } = await import('vite');
		return mergeConfig(viteConfig, {
			resolve: {
				alias: {
					'@': resolve(import.meta.dirname, '../src/views/templates'),
				},
			},
		});
	},
};

export default config;
