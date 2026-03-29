import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { mdsvex } from 'mdsvex';
import path from 'path';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	extensions: ['.svelte', '.md'],
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: [vitePreprocess(), mdsvex({ extensions: ['.md'] })],

	kit: {
		adapter: adapter({
			fallback: '200.html'
		}),
		alias: {
			$utils: path.resolve('src/lib/utils'),
			$types: path.resolve('src/lib/type'),
			$services: path.resolve('src/lib/services')

			// $stores: path.resolve('src/lib/stores'),
			// $data: path.resolve('src/lib/data'),
			// $config: path.resolve('src/lib/config')
			// $types: path.resolve('src/lib/types.ts')
		}
	}
};

export default config;
