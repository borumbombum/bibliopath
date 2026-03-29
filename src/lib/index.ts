import { browser } from '$app/environment';

// place files you want to import through the `$lib` alias in this folder.
export function changeTheme(newTheme: string, save = true) {
	console.log(`Changing theme... ${newTheme}`);
	if (browser) {
		document.documentElement.setAttribute('data-theme', newTheme);
		if (save) {
			localStorage.setItem('bibliopath-theme', newTheme);
		}
	}
	return newTheme;
}

export async function shareCurrentUrl() {
	if (navigator.share) {
		try {
			await navigator.share({
				title: document.title, // Or a custom title
				url: window.location.href // The current URL
			});
			console.log('Content shared successfully');
		} catch (error) {
			console.error('Error sharing:', error);
		}
	} else {
		// Fallback for browsers that don't support the Web Share API
		// You could offer to copy the URL to the clipboard,
		// open a new window with common sharing links, etc.
		alert(
			'Web Share API is not supported in this browser. You can manually copy the URL: ' +
				window.location.href
		);
		console.error('Web Share API not supported.');
	}
}

export const AppConfig = {
	base_index_url: 'https://gutendex.com/books',
	books_per_page: 32,
	links: {
		about: '/p/about',
		roadmap: 'https://github.com/borumbombum/bibliopath?tab=readme-ov-file#core-functionalities',
		nostr:
			'https://primal.net/p/nprofile1qqs8wftkcz9achdy8ascqtnk0v3rrcevda2klm8wqyd6xrlk8skc22gekra89',
		donate: 'https://zapme.coffee/#npub1wujhdsytm3w6g0mpsqh8v7ezx83jcm64dlkwuqgm5v8lv0pds55ssudkw0'
	}
};
