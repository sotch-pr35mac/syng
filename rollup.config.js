import svelte from 'rollup-plugin-svelte';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';

const production = !process.env.ROLLUP_WATCH;

export default {
	input: 'src/views/templates/app.js',
	output: {
		sourcemap: true,
		format: 'iife',
		name: 'app',
		file: 'src/views/templates/build/bundle.js'
	},
	plugins: [
		svelte({
			// enable run-time checks when not in production
			dev: !production,
			// we'll extract any component CSS out into
			// a separate file -- better for performance
			css: css => {
				css.write('src/views/templates/build/bundle.css');
			}
		}),

		// If you have external dependencies installed from
		// npm, you'll most liekly need these plugins. In
		// some cases you'll need additional configuration --
		// consult the documentation for details:
		resolve({
			browser: true,
			dedupe: ['svelte']
		}),
		commonjs(),

		// In dev mode, call npm run start once
		// the budnle has been generated
		!production && serve(),

		// Watch the templates direction and refresh the
		// browser on changes when not in production
		!production && livereload('src/views/templates'),

		// If we're building for production minify
		production && terser()
	],
	watch: {
		clearScreen: false
	}
};

function serve() {
	let started = false;
	
	return {
		writeBundle() {
			if(!started) {
				started = true;

				require('child_process').spawn('npm', ['run', 'svelte-start', '--', '--dev'], {
					stdio: ['ignore', 'inherit', 'inherit'],
					shell: true
				});
			}
		}
	};
}
