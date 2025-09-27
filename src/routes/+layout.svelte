<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import '../app.css';
	import { page } from '$app/state';
	import { goto, afterNavigate } from '$app/navigation';
	import Footer from '$lib/components/Footer.svelte';

	let { children } = $props();

	let searchQuery = $state('');
	let isBookPage = $state(false);

	$effect(() => {
		const query = page.url.searchParams.get('q');
		isBookPage = page.route.id == '/book';
		if (query) {
			searchQuery = query;
		}
	});

	afterNavigate((navigation) => {
		if (navigation.to?.route.id !== '/search') {
			searchQuery = '';
		}
	});

	function executeSearch() {
		if (!searchQuery.trim()) return;
		goto(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
	}

	function handleSearchKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			executeSearch();
		}
	}
</script>

{#if !isBookPage}
	<Header bind:searchQuery onSearchClick={executeSearch} onSearchKeydown={handleSearchKeydown} />
{/if}

{@render children()}

{#if !isBookPage}
	<Footer />
{/if}
