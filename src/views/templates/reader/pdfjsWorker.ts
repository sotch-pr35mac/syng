import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

/**
 * Point pdf.js at a bundled worker URL so loading works under Vite/Tauri
 * (dynamic `new URL(..., import.meta.url)` is not reliably emitted in all builds).
 */
export function configurePdfJsWorker(GlobalWorkerOptions: { workerSrc: string }): void {
	GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
}
