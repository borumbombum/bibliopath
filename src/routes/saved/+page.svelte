<!-- src/routes/saved/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { Trash2, Clock, ExternalLink, BookOpen, WifiOff, LayoutGrid, List } from '@lucide/svelte';
	import type { DisplayBook, SavedBook, OfflineBook } from '$lib/types';

	// Services
	import { loadSavedBooks, removeBook as removeBookService } from '$lib/services/saved.services';
	import { offlineBookService } from '$lib/services/offline.services';

	import {
		getOfflineBooksSorted,
		formatBytes,
		estimateContentSize
	} from '$lib/utils/offline.utils';
	import BookList from '$lib/components/BookList.svelte';

	let savedBooks: SavedBook[] = $state([]);
	let offlineBooks: OfflineBook[] = $state([]);
	let displayBooks: DisplayBook[] = $state([]);

	let loading = $state(true);
	let searchQuery = $state('');
	let showOfflineOnly = $state(false);
	let viewMode: 'grid' | 'list' = $state('list');

	onMount(async () => {
		try {
			// Load saved books from localStorage
			savedBooks = loadSavedBooks();

			// Initialize and load offline books from IndexedDB
			await offlineBookService.init();
			offlineBooks = await getOfflineBooksSorted();

			// Merge and deduplicate books
			mergeBooks();
		} catch (error) {
			console.error('Failed to load books:', error);
		} finally {
			loading = false;
		}
	});

	function mergeBooks() {
		const bookMap = new Map<string, DisplayBook>();

		// Add saved books
		savedBooks.forEach((book) => {
			bookMap.set(book.url, {
				id: book.id,
				title: book.title,
				author: book.author,
				url: book.url,
				fileType: book.fileType,
				savedAt: book.savedAt,
				lastRead: book.lastRead,
				isOffline: false
			});
		});

		// Add or merge offline books
		offlineBooks.forEach((book) => {
			const existing = bookMap.get(book.url);
			if (existing) {
				// Merge with existing saved book
				existing.isOffline = true;
				existing.downloadedAt = book.downloadedAt;
				existing.lastAccessed = book.lastAccessed;
				existing.contentSize = estimateContentSize(book.content);
			} else {
				// Add as offline-only book
				bookMap.set(book.url, {
					id: book.id,
					title: book.title,
					author: book.author,
					url: book.url,
					fileType: book.fileType,
					isOffline: true,
					downloadedAt: book.downloadedAt,
					lastAccessed: book.lastAccessed,
					contentSize: estimateContentSize(book.content)
				});
			}
		});

		displayBooks = Array.from(bookMap.values()).sort((a, b) => {
			// Sort by most recent activity (lastRead, lastAccessed, or savedAt)
			const aTime = Math.max(
				a.lastRead ? new Date(a.lastRead).getTime() : 0,
				a.lastAccessed || 0,
				a.savedAt ? new Date(a.savedAt).getTime() : 0
			);
			const bTime = Math.max(
				b.lastRead ? new Date(b.lastRead).getTime() : 0,
				b.lastAccessed || 0,
				b.savedAt ? new Date(b.savedAt).getTime() : 0
			);
			return bTime - aTime;
		});
	}

	// Derived reactive values
	const filteredBooks = $derived(
		displayBooks.filter((book) => {
			if (showOfflineOnly && !book.isOffline) return false;
			if (!searchQuery) return true;
			return (
				book.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
				book.author.toLowerCase().includes(searchQuery.toLowerCase())
			);
		})
	);

	const offlineCount = $derived(displayBooks.filter((b) => b.isOffline).length);
	const totalOfflineSize = $derived(
		displayBooks
			.filter((b) => b.isOffline && b.contentSize)
			.reduce((total, b) => total + (b.contentSize || 0), 0)
	);

	function generateBookUrl(book: DisplayBook): string {
		return `/book?book=${encodeURIComponent(book.url)}&type=${book.fileType}&author=${book.author}&title=${book.title}`;
	}

	async function handleRemoveBook(book: DisplayBook) {
		if (!confirm('Are you sure you want to remove this book from your library?')) {
			return;
		}

		try {
			// Remove from saved books if it exists there
			const savedBook = savedBooks.find((sb) => sb.url === book.url);
			if (savedBook) {
				removeBookService(savedBook.id);
				savedBooks = savedBooks.filter((sb) => sb.id !== savedBook.id);
			}

			// Remove from offline storage if it exists there
			if (book.isOffline) {
				await offlineBookService.removeBook(book.url);
				offlineBooks = offlineBooks.filter((ob) => ob.url !== book.url);
			}

			// Refresh the merged display
			mergeBooks();
		} catch (error) {
			console.error('Failed to remove book:', error);
			alert('Failed to remove book. Please try again.');
		}
	}

	function formatDate(dateString: string): string {
		return new Date(dateString).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}

	function getTimeAgo(timestamp: string | number): string {
		const now = new Date().getTime();
		const date = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
		const diffInMs = now - date;
		const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

		if (diffInDays === 0) return 'Today';
		if (diffInDays === 1) return 'Yesterday';
		if (diffInDays < 7) return `${diffInDays} days ago`;
		if (diffInDays < 30) return `${Math.floor(diffInDays / 7)} weeks ago`;
		return `${Math.floor(diffInDays / 30)} months ago`;
	}

	function getLastActivity(book: DisplayBook): { text: string; timestamp: number } {
		if (book.lastRead) {
			return {
				text: `Read ${getTimeAgo(book.lastRead)}`,
				timestamp: new Date(book.lastRead).getTime()
			};
		}
		if (book.lastAccessed) {
			return {
				text: `Accessed ${getTimeAgo(book.lastAccessed)}`,
				timestamp: book.lastAccessed
			};
		}
		if (book.savedAt) {
			return {
				text: `Saved ${getTimeAgo(book.savedAt)}`,
				timestamp: new Date(book.savedAt).getTime()
			};
		}
		return {
			text: 'Unknown',
			timestamp: 0
		};
	}
</script>

<svelte:head>
	<title>Saved Books - Bibliopath</title>
	<meta name="description" content="Your book library with offline support" />
</svelte:head>

<div class="bg-base-100 min-h-screen">
	<main class="container mx-auto max-w-6xl px-4 py-8">
		<!-- Header with stats and controls -->
		<div class="mb-8">
			<div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<h1 class="text-3xl font-bold">Your Library</h1>

				<div class="flex items-center gap-3">
					<div class="stats stats-horizontal w-full shadow-sm md:w-auto">
						<div class="stat px-4 py-2">
							<div class="stat-title text-xs">Total Books</div>
							<div class="stat-value text-lg">{displayBooks.length}</div>
						</div>
						{#if offlineCount > 0}
							<div class="stat px-4 py-2">
								<div class="stat-title text-xs">Offline</div>
								<div class="stat-value flex items-center gap-1 text-lg">
									<WifiOff size={16} />
									{offlineCount}
								</div>
								<div class="stat-desc text-xs">{formatBytes(totalOfflineSize)}</div>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Search and filters -->
			<div class="flex flex-col gap-4 sm:flex-row">
				<div class="form-control flex-1">
					<input
						type="text"
						placeholder="Filter your books..."
						class="input input-bordered w-full"
						bind:value={searchQuery}
					/>
				</div>

				<div class="flex items-center gap-2">
					{#if offlineCount > 0}
						<div class="form-control">
							<label class="label cursor-pointer">
								<span class="label-text mr-2">Offline only</span>
								<input type="checkbox" class="toggle toggle-primary" bind:checked={showOfflineOnly} />
							</label>
						</div>
					{/if}

					<div class="join">
						<button
							class="btn join-item"
							class:btn-active={viewMode === 'grid'}
							onclick={() => (viewMode = 'grid')}
							title="Grid view"
						>
							<LayoutGrid size={20} />
						</button>
						<button
							class="btn join-item"
							class:btn-active={viewMode === 'list'}
							onclick={() => (viewMode = 'list')}
							title="List view"
						>
							<List size={20} />
						</button>
					</div>
				</div>
			</div>
		</div>

		{#if loading}
			<div class="flex justify-center py-12">
				<span class="loading loading-spinner loading-lg"></span>
			</div>
		{:else if filteredBooks.length > 0}
			<!-- Books Grid -->
			{#if viewMode === 'grid'}
				<section class="mb-12">
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{#each filteredBooks as book (book.url)}
							<div class="card bg-base-200 shadow-sm transition-shadow hover:shadow-md">
								<div class="card-body p-4">
									<div class="mb-3 flex items-start justify-between">
										<div class="min-w-0 flex-1">
											<h3 class="mb-1 line-clamp-2 text-base leading-tight font-semibold">
												{book.title}
											</h3>
											<p class="text-base-content/70 truncate text-sm">
												by {book.author}
											</p>
										</div>
										<div class="ml-2 flex items-center gap-1">
											{#if book.isOffline}
												<div class="tooltip" data-tip="Available offline">
													<WifiOff size={14} class="text-success" />
												</div>
											{/if}
											<button
												class="btn btn-ghost btn-xs btn-circle"
												onclick={() => handleRemoveBook(book)}
												title="Remove from library"
											>
												<Trash2 size={14} />
											</button>
										</div>
									</div>

									<div class="text-base-content/60 mb-3 flex items-center gap-2 text-xs">
										<Clock size={12} />
										<span>{getLastActivity(book).text}</span>
										<span class="badge badge-xs badge-outline">
											{book.fileType}
										</span>
										{#if book.isOffline && book.contentSize}
											<span class="badge badge-xs badge-success">
												{formatBytes(book.contentSize)}
											</span>
										{/if}
									</div>

									<div class="card-actions justify-between">
										<a href={generateBookUrl(book)} class="btn btn-primary btn-sm flex-1">
											<BookOpen size={16} />
											{book.lastRead || book.lastAccessed ? 'Continue Reading' : 'Start Reading'}
										</a>
										<a
											href={book.url}
											target="_blank"
											rel="noopener noreferrer"
											class="btn btn-ghost btn-sm btn-square"
											title="Open original source"
										>
											<ExternalLink size={16} />
										</a>
									</div>
								</div>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			<!-- Books List -->
			{#if viewMode === 'list'}
				<section class="mb-12">
					<BookList
						books={filteredBooks}
						{handleRemoveBook}
						{generateBookUrl}
						{getLastActivity}
					/>
				</section>
			{/if}
		{:else if searchQuery || showOfflineOnly}
			<!-- No results for filter -->
			<section class="mb-12">
				<div class="card bg-base-200">
					<div class="card-body py-12 text-center">
						<BookOpen size={48} class="text-base-content/50 mx-auto mb-4" />
						<h3 class="mb-2 text-lg font-semibold">No Books Found</h3>
						<p class="text-base-content/70 mb-4">
							{#if searchQuery}
								No books match your search "{searchQuery}"
							{:else if showOfflineOnly}
								No offline books available
							{:else}
								Try a different search term
							{/if}
						</p>
						<button
							class="btn btn-outline btn-sm"
							onclick={() => {
								searchQuery = '';
								showOfflineOnly = false;
							}}
						>
							Clear Filters
						</button>
					</div>
				</div>
			</section>
		{:else}
			<!-- Empty state -->
			<section class="mb-12">
				<div class="card bg-base-200">
					<div class="card-body py-12 text-center">
						<BookOpen size={48} class="text-base-content/50 mx-auto mb-4" />
						<h3 class="mb-2 text-lg font-semibold">No Saved Books Yet</h3>
						<p class="text-base-content/70 mb-4">
							Start reading a book and click the heart icon to save it to your library
						</p>
					</div>
				</div>
			</section>
		{/if}

		<!-- Examples Section -->
		<section class="mb-12">
			<h2 class="mb-6 text-2xl font-bold">Try These Examples</h2>
			<div class="grid gap-4 md:grid-cols-2">
				<div class="card bg-base-200 shadow-sm">
					<div class="card-body">
						<h3 class="card-title text-lg">Project Gutenberg</h3>
						<p class="text-base-content/70 mb-4 text-sm">
							Classic literature from the public domain
						</p>
						<div class="space-y-2">
							<a
								href="/book?book=https://www.gutenberg.org/files/1342/1342-0.txt&type=text"
								class="btn btn-outline btn-sm w-full justify-start"
							>
								Pride and Prejudice by Jane Austen
							</a>
							<a
								href="/book?book=https://www.gutenberg.org/files/11/11-0.txt&type=text"
								class="btn btn-outline btn-sm w-full justify-start"
							>
								Alice's Adventures in Wonderland
							</a>
							<a
								href="/book?book=https://www.gutenberg.org/files/84/84-0.txt&type=text"
								class="btn btn-outline btn-sm w-full justify-start"
							>
								Frankenstein by Mary Shelley
							</a>
						</div>
					</div>
				</div>

				<div class="card bg-base-200 shadow-sm">
					<div class="card-body">
						<h3 class="card-title text-lg">Markdown Books</h3>
						<p class="text-base-content/70 mb-4 text-sm">
							Books formatted in Markdown with proper chapter structure
						</p>
						<div class="space-y-2">
							<div class="text-base-content/60 bg-base-300 rounded p-2 text-xs">
								Add your own Markdown book URLs above to get started
							</div>
						</div>
					</div>
				</div>
			</div>
		</section>
	</main>
</div>