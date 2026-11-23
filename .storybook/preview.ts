import type { Preview } from '@storybook/svelte-vite';
import '../src/views/templates/styles/theme.css';
import '../src/views/templates/styles/syui.css';

const preview: Preview = {
	parameters: {
		layout: 'centered',
		controls: { expanded: true },
		backgrounds: { disable: true },
	},
};

export default preview;
