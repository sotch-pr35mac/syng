export const MIGRATION_MESSAGES = [
	'Contacting Starfleet...',
	'Pay no attention to Caesar. Caesar doesn’t have the slightest idea what’s really going on.',
	"Don't think about elephants.",
	'Please wait while we test your patience.',
	'Are we there yet...?',
	'Contemplating life...',
	'Working...',
	'Determining length for offline cable...',
	'Reading sectors from file...',
	"Don't panic.",
	'Obfuscating error messages...',
	'Dividing by zero...',
	'Recalculating gravitational constant...',
	'brb',
	"Determining size of CC-CEDICT file ... It's Over 9000!",
	'Solving for x...',
	'Saving checkpoint...',
	'Insert quarter.',
	'Taking too long? Go outside!',
	'Please keep waiting.',
	'Batteries not included.',
	'Level up!',
	'Unjamming RAM',
	'Softening hard disk...',
	'Have a good day.',
	'Preparing DOS run-time environment',
	'Bitmapping...',
	'Downloading more RAM...',
	'Making bacon pancakes...',
	'Asking AI simple questions...',
	'Figuring out how to use 了 properly...',
	'Making sense of this past year...',
	'Vibecoding...',
	'Practicing tones...',
	'Sliding carefully...',
	'Adding just one more 儿...',
	'Consulting native speakers...',
	'Simplifying the traditional...',
	'Traditionalizing the simplified...',
	'正在加载…',
	'马上就好…',
	'稍等一下…',
	'别着急…',
	'快了快了…',
	'Almost doing something...',
	'Cherishing every byte...',
	'Creating a harmonious loading environment...',
	'Friendly reminder: still loading.',
	'Loading is everybody’s responsibility.',
	'Good good study, day day up.',
	'Horse horse tiger tiger.',
	'Adding oil...',
	'Drawing legs on a snake...',
	'Playing the lute to a cow...',
	'Viewing flowers from horseback...',
	'Drawing cakes to satisfy hunger...',
	'Waiting by a tree stump for a rabbit...',
	'Covering our ears while stealing a bell...',
	'Pulling up seedlings to help them grow...',
	'Negotiating with a polyphonic character...',
	'Teaching old bookmarks new levels...',
	'Consulting the radical council...',
	'Counting strokes twice...',
	'Looking up how to look things up...',
	'Checking whether 行 is háng or xíng...',
	'Reuniting bookmarks with their HSK levels...',
	'Cross-referencing three HSK timelines...',
	'Giving levels seven through nine some personal space...',
	'Finding the measure word for migrations...',
] as const;

export const MESSAGE_ROTATION_INTERVAL_MS = 3000;

export function randomMessageIndex(
	length: number,
	previousIndex = -1,
	random = Math.random
): number {
	if (length < 2) {
		return 0;
	}

	if (previousIndex < 0 || previousIndex >= length) {
		return Math.floor(random() * length);
	}

	const index = Math.floor(random() * (length - 1));
	return index >= previousIndex ? index + 1 : index;
}
