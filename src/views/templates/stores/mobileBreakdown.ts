import type { SearchEntry } from '@/types/search.js';
import type { BreakdownSelection } from '@/types/characterBreakdown.js';
// Session-only navigation context; never a user preference or a database migration.
export const mobileBreakdown: {
	word?: SearchEntry;
	selection?: BreakdownSelection;
	origin?: string;
	scroll: number;
	lists: string[];
} = { scroll: 0, lists: [] };
