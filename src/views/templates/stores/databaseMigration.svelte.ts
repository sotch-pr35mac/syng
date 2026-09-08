export type MigrationStatus = 'idle' | 'running' | 'failed';

type MigrationCopy = {
	title: string;
	detail: string;
};

const DEFAULT_COPY: MigrationCopy = {
	title: 'Updating your data…',
	detail: 'This only needs to happen once.',
};

let status = $state<MigrationStatus>('idle');
let copy = $state<MigrationCopy>(DEFAULT_COPY);
let errorMessage = $state('');

export const databaseMigrationStore = {
	get status(): MigrationStatus {
		return status;
	},
	get active(): boolean {
		return status !== 'idle';
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
	start(nextCopy: MigrationCopy): void {
		copy = nextCopy;
		errorMessage = '';
		status = 'running';
	},
	finish(): void {
		status = 'idle';
	},
	fail(message: string): void {
		errorMessage = message;
		status = 'failed';
	},
	resetForTest(): void {
		status = 'idle';
		copy = DEFAULT_COPY;
		errorMessage = '';
	},
};
