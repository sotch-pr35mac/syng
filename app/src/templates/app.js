import App from './App.svelte';
import { handleError } from './utils/';
window.dictionary = window.require('chinese-dictionary');
window.dictionary.init().then(() => document.dispatchEvent(new Event('init'))).catch(() => {
    handleError('There was aan error starting Syng. Pleasae quit and try again. If this problem persists please file a bbug report.');
});

const app = new App({
	target: document.body
});

export default app;
