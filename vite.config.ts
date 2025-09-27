import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		VitePWA({
			registerType: 'autoUpdate',
			devOptions: {
				enabled: true
			},
			includeAssets: ['favicon.svg', 'robots.txt', 'apple-touch-icon.png'],
			manifest: {
				name: 'Bilbiopath',
				short_name: 'AppShort',
				description: 'Bibliopath',
				theme_color: '#0F1729',
				icons: [
					{
						src: '/images/bibliopath-192x192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: '/images/bibliopath-512x512.png',
						sizes: '512x512',
						type: 'image/png'
					},
					{
						src: '/images/bibliopath-512x512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any maskable'
					}
				]
			}
		})
	]
});
