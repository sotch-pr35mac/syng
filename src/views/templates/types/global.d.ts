// Runtime globals exposed by Tauri or test shims.

interface Window {
	__TAURI__: any;
}

declare module '*.svelte?raw' {
	const source: string;
	export default source;
}
