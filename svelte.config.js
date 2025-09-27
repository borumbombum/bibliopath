import adapter from '@sveltejs/adapter-auto';
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
		// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
		// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
		// See https://svelte.dev/docs/kit/adapters for more information about adapters.
		adapter: adapter(),
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
