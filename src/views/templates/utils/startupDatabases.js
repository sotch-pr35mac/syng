export const getStartupDatabaseNames = (debugMode) => ({
	configDb: debugMode ? 'development_config' : 'config',
	listDb: debugMode ? 'development_word-lists' : 'word-lists',
	bookmarkDb: debugMode ? 'development_bookmarks' : 'bookmarks',
	readerDocumentDb: debugMode ? 'development_reader-documents' : 'reader-documents',
});
