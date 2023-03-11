/* eslint-disable no-undef */
import { suppressUnusedExportLet } from './suppression.js';

it('should do nothing when you call this function', async () => {
	expect(suppressUnusedExportLet(true)).toBeUndefined();
});