<!-- src/routes/book/+page.svelte -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { browser } from '$app/environment';
	import {
		BookOpen,
		Menu,
		X,
		Settings,
		ChevronLeft,
		CircleX,
		RotateCcw,
		Volume2,
		Info,
		Heart,
		Download,
		Trash2,
		Wifi,
		WifiOff,
		EllipsisVertical,
		Bookmark
	} from '@lucide/svelte';
	import { page } from '$app/state';
	import { changeTheme, shareCurrentUrl } from '$lib';
	import { HTTP_STATUS_TEXT, type BookFileType, type Chapter, type SavedBook } from '$lib/types';
	import { loadSavedBooks, saveBook, removeBook } from '$lib/services/saved.services';
	import { offlineBookService } from '$lib/services/offline.services';
	import { getOfflineStats, isOfflineStorageSupported } from '$lib/utils/offline.utils';

	// --- Props ---
	let { data }: { data: { title: string; author: string } } = $props();

	// --- State (Reactive using Runes) ---
	let loading = $state(true);
	let error = $state(false);
	let errorDetails = $state('');
	let chapters: Chapter[] = $state([]);
	let currentChapterIndex = $state(0);
	let fontSize = $state(18);
	let theme = $state('dark'); // Default, will be overridden by loadSavedState

	let showSidebar = $state(false);
	let readingProgress = $state(0);
	let savedBooks: SavedBook[] = $state([]);
	let isBookSaved = $state(false);
	let readerContainer: HTMLDivElement | null = $state(null);
	let chapterElements: HTMLDivElement[] = $state([]);
	let fileType: BookFileType = $state('markdown');

	// --- Offline functionality state ---
	let isBookDownloaded = $state(false);
	let isDownloading = $state(false);
	let isLoadedFromOffline = $state(false);
	let bookContent = $state(''); // Store raw book content
	let offlineStats = $state({ count: 0, totalSize: '0 Bytes', totalSizeBytes: 0 });

	// --- IMPROVED: Position Tracking State ---
	let currentPosition = $state<{
		scrollPercentage: number;
		textPosition: number;
		chapterIndex: number;
		paragraphIndex: number;
		timestamp: number;
	} | null>(null);
	let showBookmarkIndicator = $state(false);
	let showRestorePrompt = $state(false);
	let savedPosition = $state<any>(null);
	let isRestoringPosition = $state(false);
	let positionTrackingEnabled = $state(true);
	let lastScrollUpdate = $state(0);

	// Font size effect for mobile fix
	$effect(() => {
		if (browser && readerContainer) {
			// Force a style recalculation on mobile
			readerContainer.style.fontSize = `${fontSize}px`;

			// Update CSS custom property
			document.documentElement.style.setProperty('--reading-font-size', `${fontSize}px`);

			// Force reflow on mobile devices
			const isMobile = window.innerWidth <= 768;
			if (isMobile) {
				readerContainer.offsetHeight; // Trigger reflow
			}
		}
	});

	// --- Lifecycle ---
	onMount(async () => {
		try {
			// Stop any potential previous speech if component reloads
			if (typeof window !== 'undefined' && window.speechSynthesis) {
				window.speechSynthesis.cancel();
			}

			// Initialize IndexedDB
			await offlineBookService.init();

			if (browser) {
				// Load theme first to prevent flash and apply immediately
				const savedTheme = localStorage.getItem('bibliopath-theme') || 'dark';
				console.log(`Saved theme... ${savedTheme}`);
				// Apply theme immediately using the imported function
				changeTheme(savedTheme, false);
				theme = savedTheme; // Update local state variable for UI reactivity
			}

			// Get URL parameters
			const bookUrl = page.url.searchParams.get('book');
			fileType = (page.url.searchParams.get('type') || 'markdown') as BookFileType;

			if (!bookUrl) {
				console.error('No book URL provided');
				throw new Error('No book URL provided');
			}

			// Check if book is already downloaded offline
			isBookDownloaded = await offlineBookService.isBookDownloaded(bookUrl);

			let text: string;

			// Try to load from offline storage first, as all book types can be stored there.
			if (isBookDownloaded) {
				const offlineBook = await offlineBookService.getBook(bookUrl);

				if (offlineBook) {
					text = offlineBook.content;
					isLoadedFromOffline = true;
					bookContent = text;
					console.log('📖 Loaded book from offline storage');
				} else {
					// This is an inconsistent state. The book was detected but couldn't be retrieved.
					// For EPUBs, this is a fatal error as they can't be fetched from a network.
					if (fileType === 'epub') {
						throw new Error(
							'Inconsistent state: EPUB book metadata found, but content is missing from offline storage.'
						);
					}
					// For other types, we can try to fall back to a network fetch.
					console.warn(
						'Inconsistent state: Book was marked as downloaded, but not found. Fetching from network.'
					);
					isLoadedFromOffline = false;
					text = await fetchBookFromNetwork(bookUrl);
				}
			} else {
				// If the book is not in offline storage...
				if (fileType === 'epub') {
					// EPUBs *must* be in offline storage because they are uploaded by the user.
					// They don't have a remote URL to fetch from.
					throw new Error(
						'EPUB content not found in offline storage. Please upload the file again.'
					);
				} else {
					// For other book types, fetch them from their remote URL.
					text = await fetchBookFromNetwork(bookUrl);
				}
			}

			// Parse content based on file type
			let parsedChapters: Chapter[] = [];
			if (fileType === 'markdown') {
				parsedChapters = parseMarkdown(text);
			} else {
				parsedChapters = parsePlainText(text);
			}
			chapters = parsedChapters;

			// Load saved state from localStorage
			loadOtherSavedState();
			loadSavedBooksState();

			// Load offline stats
			if (isOfflineStorageSupported()) {
				offlineStats = await getOfflineStats();
			}

			loading = false;
			await tick(); // Wait for DOM to render

			// Setup improved position tracking
			setupPositionTracking();

			// Check for saved position
			checkForSavedPosition();
		} catch (err) {
			console.error('Error loading book:', err);
			error = true;
			errorDetails = err as string;
			loading = false;
		}
	});

	// --- Network fetch function ---
	async function fetchBookFromNetwork(bookUrl: string): Promise<string> {
		let text: string;
		if (fileType === 'markdown') {
			const response = await fetch(bookUrl);
			if (!response.ok) {
				const statusText = HTTP_STATUS_TEXT[response.status] || 'Unknown Error';
				throw new Error(`Failed to fetch markdown book content: ${response.status} ${statusText}`);
			}
			text = await response.text();
		} else {
			// Use proxy for other files (like Project Gutenberg)
			const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(bookUrl)}`;
			const response = await fetch(proxyUrl);
			if (!response.ok)
				throw new Error(`Failed to fetch text book content via proxy: ${response.status}`);
			text = await response.text();
		}

		bookContent = text; // Store the raw content
		return text;
	}

	// --- Offline functionality ---
	async function downloadBookOffline() {
		const bookUrl = page.url.searchParams.get('book');
		if (!bookUrl || !bookContent) {
			alert('Cannot download: Book content not available');
			return;
		}

		isDownloading = true;
		try {
			await offlineBookService.saveBook({
				title: data.title,
				author: data.author,
				url: bookUrl,
				fileType: fileType,
				content: bookContent
			});

			isBookDownloaded = true;
			console.log('📚 Book downloaded for offline reading');

			// Update offline stats
			offlineStats = await getOfflineStats();

			// Show success message
			if (browser) {
				// Simple success indication - you could replace with a toast notification
				const originalTitle = document.title;
				document.title = '✓ Downloaded - ' + originalTitle;
				setTimeout(() => {
					document.title = originalTitle;
				}, 2000);
			}
		} catch (error) {
			console.error('Failed to download book:', error);
			alert('Failed to download book for offline reading');
		} finally {
			isDownloading = false;
		}
	}

	async function removeOfflineBook() {
		const bookUrl = page.url.searchParams.get('book');
		if (!bookUrl) return;

		try {
			await offlineBookService.removeBook(bookUrl);
			isBookDownloaded = false;
			// Update offline stats
			offlineStats = await getOfflineStats();
			console.log('🗑️ Offline book removed');
		} catch (error) {
			console.error('Failed to remove offline book:', error);
			alert('Failed to remove offline book');
		}
	}

	// --- Helper Functions for Parsing ---
	function parseMarkdown(text: string): Chapter[] {
		const parsedChapters: Chapter[] = [];
		const headingRegex = /^(#{1,3})\s+(.*)$/gm;
		const parts = text.split(headingRegex);

		// Content before first heading
		if (parts[0]?.trim()) {
			parsedChapters.push({
				title: 'Introduction',
				level: 0,
				paragraphs: formatParagraphs(parts[0])
			});
		}

		// Process heading groups (level marker, title, content)
		for (let i = 1; i < parts.length; i += 3) {
			const levelMarker = parts[i];
			const title = parts[i + 1]?.trim();
			const content = parts[i + 2];

			if (title) {
				const level = levelMarker ? levelMarker.length : 0;
				parsedChapters.push({
					title,
					level,
					paragraphs: content ? formatParagraphs(content) : []
				});
			}
		}
		return parsedChapters;
	}

	function parsePlainText(text: string): Chapter[] {
		const parsedChapters: Chapter[] = [];
		const chapterRegex = /^(CHAPTER [IVX]+\.?.*$)/gm;
		const rawChapters = text.split(chapterRegex);

		// Content before first chapter
		if (rawChapters[0]?.trim()) {
			parsedChapters.push({
				title: 'Beginning',
				level: 0,
				paragraphs: formatParagraphs(rawChapters[0])
			});
		}

		// Process chapter pairs (title, content)
		for (let i = 1; i < rawChapters.length; i += 2) {
			const title = rawChapters[i]?.trim();
			const content = rawChapters[i + 1];

			if (title && content?.trim()) {
				parsedChapters.push({
					title,
					level: 0, // Plain text chapters don't have nested levels
					paragraphs: formatParagraphs(content)
				});
			}
		}
		return parsedChapters;
	}

	function formatParagraphs(content: string) {
		return content
			.split(/\n\s*\n/)
			.map((p) => p.trim().replace(/\s+/g, ' '))
			.filter((p) => p.length > 0);
	}

	// --- Inline Markdown Rendering ---
	function renderMarkdownInline(text: string): string {
		if (!text) return '';
		// Correctly escape HTML entities FIRST
		let escapedText = text.replace(/&/g, '&amp;').replace(/</g, '<').replace(/>/g, '>');
		// Then apply Markdown transformations
		return escapedText
			.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold **text**
			.replace(/__(.*?)__/g, '<strong>$1</strong>') // Bold __text__
			.replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic *text*
			.replace(/_(.*?)_/g, '<em>$1</em>'); // Italic _text_
	}

	// --- State Management (LocalStorage) ---
	function loadOtherSavedState() {
		if (!browser) return;

		const savedFontSize = localStorage.getItem('bookstr-fontsize');
		if (savedFontSize) fontSize = parseInt(savedFontSize, 10);
	}

	function loadSavedBooksState() {
		if (!browser) return;

		const books = loadSavedBooks();
		savedBooks = books;
		const currentBookUrl = page.url.searchParams.get('book');
		if (currentBookUrl) {
			isBookSaved = savedBooks.some((book) => book.url === currentBookUrl);
		}
	}

	function handleSaveBook() {
		const bookUrl = page.url.searchParams.get('book');
		if (!bookUrl) {
			alert('No book URL found to save');
			return;
		}

		const bookToSave = {
			title: data.title,
			author: data.author,
			url: bookUrl,
			fileType: fileType
		};

		saveBook(bookToSave);
		isBookSaved = true;
	}

	function handleRemoveBook() {
		const bookUrl = page.url.searchParams.get('book');
		if (!bookUrl) return;

		removeBook(bookUrl);
		isBookSaved = false;
	}

	// --- IMPROVED: Position Tracking System ---
	function getBookKey(): string {
		const bookUrl = page.url.searchParams.get('book');
		return `bookstr-position-v2-${bookUrl ? btoa(bookUrl).replace(/[^a-zA-Z0-9]/g, '') : 'default'}`;
	}

	function calculateTextPosition(): number {
		if (!readerContainer) return 0;

		// Get all text content up to the current scroll position
		const scrollTop = readerContainer.scrollTop;
		const viewportHeight = readerContainer.clientHeight;
		const currentViewTop = scrollTop + viewportHeight * 0.3; // 30% from top of viewport

		let textPosition = 0;
		let totalTextLength = 0;

		// Calculate total text length and position
		chapters.forEach((chapter, chapterIndex) => {
			chapter.paragraphs.forEach((paragraph, paragraphIndex) => {
				const element = document.querySelector(
					`[data-chapter-index="${chapterIndex}"] [data-paragraph-index="${paragraphIndex}"]`
				) as HTMLElement;

				if (element) {
					const elementTop = element.offsetTop;
					const elementHeight = element.offsetHeight;
					const elementBottom = elementTop + elementHeight;

					// If this element is above our current reading position
					if (elementBottom < currentViewTop) {
						textPosition += paragraph.length;
					} else if (elementTop < currentViewTop && elementBottom > currentViewTop) {
						// We're partially through this paragraph
						const partialProgress = (currentViewTop - elementTop) / elementHeight;
						textPosition += Math.floor(paragraph.length * partialProgress);
					}
				}

				totalTextLength += paragraph.length;
			});
		});

		return Math.min(textPosition, totalTextLength);
	}

	function findChapterAndParagraphFromTextPosition(textPosition: number): {
		chapterIndex: number;
		paragraphIndex: number;
	} {
		let currentTextLength = 0;

		for (let chapterIndex = 0; chapterIndex < chapters.length; chapterIndex++) {
			const chapter = chapters[chapterIndex];
			for (let paragraphIndex = 0; paragraphIndex < chapter.paragraphs.length; paragraphIndex++) {
				const paragraph = chapter.paragraphs[paragraphIndex];
				if (currentTextLength + paragraph.length > textPosition) {
					return { chapterIndex, paragraphIndex };
				}
				currentTextLength += paragraph.length;
			}
		}

		// Return last paragraph if we've gone past the end
		return {
			chapterIndex: Math.max(0, chapters.length - 1),
			paragraphIndex: Math.max(0, chapters[chapters.length - 1]?.paragraphs.length - 1 || 0)
		};
	}

	function saveCurrentPosition() {
		if (!browser || !readerContainer || !positionTrackingEnabled || isRestoringPosition) return;

		try {
			const scrollPercentage = getScrollPercentage();
			const textPosition = calculateTextPosition();
			const { chapterIndex, paragraphIndex } =
				findChapterAndParagraphFromTextPosition(textPosition);

			const positionData = {
				scrollPercentage,
				textPosition,
				chapterIndex,
				paragraphIndex,
				timestamp: Date.now(),
				chapterTitle: chapters[chapterIndex]?.title || '',
				bookTitle: data.title
			};

			localStorage.setItem(getBookKey(), JSON.stringify(positionData));
			currentPosition = positionData;

			// Throttled console logging
			const now = Date.now();
			if (now - lastScrollUpdate > 2000) {
				// Log every 2 seconds max
				console.log(
					`📍 Position saved: ${scrollPercentage.toFixed(1)}% | Chapter: ${chapterIndex + 1} | Text pos: ${textPosition}`
				);
				lastScrollUpdate = now;
			}
		} catch (e) {
			console.error('Failed to save position:', e);
		}
	}

	function getScrollPercentage(): number {
		if (!readerContainer) return 0;
		const { scrollTop, scrollHeight, clientHeight } = readerContainer;
		const maxScroll = scrollHeight - clientHeight;
		return maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
	}

	function restorePosition(position: any) {
		if (!browser || !readerContainer || !position) return;

		isRestoringPosition = true;
		positionTrackingEnabled = false;

		try {
			// Method 1: Try to restore using scroll percentage (most reliable)
			if (position.scrollPercentage !== undefined) {
				const { scrollHeight, clientHeight } = readerContainer;
				const maxScroll = scrollHeight - clientHeight;
				const targetScroll = (position.scrollPercentage / 100) * maxScroll;

				readerContainer.scrollTop = targetScroll;
				console.log(`📍 Restored to scroll position: ${position.scrollPercentage.toFixed(1)}%`);
			}

			// Method 2: Also try to scroll to the specific paragraph as backup
			if (position.chapterIndex !== undefined && position.paragraphIndex !== undefined) {
				setTimeout(() => {
					const paragraphElement = document.querySelector(
						`[data-chapter-index="${position.chapterIndex}"] [data-paragraph-index="${position.paragraphIndex}"]`
					) as HTMLElement;

					if (paragraphElement) {
						// Don't override if scroll percentage method worked well
						const currentScrollPercentage = getScrollPercentage();
						const targetScrollPercentage = position.scrollPercentage || 0;
						const scrollDifference = Math.abs(currentScrollPercentage - targetScrollPercentage);

						// Only adjust if we're significantly off
						if (scrollDifference > 5) {
							paragraphElement.scrollIntoView({ behavior: 'auto', block: 'start' });
							console.log(
								`📍 Fine-tuned position to paragraph: Chapter ${position.chapterIndex + 1}, Paragraph ${position.paragraphIndex + 1}`
							);
						}
					}
				}, 100);
			}

			currentChapterIndex = position.chapterIndex || 0;
			showSidebar = false;
		} catch (e) {
			console.error('Failed to restore position:', e);
		} finally {
			// Re-enable position tracking after restoration
			setTimeout(() => {
				isRestoringPosition = false;
				positionTrackingEnabled = true;
			}, 1000);
		}
	}

	function setupPositionTracking() {
		if (!browser || !readerContainer) return;

		// Throttled scroll handler for performance
		let scrollTimeout: number;
		const throttledSavePosition = () => {
			if (scrollTimeout) clearTimeout(scrollTimeout);
			scrollTimeout = setTimeout(saveCurrentPosition, 300); // Save position 300ms after scroll stops
		};

		readerContainer.addEventListener('scroll', throttledSavePosition);

		// Also save position periodically during reading
		// const positionSaveInterval = setInterval(() => {
		// 	if (positionTrackingEnabled && !isRestoringPosition) {
		// 		saveCurrentPosition();
		// 	}
		// }, 2000); // Every 2 seconds

		// // Cleanup function
		// return () => {
		// 	if (scrollTimeout) clearTimeout(scrollTimeout);
		// 	clearInterval(positionSaveInterval);
		// 	readerContainer?.removeEventListener('scroll', throttledSavePosition);
		// };
	}

	function checkForSavedPosition() {
		if (!browser) return;

		try {
			const saved = localStorage.getItem(getBookKey());
			if (saved) {
				const positionData = JSON.parse(saved);
				const timeDiff = Date.now() - positionData.timestamp;

				// Show prompt if the save is recent (within 7 days) and not at the very start
				if (
					timeDiff < 7 * 24 * 60 * 60 * 1000 &&
					positionData.scrollPercentage > 5 // More than 5% through the book
				) {
					savedPosition = positionData;
					acceptRestore();
					// showRestorePrompt = true;
				}
			}
		} catch (e) {
			console.error('Failed to check saved position:', e);
		}
	}

	function acceptRestore() {
		if (savedPosition) {
			restorePosition(savedPosition);
		}
		showRestorePrompt = false;
	}

	function declineRestore() {
		showRestorePrompt = false;
		// Start fresh - clear the saved position
		try {
			localStorage.removeItem(getBookKey());
		} catch (e) {
			console.error('Failed to clear saved position:', e);
		}
	}

	// Manual bookmark function
	function saveBookmarkAtCurrentPosition() {
		if (!browser || !readerContainer) return;

		const scrollPercentage = getScrollPercentage();
		const textPosition = calculateTextPosition();
		const { chapterIndex, paragraphIndex } = findChapterAndParagraphFromTextPosition(textPosition);

		saveCurrentPosition(); // This will save current position

		// Show user feedback
		showBookmarkIndicator = true;
		setTimeout(() => {
			showBookmarkIndicator = false;
		}, 2000);

		console.log(`🔖 Manual bookmark saved at ${scrollPercentage.toFixed(1)}%`);
	}

	// --- Scrolling and Chapter Tracking ---
	function goToChapter(chapterIndex: number, behavior: ScrollBehavior = 'smooth') {
		const targetElement = chapterElements[chapterIndex];
		if (targetElement) {
			isRestoringPosition = true;
			positionTrackingEnabled = false;

			targetElement.scrollIntoView({ behavior, block: 'start' });
			showSidebar = false;
			currentChapterIndex = chapterIndex;

			// Re-enable position tracking after navigation
			setTimeout(
				() => {
					isRestoringPosition = false;
					positionTrackingEnabled = true;
				},
				behavior === 'smooth' ? 1000 : 100
			);
		}
	}

	function handleScroll() {
		if (!readerContainer) return;

		const { scrollTop, scrollHeight, clientHeight } = readerContainer;
		const scrollableHeight = scrollHeight - clientHeight;
		readingProgress = scrollableHeight > 0 ? (scrollTop / scrollableHeight) * 100 : 0;

		// Update current chapter based on scroll position
		if (!isRestoringPosition) {
			updateCurrentChapter();
		}
	}

	function updateCurrentChapter() {
		if (!readerContainer) return;

		const scrollTop = readerContainer.scrollTop + readerContainer.clientHeight * 0.3;

		for (let i = chapterElements.length - 1; i >= 0; i--) {
			const element = chapterElements[i];
			if (element && element.offsetTop <= scrollTop) {
				currentChapterIndex = i;
				break;
			}
		}
	}

	// --- Settings ---
	function changeFontSize(newSize: number) {
		fontSize = newSize;
		if (browser) {
			try {
				localStorage.setItem('bookstr-fontsize', fontSize.toString());

				// Force update CSS custom property
				document.documentElement.style.setProperty('--reading-font-size', `${fontSize}px`);

				// Force re-render on mobile
				if (readerContainer) {
					readerContainer.style.fontSize = `${fontSize}px`;
					// Trigger a reflow to ensure the change takes effect
					readerContainer.offsetHeight;
				}
			} catch (e) {
				console.error('Failed to save font size to localStorage:', e);
			}
		}
	}

	// --- UI Interactions ---
	function showAudioSoonAlert() {
		alert('Audio feature coming soon!');
	}
</script>

<svelte:head>
	<title>{data.title} by {data.author} - Bibliopath</title>
</svelte:head>

<div class="drawer lg:drawer-open min-h-screen" data-theme={theme}>
	<!-- Drawer toggle -->
	<input id="sidebar-drawer" type="checkbox" class="drawer-toggle" bind:checked={showSidebar} />

	<!-- Drawer sidebar -->
	<div class="drawer-side z-40">
		<label for="sidebar-drawer" class="drawer-overlay"></label>
		<aside class="bg-base-200 min-h-full w-80 p-6">
			<!-- Sidebar header -->
			<div class="border-base-300 mb-6 flex items-center justify-between border-b pb-4">
				<h2 class="text-lg font-semibold">Table of Contents</h2>
				<button class="btn btn-sm btn-ghost md:hidden" onclick={() => (showSidebar = false)}>
					<X size={18} />
				</button>
				<button onclick={() => window.history.back()} class="btn btn-xs btn-primary">
					<ChevronLeft size={18} /> Back
				</button>
			</div>

			<!-- Connection status indicator -->
			{#if isLoadedFromOffline}
				<div class="alert alert-info mb-4 py-2">
					<WifiOff size={16} />
					<span class="text-sm">Reading offline</span>
				</div>
			{:else}
				<div class="alert alert-success mb-4 py-2">
					<Wifi size={16} />
					<span class="text-sm">Online</span>
				</div>
			{/if}

			<!-- Current position indicator -->
			<!-- {#if currentPosition}
				<div class="alert alert-info mb-4 py-2">
					<Bookmark size={16} />
					<div class="text-sm">
						<div>Reading: {currentPosition.chapterTitle}</div>
						<div class="text-xs opacity-75">
							{currentPosition.scrollPercentage.toFixed(1)}% through book
						</div>
					</div>
				</div>
			{/if} -->

			<!-- Offline storage stats -->
			{#if offlineStats.count > 0}
				<div class="stats stats-vertical mb-4 w-full text-xs">
					<div class="stat py-2">
						<div class="stat-title text-xs">Offline Books</div>
						<div class="stat-value text-lg">{offlineStats.count}</div>
						<div class="stat-desc">{offlineStats.totalSize} stored</div>
					</div>
				</div>
			{/if}

			<!-- Chapter list -->
			<div class="mb-6 space-y-1">
				{#each chapters as chapter, index (index)}
					<button
						class="btn btn-ghost h-auto w-full justify-start px-4 py-3 text-left
                               {index === currentChapterIndex ? 'btn-primary' : ''}
                               {chapter.level === 1
							? 'pl-4 font-bold'
							: chapter.level === 2
								? 'pl-8'
								: chapter.level === 3
									? 'pl-12'
									: 'pl-4'}"
						onclick={() => goToChapter(index)}
					>
						<span class="truncate">
							{chapter.title}
						</span>
					</button>
				{/each}
			</div>
		</aside>
	</div>

	<!-- Main content -->
	<div class="drawer-content flex flex-col">
		<!-- Header -->
		<header class="navbar bg-base-200 border-base-300 sticky top-0 z-30 border-b shadow-sm">
			<div class="navbar-start">
				<label for="sidebar-drawer" class="btn btn-square btn-ghost lg:hidden">
					<Menu size={20} />
				</label>
				<div class="ml-4 flex-1 overflow-hidden">
					<h1 title={data.title} class="line-clamp-2 text-base leading-tight font-bold md:text-lg">
						{data.title}
					</h1>
					<!-- Full info modal -->
					<dialog id="my_modal_2" class="modal">
						<div class="modal-box">
							<p class="py-4">{data.title}</p>
							by
							<p class="py-4 text-sm italic">{data.author}</p>
						</div>
						<form method="dialog" class="modal-backdrop">
							<button>close</button>
						</form>
					</dialog>
					<p class="text-base-content/70 hidden truncate text-sm sm:block">by {data.author}</p>
				</div>
			</div>
			<div class="navbar-end gap-0 md:gap-2">
				<!-- Manual bookmark button -->
				<div class="tooltip tooltip-bottom" data-tip="Bookmark current position">
					<button class="btn btn-ghost btn-circle" onclick={saveBookmarkAtCurrentPosition}>
						<Bookmark size={20} />
					</button>
				</div>

				<!-- Download/Remove offline book button -->
				{#if !loading && !error && bookContent}
					{#if isBookDownloaded}
						<div class="dropdown dropdown-end">
							<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
							<div class="tooltip tooltip-bottom" data-tip="Save locally">
								<label tabindex="0" class="btn btn-ghost btn-circle">
									<Download size={20} class="text-success" />
								</label>
							</div>
							<div
								class="dropdown-content card card-compact bg-base-100 border-base-300 z-[1] w-48 border p-2 shadow"
							>
								<div class="card-body">
									<p class="text-success mb-2 text-sm">✓ Available offline</p>
									<button
										class="btn btn-sm btn-error btn-outline w-full"
										onclick={removeOfflineBook}
										title="Remove offline copy"
									>
										<Trash2 size={16} />
										Remove offline
									</button>
								</div>
							</div>
						</div>
					{:else}
						<div class="tooltip tooltip-bottom" data-tip="Download for offline reading">
							<button
								class="btn btn-ghost btn-circle"
								onclick={downloadBookOffline}
								disabled={isDownloading}
							>
								{#if isDownloading}
									<div class="loading loading-spinner loading-sm"></div>
								{:else}
									<Download size={20} />
								{/if}
							</button>
						</div>
					{/if}
				{:else}
					<!-- Disabled download button when book isn't loaded -->
					<div class="tooltip tooltip-bottom" data-tip="Download unavailable">
						<button class="btn btn-ghost btn-circle" disabled>
							<Download size={20} class="opacity-30" />
						</button>
					</div>
				{/if}

				<!-- Save/Remove book button -->
				<button
					class="btn btn-ghost btn-circle"
					onclick={isBookSaved ? handleRemoveBook : handleSaveBook}
					title={isBookSaved ? 'Remove from Library' : 'Save to Library'}
				>
					{#if isBookSaved}
						<Heart size={20} class="fill-current text-red-500" />
					{:else}
						<Heart size={20} />
					{/if}
				</button>

				<!-- Settings dropdown -->
				<div class="dropdown dropdown-end">
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<label tabindex="0" class="btn btn-ghost btn-circle">
						<Settings size={20} />
					</label>
					<div
						class="dropdown-content card card-compact bg-base-100 border-base-300 z-[1] w-80 border p-4 shadow"
					>
						<div class="card-body">
							<h3 class="card-title mb-4 text-base">Reading Settings</h3>

							<!-- Theme selector -->
							<div class="form-control mb-4">
								<!-- svelte-ignore a11y_label_has_associated_control -->
								<label class="label">
									<span class="label-text font-medium">Theme</span>
								</label>
								<div class="join join-horizontal w-full">
									<button
										class="btn join-item flex-1 {theme === 'light' ? 'btn-primary' : 'btn-outline'}"
										onclick={() => {
											theme = 'light';
											changeTheme('light', true);
										}}
									>
										Light
									</button>
									<button
										class="btn join-item flex-1 {theme === 'dark' ? 'btn-primary' : 'btn-outline'}"
										onclick={() => {
											theme = 'dark';
											changeTheme('dark', true);
										}}
									>
										Dark
									</button>
								</div>
							</div>

							<!-- Font size -->
							<div class="form-control">
								<label for="font-size-slider" class="label">
									<span class="label-text font-medium">Font Size: {fontSize}px</span>
								</label>
								<input
									type="range"
									min="14"
									max="28"
									class="range range-primary"
									bind:value={fontSize}
									onchange={() => changeFontSize(fontSize)}
									id="font-size-slider"
								/>
								<div class="text-base-content/70 mt-1 flex w-full justify-between px-2 text-xs">
									<span>14px</span>
									<span>21px</span>
									<span>28px</span>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- More actions -->
				<div class="dropdown dropdown-end">
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<label tabindex="0" class="btn btn-ghost btn-circle">
						<EllipsisVertical size={20} />
					</label>
					<div
						class="dropdown-content card card-compact bg-base-100 border-base-300 z-[1] w-48 border p-2 shadow"
					>
						<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
						<ul
							tabindex="0"
							class="dropdown-content menu bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
						>
							<li>
								<button
									onclick={() =>
										(
											document.getElementById('my_modal_2') as HTMLDialogElement | null
										)?.showModal()}
									title="Book Info"
								>
									Book Info
								</button>
							</li>
							<li>
								<button title="Share" onclick={() => shareCurrentUrl()}> Share </button>
							</li>
						</ul>
					</div>
				</div>
			</div>

			<!-- Progress bar -->
			<div class="bg-base-300 absolute right-0 bottom-0 left-0 h-1">
				<div
					class="bg-primary h-full transition-all duration-300 ease-out"
					style="width: {readingProgress}%;"
				></div>
			</div>
		</header>

		<!-- Main reader content -->
		<main class="bg-base-100 flex flex-1 justify-center">
			<div
				class="reading-container w-full max-w-4xl overflow-y-auto px-6 py-8"
				bind:this={readerContainer}
				onscroll={handleScroll}
				style="--reading-font-size: {fontSize}px; font-size: {fontSize}px; height: calc(100vh - 65px);"
			>
				{#if loading}
					<div class="flex h-full flex-col items-center justify-center gap-6">
						<div class="flex flex-col items-center gap-2">
							<BookOpen size={48} class="text-base-content/50" />
							<p class="text-lg font-medium">
								{isLoadedFromOffline ? 'Loading from offline storage...' : 'Downloading book...'}
							</p>
						</div>
						<div class="loading loading-spinner loading-lg text-primary"></div>
					</div>
				{:else if error}
					<div class="flex h-full flex-col items-center justify-center gap-6">
						<div class="flex flex-col items-center gap-2">
							<CircleX size={48} class="text-base-content/50" />
							<div class="text-center">
								<p class="text-lg font-medium">Error loading the book</p>
								{#if errorDetails}
									<p class="text-xs">{errorDetails}</p>
								{/if}
							</div>
							<button onclick={() => window.location.reload()} class="btn btn-sm btn-primary">
								<RotateCcw size={18} /> Re-try
							</button>
						</div>
					</div>
				{:else}
					<div class="prose prose-lg max-w-none leading-relaxed" style="font-size: inherit;">
						{#each chapters as chapter, i (i)}
							<div class="chapter mb-16" data-chapter-index={i} bind:this={chapterElements[i]}>
								<!-- Chapter header with title and audio button -->
								<div class="border-base-300 mb-8 flex items-center justify-between border-b pb-3">
									<h2
										class="font-bold {chapter.level === 1
											? 'text-4xl'
											: chapter.level === 2
												? 'text-2xl'
												: chapter.level === 3
													? 'text-xl'
													: 'text-3xl'}"
										style="font-size: {chapter.level === 1
											? fontSize * 2
											: chapter.level === 2
												? fontSize * 1.5
												: chapter.level === 3
													? fontSize * 1.25
													: fontSize * 1.75}px;"
									>
										{chapter.title}
									</h2>
									<!-- Simple "Soon" audio button -->
									<button
										class="btn btn-ghost btn-circle btn-sm"
										onclick={showAudioSoonAlert}
										title="Listen to this chapter"
										aria-label="Listen to {chapter.title} (Coming Soon)"
									>
										<Volume2 size={18} />
									</button>
								</div>

								{#if chapter.paragraphs.length > 0}
									{#each chapter.paragraphs as paragraph, pIndex (pIndex)}
										<div class="paragraph-container relative">
											<p
												class="hover:bg-base-200/30 mb-6 rounded px-2 py-1 text-justify indent-8 leading-relaxed transition-colors"
												style="font-size: {fontSize}px; line-height: {fontSize * 1.6}px;"
												data-chapter-index={i}
												data-paragraph-index={pIndex}
											>
												{#if fileType === 'markdown'}
													{@html renderMarkdownInline(paragraph)}
												{:else}
													{paragraph}
												{/if}
											</p>
										</div>
									{/each}
								{:else if chapter.title === 'Introduction' || chapter.title === 'Beginning'}
									<p
										class="text-base-content/70 mb-6 text-justify italic"
										style="font-size: {fontSize}px;"
									>
										No content for this section.
									</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</main>
	</div>
</div>

<!-- Restore Position Prompt Modal -->
{#if showRestorePrompt && savedPosition}
	<div class="modal modal-open">
		<div class="modal-box">
			<h3 class="text-lg font-bold">Continue Reading?</h3>
			<p class="py-4">
				You were reading
				<span class="font-semibold"
					>{savedPosition.chapterTitle || `Chapter ${savedPosition.chapterIndex + 1}`}</span
				>
				at {savedPosition.scrollPercentage?.toFixed(1)}% through the book.
			</p>
			<div class="modal-action">
				<button class="btn btn-primary" onclick={acceptRestore}>Continue Reading</button>
				<button class="btn" onclick={declineRestore}>Start from Beginning</button>
			</div>
		</div>
	</div>
{/if}

<!-- Bookmark notification -->
{#if showBookmarkIndicator}
	<div class="toast toast-top toast-center z-50">
		<div class="alert alert-success">
			<Bookmark size={16} />
			<span>📖 Position bookmarked!</span>
		</div>
	</div>
{/if}

<style>
	/* Custom styles for better typography */
	.prose p {
		color: inherit;
		font-family: 'Georgia', serif;
		hyphens: auto;
		word-wrap: break-word;
		/* Force font-size inheritance on mobile */
		font-size: inherit !important;
	}

	.prose h2 {
		color: inherit;
		font-family: 'Georgia', serif;
		/* Ensure headings also respect font scaling */
		font-size: inherit;
	}

	/* Ensure the main reading container properly applies font size */
	.reading-container {
		font-size: var(--reading-font-size);
	}

	/* Mobile-specific font size fixes */
	@media (max-width: 768px) {
		.prose p {
			text-indent: 1.5rem;
			/* Explicitly set font size for mobile */
			font-size: var(--reading-font-size) !important;
		}

		.prose h2 {
			/* Scale headings proportionally on mobile */
			font-size: calc(var(--reading-font-size) * 1.5) !important;
		}

		/* Prevent mobile browser zoom interfering with font size */
		.reading-container {
			-webkit-text-size-adjust: none;
			text-size-adjust: none;
		}
	}

	/* Custom line clamp utility */
	.line-clamp-2 {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	/* Smooth transitions for position changes */
	.reading-container {
		scroll-behavior: auto; /* Let JavaScript control scroll behavior */
	}

	/* Position indicator styling */
	.alert {
		transition: all 0.3s ease;
	}
</style>
