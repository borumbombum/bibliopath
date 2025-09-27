import { error } from '@sveltejs/kit';

export const prerender = true;

export async function entries() {
	const modules = import.meta.glob('../../../lib/content/pages/*.md');

	const entries = await Promise.all(
		Object.entries(modules).map(async ([path]) => {
			const slug = path.split('/').pop()?.slice(0, -3);
			return { pageSlug: slug };
		})
	);

	return entries;
}

export async function load({ params }) {
	try {
		const { pageSlug } = params;
		const post = await import(`../../../lib/content/pages/${pageSlug}.md`);

		return {
			content: post.default,
			meta: post.metadata
		};
	} catch (e) {
		error(404, 'Page not found');
	}
}
