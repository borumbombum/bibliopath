<!-- src/lib/components/Header.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { Bell, Heart, Menu, Origami, Search, Sun, Moon } from '@lucide/svelte';
	import { AppConfig, changeTheme } from '$lib';
	import { loadSavedBooks } from '$services/saved.services';
	import { offlineBookService } from '$services/offline.services';
	import { getOfflineBooksSorted } from '$lib/utils/offline.utils';

	let { searchQuery = $bindable(''), onSearchClick, onSearchKeydown } = $props();

	let totalBookCount = $state(0);
	let theme = $state('night'); // Default, will be overridden by loadSavedState
	let showSearch = $state(false);

	onMount(async () => {
		// Load theme from localStorage
		if (browser) {
			const savedTheme = localStorage.getItem('bibliopath-theme') || 'night';
			console.log(`Saved theme... ${savedTheme}`);
			// Apply theme immediately using the imported function
			changeTheme(savedTheme, false);
			theme = savedTheme; // Update local state variable for UI reactivity
		}

		// Load from all sources
		const savedBooks = loadSavedBooks();
		await offlineBookService.init();
		const offlineBooks = await getOfflineBooksSorted();

		// Merge and count unique books
		const bookMap = new Map<string, any>();

		savedBooks.forEach((book) => bookMap.set(book.url, book));
		offlineBooks.forEach((book) => {
			// Add only if it's not already in from savedBooks
			if (!bookMap.has(book.url)) {
				bookMap.set(book.url, book);
			}
		});

		totalBookCount = bookMap.size;
	});

	function toggleTheme() {
		const newTheme = theme === 'night' ? 'light' : 'night';
		theme = newTheme;
		changeTheme(newTheme, true);
	}

	function toggleSearch() {
		showSearch = !showSearch;
		// Clear search query when closing search
		if (!showSearch) {
			searchQuery = '';
		}
	}
</script>

<div class="bg-base-100 flex h-16 items-center justify-between px-4 shadow-sm" data-theme={theme}>
	<div class="flex flex-shrink-0 items-center">
		<!-- Hamburger menu (mobile only) -->
		<div class="dropdown lg:hidden">
			<div tabindex="0" role="button" aria-label="Open menu" class="btn btn-ghost btn-circle">
				<Menu class="h-5" />
			</div>
			<ul
				class="menu menu-sm dropdown-content bg-base-200 rounded-box border-base-300 z-10 mt-3 w-52 border p-2 shadow"
			>
				<li>
					<a href="/saved" class="flex gap-1">
						<Heart class="h-[15px] text-red-600" fill="red" />
						Saved ({totalBookCount})
					</a>
				</li>
				<div class="divider my-0"></div>
				<li><a href="/">Homepage</a></li>
				<li><a target="_blank" href={AppConfig.links.roadmap}>Roadmap</a></li>
				<li><a href="/p/about">About</a></li>
			</ul>
		</div>

		<!-- Logo -->
		<a class="btn btn-ghost ml-2 text-xl md:text-2xl" href="/">
			<Origami class="h-5 md:h-6" />
			Bibliopath
		</a>

		<!-- Desktop navigation (hidden on mobile) - Removed Saved link -->
		<nav class="ml-8 hidden items-center gap-1 lg:flex">
			<a href="/" class="btn btn-ghost btn-sm">Homepage</a>
			<a target="_blank" href={AppConfig.links.roadmap} class="btn btn-ghost btn-sm">Roadmap</a>
			<a href="/p/about" class="btn btn-ghost btn-sm">About</a>
		</nav>
	</div>

	<div class="hidden flex-1 justify-center sm:flex {showSearch ? 'mx-4' : ''}">
		{#if showSearch}
			<div class="form-control w-full max-w-4xl">
				<div class="relative">
					<!-- svelte-ignore a11y_autofocus -->
					<input
						id="search"
						type="text"
						placeholder="Search books, authors, subjects..."
						class="input input-bordered input-sm md:input-md w-full pr-12"
						bind:value={searchQuery}
						onkeydown={onSearchKeydown}
						autofocus
					/>
					<button
						class="btn btn-ghost btn-sm btn-square absolute top-1/2 right-2 z-10 -translate-y-1/2"
						onclick={onSearchClick}
						aria-label="Execute search"
					>
						<Search class="h-5" />
					</button>
				</div>
			</div>
		{/if}
	</div>

	<div class="flex flex-shrink-0 items-center gap-2">
		<!-- Saved Books Icon (now visible on all screen sizes) -->
		<a
			href="/saved"
			class="btn btn-ghost btn-circle"
			aria-label="View saved books"
			title="Saved books"
		>
			<div class="indicator">
				<Heart class="h-5 text-red-600" fill="red" />
				{#if totalBookCount > 0}
					<span class="badge badge-xs badge-primary indicator-item">{totalBookCount}</span>
				{/if}
			</div>
		</a>

		<!-- Search Toggle -->
		<button
			class="btn btn-ghost btn-circle hidden sm:flex"
			onclick={toggleSearch}
			aria-label="Toggle search"
			title="Search books"
		>
			<Search class="h-5" />
		</button>

		<!-- Theme Toggle -->
		<button
			class="btn btn-ghost btn-circle"
			onclick={toggleTheme}
			aria-label="Toggle theme"
			title={theme === 'night' ? 'Switch to light mode' : 'Switch to dark mode'}
		>
			{#if theme === 'night'}
				<Sun class="h-5" />
			{:else}
				<Moon class="h-5" />
			{/if}
		</button>

		<!-- Notifications -->
		<button aria-label="Notifications" class="btn btn-ghost btn-circle">
			<div class="indicator">
				<Bell class="h-5" />
				<span class="badge badge-xs badge-primary indicator-item">0</span>
			</div>
		</button>
	</div>
</div>

<!-- Mobile search bar (always visible) -->
<div class="rounded-none px-0 sm:hidden">
	<div class="relative w-full">
		<input
			id="search-mobile"
			type="text"
			placeholder="Search books, authors, subjects..."
			class="input w-full rounded-none border-x-0 pr-12"
			bind:value={searchQuery}
			onkeydown={onSearchKeydown}
		/>
		<button
			class="btn btn-ghost btn-sm btn-square absolute top-1/2 right-2 z-10 -translate-y-1/2"
			onclick={onSearchClick}
			aria-label="Execute mobile search"
		>
			<Search class="h-5" />
		</button>
	</div>
</div>
