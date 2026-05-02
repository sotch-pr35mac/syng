import { afterEach, expect, it } from 'vitest';
import { canUseNativeReaderPrepareImport } from '@/utils/readerNativeImport.js';

afterEach(() => {
	Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
});

it('reports native prepare import unavailable when Tauri internals are not present', () => {
	Reflect.deleteProperty(window, '__TAURI_INTERNALS__');
	expect(canUseNativeReaderPrepareImport()).toBe(false);
});
