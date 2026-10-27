import type { SearchEntry } from '@/types/search.js';
import type { BreakdownSelection } from '@/types/characterBreakdown.js';
export const mobileBreakdown: {
	word?: SearchEntry;
	selection?: BreakdownSelection;
	origin?: string;
	scroll: number;
	lists: string[];
} = { scroll: 0, lists: [] };
