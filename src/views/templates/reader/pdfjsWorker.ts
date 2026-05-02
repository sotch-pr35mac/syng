import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

/**
 * Directory that contains `bundle.js` (used to resolve the worker and pdf.js asset folders).
 */
export function getTemplatesBuildBaseHref(): string {
	if (typeof window === 'undefined') {
		return '/templates/build/';
	}
	const entryScript = document.querySelector(
		'script[src*="bundle.js"]'
	) as HTMLScriptElement | null;
	if (entryScript?.src && entryScript.src.length > 0) {
		return new URL('.', entryScript.src).href;
	}
	return `${window.location.origin}${window.location.pathname.replace(/[^/]+$/, '')}`;
}

/**
 * pdf.js 5 loads CMaps, standard fonts, and wasm from URLs next to the app bundle (copied in `vite.config.js`).
 * Without these, text extraction fails with missing `cMapUrl` / font translation errors.
 */
export function getPdfJsDocumentInitOptions(): {
	cMapUrl: string;
	cMapPacked: true;
	standardFontDataUrl: string;
	wasmUrl: string;
	iccUrl: string;
	/** Load CMaps/fonts/wasm from the main document context (more reliable in Tauri than worker fetch). */
	useWorkerFetch: false;
} {
	const baseHref = getTemplatesBuildBaseHref();
	return {
		cMapUrl: new URL('cmaps/', baseHref).href,
		cMapPacked: true,
		standardFontDataUrl: new URL('standard_fonts/', baseHref).href,
		wasmUrl: new URL('wasm/', baseHref).href,
		iccUrl: new URL('iccs/', baseHref).href,
		useWorkerFetch: false,
	};
}

/**
 * Point pdf.js at a bundled worker URL so loading works under Vite/Tauri.
 * Resolves relative `?url` paths against the app bundle script so the worker
 * is not requested from the wrong origin/path (which returns HTML and breaks with
 * "Unexpected token '<'" / invalid JavaScript MIME type).
 */
export function configurePdfJsWorker(GlobalWorkerOptions: { workerSrc: string }): void {
	const baseHref = getTemplatesBuildBaseHref();
	if (typeof window === 'undefined') {
		GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
		return;
	}
	if (/^https?:\/\//i.test(pdfWorkerUrl)) {
		GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
		return;
	}
	// Vite emits root-absolute asset paths like "/pdfjs-worker-abc.mjs". Feeding that to
	// `new URL("/x", "…/templates/build/bundle.js")` resolves to the host root, not next to
	// bundle.js, so the worker 404s as HTML and pdf.js reports invalid JavaScript MIME type.
	let resolvedWorkerPath = pdfWorkerUrl;
	if (resolvedWorkerPath.startsWith('/') && !resolvedWorkerPath.startsWith('//')) {
		resolvedWorkerPath = `.${resolvedWorkerPath}`;
	}
	GlobalWorkerOptions.workerSrc = new URL(resolvedWorkerPath, baseHref).href;
}
