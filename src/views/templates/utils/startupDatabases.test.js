import { expect, it } from 'vitest';
import { getStartupDatabaseNames } from '@/utils/startupDatabases.js';

it('uses isolated development databases in debug mode', () => {
	expect(getStartupDatabaseNames(true)).toEqual({
		configDb: 'development_config',
		listDb: 'development_word-lists',
		bookmarkDb: 'development_bookmarks',
		readerDocumentDb: 'development_reader-documents',
	});
});

it('uses production databases outside debug mode', () => {
	expect(getStartupDatabaseNames(false)).toEqual({
		configDb: 'config',
		listDb: 'word-lists',
		bookmarkDb: 'bookmarks',
		readerDocumentDb: 'reader-documents',
	});
});
