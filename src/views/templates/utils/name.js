/*
 * Description: Handle name conflict resolutions by adding a number to the end of the name
 * indicating how many lists have that name. If `Imported List` already exists,
 * `resolveNameConflicts` will return `Imported List 2`. If `Imported List 2` already exists
 * `resolveNameConflicts` will return `Imported List 3`. This behavior is only supported for
 * up to 98 iterations. At that point, `List name 100` will be returned regardless of the
 * conflict status.
 * Param: name: String: The name of the new item for conflict resolution to be performed on.
 * Param: list: Array<String>: The list of names to check conflicts against.
 * Return: String: The conflict-free name.
 */
export const resolveNameConflict = (name, list) => {
	let newName = name;
	let iter = 2;
	// Maximum number of resolution attempts.
	// `i` begins at 2 so up to 98 resolution
	// attempts are supported.
	const MAX_ITER = 100;

	while (list.includes(newName) && iter <= MAX_ITER) {
		newName = `${name} ${iter}`;
		iter++;
	}

	return newName;
};
