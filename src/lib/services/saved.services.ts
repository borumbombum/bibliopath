import { browser } from '$app/environment';
import type { SavedBook } from '$lib/types';

const STORAGE_KEY = 'bibliopath-saved-books';

/**
 * Loads saved books from local storage.
 * @returns An array of saved books, sorted by the most recently read.
 */
export function loadSavedBooks(): SavedBook[] {
	if (!browser) return [];

	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved) {
		try {
			const books: SavedBook[] = JSON.parse(saved);
			// Sort by last read date (most recent first)
			return books.sort((a, b) => {
				const dateA = new Date(a.lastRead || a.savedAt).getTime();
				const dateB = new Date(b.lastRead || b.savedAt).getTime();
				return dateB - dateA;
			});
		} catch (e) {
			console.error('Failed to parse saved books:', e);
			return [];
		}
	}
	return [];
}

/**
 * Saves an array of books back to local storage.
 * @param books The array of books to save.
 */
function saveAllBooks(books: SavedBook[]): void {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
	} catch (e) {
		console.error('Failed to save books:', e);
	}
}

/**
 * Saves a book to the local storage library.
 * If the book already exists, its lastRead timestamp is updated.
 * @param bookToSave The book object to save.
 */
export function saveBook(bookToSave: Omit<SavedBook, 'id' | 'savedAt'> & { id?: string; savedAt?: string }) {
	if (!browser) return;

	const savedBooks = loadSavedBooks();
	const existingBookIndex = savedBooks.findIndex((book) => book.url === bookToSave.url);

	if (existingBookIndex > -1) {
		// Update existing book
		savedBooks[existingBookIndex].lastRead = new Date().toISOString();
	} else {
		// Add new book
		const newBook: SavedBook = {
			...bookToSave,
			id: bookToSave.id || (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
			savedAt: bookToSave.savedAt || new Date().toISOString(),
			lastRead: new Date().toISOString()
		};
		savedBooks.push(newBook);
	}

	saveAllBooks(savedBooks);
}

/**
 * Removes a book from the local storage library by its ID.
 * @param bookId The ID of the book to remove.
 */
export function removeBook(bookId: string) {
	if (!browser) return;

	let savedBooks = loadSavedBooks();
	savedBooks = savedBooks.filter((book) => book.id !== bookId);
	saveAllBooks(savedBooks);
}
