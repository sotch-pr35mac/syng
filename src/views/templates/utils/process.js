import { getMatches } from '@tauri-apps/plugin-cli';

const getArgs = async () => {
	try {
		const matches = await getMatches();
		return matches.subcommand?.name === 'run' ? matches.subcommand.matches.args : matches.args;
	} catch (e) {
		console.error(e);
		return {};
	}
};

/*
 * Description: inDebugMode will true when running Syng in development mode (make start v. make start-prod)
 * Return: Boolean: true if --debug is a process argument and false otherwise
 */
export const inDebugMode = async () => 'debug' in await getArgs();

/*
 * Description: getArgument will get the value from a process argument in the format of --<arg_name>=<arg_value>
 * Param: name: String: The name of the argument to return
 * Return: String: The value of the provided argument, if any. If no argument found, returns undefined.
 */
export const getArgument = async name => {
	const args = await getArgs();
	return args.filter(arg => arg.split('=')[0] == name).map(arg => arg.split('=')[1])[0];
};

// underTest: Boolean: Is this environment driven by a test runner (Jest or Vitest)
export const underTest = typeof (process) !== 'undefined' && process !== null ? (process.env.JEST_WORKER_ID !== undefined || process.env.VITEST !== undefined) : false;