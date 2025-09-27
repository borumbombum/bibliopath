<!-- src/lib/components/BookOpenForm.svelte -->
<script lang="ts">
	import { BookOpen, Upload, File } from '@lucide/svelte';
	import { epubService } from '$lib/services/epub.services';
	import type { BookFileType } from '$lib/types';

	let newBookUrl = $state('');
	let newBookType: BookFileType = $state('markdown');
	let fileInput: HTMLInputElement;
	let isUploading = $state(false);
	let uploadError = $state('');

	function openBook() {
		if (!newBookUrl.trim()) {
			alert('Please enter a book URL');
			return;
		}

		const bookUrl = `/book?book=${encodeURIComponent(newBookUrl.trim())}&type=${newBookType}`;
		window.location.href = bookUrl;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			openBook();
		}
	}

	function triggerFileUpload() {
		fileInput?.click();
	}

	async function handleFileUpload(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) return;

		if (!file.name.toLowerCase().endsWith('.epub')) {
			uploadError = 'Please select a valid EPUB file';
			return;
		}

		isUploading = true;
		uploadError = '';

		try {
			const { title, author, content } = await epubService.parseEpubFile(file);
			const savedBook = await epubService.saveEpubAsOfflineBook(title, author, content);

			// Navigate to your existing reader with the EPUB content
			const bookUrl = `/book?book=${encodeURIComponent(savedBook.id)}&type=epub&author=${encodeURIComponent(author)}&title=${encodeURIComponent(title)}`;
			window.location.href = bookUrl;
		} catch (error) {
			console.error('Error uploading EPUB:', error);
			uploadError = error instanceof Error ? error.message : 'Failed to upload EPUB file';
		} finally {
			isUploading = false;
			// Reset file input
			if (target) target.value = '';
		}
	}
</script>

<section class="mb-12">
	<h2 class="mb-6 text-2xl font-bold">Open a Book</h2>

	<div class="grid gap-6 lg:grid-cols-2">
		<!-- URL Input Form -->
		<div class="card bg-base-200 shadow-sm">
			<div class="card-body">
				<h3 class="card-title mb-4 text-lg">From URL</h3>
				<div class="form-control">
					<label class="label" for="newBookUrlInput">
						<span class="label-text font-medium">Book URL</span>
					</label>
					<div class="flex flex-col gap-2 sm:flex-row">
						<input
							id="newBookUrlInput"
							type="url"
							placeholder="https://raw.githubusercontent.com/README.md or https://gutenberg.org/files/..."
							class="input input-bordered w-full sm:flex-grow"
							bind:value={newBookUrl}
							onkeydown={handleKeydown}
						/>
						<select class="select select-bordered w-full sm:w-auto" bind:value={newBookType}>
							<option value="markdown">Markdown</option>
							<option value="text">Plain Text</option>
						</select>
						<button class="btn btn-primary w-full sm:w-auto" onclick={openBook}>
							<BookOpen size={18} />
							Open Book
						</button>
					</div>
					<div class="label mt-3 md:mt-2">
						<span class="label-text-alt text-base-content/70 text-xs text-wrap">
							Supports Markdown files (.md) and plain text books from Project Gutenberg
						</span>
					</div>
				</div>
			</div>
		</div>

		<!-- EPUB Upload Form -->
		<div class="card bg-base-200 shadow-sm">
			<div class="card-body">
				<h3 class="card-title mb-4 text-lg">Upload EPUB</h3>
				<div class="form-control">
					<label class="label" for="epubUpload">
						<span class="label-text font-medium">EPUB File</span>
					</label>

					<!-- Hidden file input -->
					<input
						bind:this={fileInput}
						id="epubUpload"
						type="file"
						accept=".epub"
						class="hidden"
						onchange={handleFileUpload}
					/>

					<!-- Upload button -->
					<button
						class="btn btn-outline w-full"
						class:btn-disabled={isUploading}
						onclick={triggerFileUpload}
					>
						{#if isUploading}
							<span class="loading loading-spinner loading-sm"></span>
							Processing EPUB...
						{:else}
							<Upload size={18} />
							Choose EPUB File
						{/if}
					</button>

					{#if uploadError}
						<div class="alert alert-error mt-3">
							<File size={16} />
							<span class="text-sm">{uploadError}</span>
						</div>
					{/if}

					<div class="label mt-3 md:mt-2">
						<span class="label-text-alt text-base-content/70 text-xs text-wrap">
							Upload EPUB files to read in your existing reader.
							<span class="text-red-500"> Files are stored locally. </span>
						</span>
					</div>
				</div>
			</div>
		</div>
	</div>
</section>
