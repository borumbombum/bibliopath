<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.meta.title}</title>
</svelte:head>

<article class="prose prose-neutral mx-auto max-w-4xl px-4 py-8 lg:max-w-5xl lg:px-8 xl:px-16">
	<h1>{data.meta.title}</h1>
	<div class="space-y-6">
		{@render data.content()}
	</div>
</article>
