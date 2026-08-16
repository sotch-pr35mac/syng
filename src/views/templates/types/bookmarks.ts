export const BOOKMARK_LIST_MEMBERSHIP_OPERATIONS = {
	ADDED: 'added',
	REMOVED: 'removed',
} as const;

export type BookmarkListMembershipOperation =
	(typeof BOOKMARK_LIST_MEMBERSHIP_OPERATIONS)[keyof typeof BOOKMARK_LIST_MEMBERSHIP_OPERATIONS];

/** Successful bookmark list-membership mutation reported by dictionary content. */
export type BookmarkListMembershipEvent = {
	listName: string;
	wordHash: string;
	operation: BookmarkListMembershipOperation;
};
