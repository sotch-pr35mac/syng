// Runtime globals exposed by Tauri or test shims.

declare module 'pdfjs-dist/build/pdf.worker.mjs?url' {
	const workerUrl: string;
	export default workerUrl;
}

// eslint-disable-next-line no-unused-vars
interface Window {
	__TAURI__: any;
}
