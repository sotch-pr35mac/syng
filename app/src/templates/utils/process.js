/*
 * Description: getArgument will get the value from a process argument in the format of --<arg_name>=<arg_value>
 * Param: name: String: The name of the argument to return
 * Return: String: The value of the provided argument, if any. If no argument found, returns undefined.
 */
export const getArgument = name => {
	return process.argv.filter(arg => arg.split('=')[0] == `--${name}`).map(arg => arg.split('=')[1])[0];
};

// underTest: Boolean: Is this environment driven by a Jest test
export const underTest = process.env.JEST_WORKER_ID !== undefined;
