export const MIGRATION_STATUS = {
	IDLE: 'idle',
	RUNNING: 'running',
	FAILED: 'failed',
} as const;

export type MigrationStatus = (typeof MIGRATION_STATUS)[keyof typeof MIGRATION_STATUS];

export type MigrationCopy = {
	title: string;
	detail: string;
};

export const BOOKMARK_MIGRATION_COPY: MigrationCopy = {
	title: 'Updating your bookmarks…',
	detail: 'This only needs to happen once.',
};

let status = $state<MigrationStatus>(MIGRATION_STATUS.IDLE);
let copy = $state<MigrationCopy>(BOOKMARK_MIGRATION_COPY);
let errorMessage = $state('');
let preview = $state(false);

export const databaseMigrationStore = {
	get status(): MigrationStatus {
		return status;
	},
	get active(): boolean {
		return status !== MIGRATION_STATUS.IDLE;
	},
	get title(): string {
		return copy.title;
	},
	get detail(): string {
		return copy.detail;
	},
	get errorMessage(): string {
		return errorMessage;
	},
	get isPreview(): boolean {
		return preview;
	},
	start(nextCopy: MigrationCopy): void {
		copy = nextCopy;
		errorMessage = '';
		preview = false;
		status = MIGRATION_STATUS.RUNNING;
	},
	startPreview(nextCopy: MigrationCopy): void {
		copy = nextCopy;
		errorMessage = '';
		preview = true;
		status = MIGRATION_STATUS.RUNNING;
	},
	finish(): void {
		status = MIGRATION_STATUS.IDLE;
		preview = false;
	},
	closePreview(): void {
		if (preview) {
			this.finish();
		}
	},
	fail(message: string): void {
		errorMessage = message;
		status = MIGRATION_STATUS.FAILED;
	},
	resetForTest(): void {
		status = MIGRATION_STATUS.IDLE;
		copy = BOOKMARK_MIGRATION_COPY;
		errorMessage = '';
		preview = false;
	},
};
