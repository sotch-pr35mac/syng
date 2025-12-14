 
import { resolveNameConflict } from './name.js';

it('should return the name if it is not in the list', async () => {
	const name = 'name';
	const list = ['a', 'b', 'c'];
	expect(resolveNameConflict(name, list)).toBe(name);
});
it('should return the name with a number appended if it is in the list', async () => {
	const name = 'name';
	const list = ['a', 'b', 'c', 'name'];
	expect(resolveNameConflict(name, list)).toBe('name 2');
});
it('should return the name with a higher iteration if it is still in the list', async () => {
	const name = 'name';
	const list = ['a', 'b', 'c', 'name', 'name 2'];
	expect(resolveNameConflict(name, list)).toBe('name 3');
});
it('should return the maximum name if the maximum number of iterations is reached', async () => {
	const name = 'name';
	const list = ['name', ...Array.from({ length: 99 }, (_, i) => `name ${i + 2}`)];
	expect(resolveNameConflict(name, list)).toBe('name 100');
});