import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
	const title = url.searchParams.get('title') || 'Unknown book title';
	const author = url.searchParams.get('author') || 'Unknown author';

	return { title, author };
};
