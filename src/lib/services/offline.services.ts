// src/lib/services/offline.services.ts

import type { OfflineBook } from '$lib/types';

class OfflineBookService {
	private db: IDBDatabase | null = null;
	private readonly DB_NAME = 'BibliopathOfflineBooks';
	private readonly DB_VERSION = 1;
	private readonly STORE_NAME = 'books';

	async init(): Promise<void> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				this.db = request.result;
				resolve();
			};

			request.onupgradeneeded = (event) => {
				const db = (event.target as IDBOpenDBRequest).result;

				if (!db.objectStoreNames.contains(this.STORE_NAME)) {
					const store = db.createObjectStore(this.STORE_NAME, { keyPath: 'id' });
					store.createIndex('url', 'url', { unique: true });
					store.createIndex('downloadedAt', 'downloadedAt');
				}
			};
		});
	}

	private async ensureDB(): Promise<IDBDatabase> {
		if (!this.db) {
			await this.init();
		}
		if (!this.db) {
			throw new Error('Failed to initialize IndexedDB');
		}
		return this.db;
	}

	private generateBookId(url: string): string {
		// Create a consistent ID from URL
		return btoa(url).replace(/[^a-zA-Z0-9]/g, '');
	}

	async saveBook(book: Omit<OfflineBook, 'id' | 'downloadedAt' | 'lastAccessed'>): Promise<void> {
		const db = await this.ensureDB();
		const transaction = db.transaction([this.STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.STORE_NAME);

		const offlineBook: OfflineBook = {
			...book,
			id: this.generateBookId(book.url),
			downloadedAt: Date.now(),
			lastAccessed: Date.now()
		};

		return new Promise((resolve, reject) => {
			const request = store.put(offlineBook);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	async getBook(url: string): Promise<OfflineBook | null> {
		const db = await this.ensureDB();
		const transaction = db.transaction([this.STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.STORE_NAME);
		const bookId = this.generateBookId(url);

		return new Promise((resolve, reject) => {
			const request = store.get(bookId);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => {
				const book = request.result as OfflineBook | undefined;
				if (book) {
					// Update last accessed time
					this.updateLastAccessed(book.id);
					resolve(book);
				} else {
					resolve(null);
				}
			};
		});
	}

	async isBookDownloaded(url: string): Promise<boolean> {
		try {
			const book = await this.getBook(url);
			return book !== null;
		} catch {
			return false;
		}
	}

	async removeBook(url: string): Promise<void> {
		const db = await this.ensureDB();
		const transaction = db.transaction([this.STORE_NAME], 'readwrite');
		const store = transaction.objectStore(this.STORE_NAME);
		const bookId = this.generateBookId(url);

		return new Promise((resolve, reject) => {
			const request = store.delete(bookId);
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve();
		});
	}

	async getAllBooks(): Promise<OfflineBook[]> {
		const db = await this.ensureDB();
		const transaction = db.transaction([this.STORE_NAME], 'readonly');
		const store = transaction.objectStore(this.STORE_NAME);

		return new Promise((resolve, reject) => {
			const request = store.getAll();
			request.onerror = () => reject(request.error);
			request.onsuccess = () => resolve(request.result);
		});
	}

	private async updateLastAccessed(bookId: string): Promise<void> {
		try {
			const db = await this.ensureDB();
			const transaction = db.transaction([this.STORE_NAME], 'readwrite');
			const store = transaction.objectStore(this.STORE_NAME);

			const getRequest = store.get(bookId);
			getRequest.onsuccess = () => {
				const book = getRequest.result;
				if (book) {
					book.lastAccessed = Date.now();
					store.put(book);
				}
			};
		} catch (error) {
			console.error('Failed to update last accessed time:', error);
		}
	}

	async getStorageUsage(): Promise<{ used: number; quota: number }> {
		if ('storage' in navigator && 'estimate' in navigator.storage) {
			const estimate = await navigator.storage.estimate();
			return {
				used: estimate.usage || 0,
				quota: estimate.quota || 0
			};
		}
		return { used: 0, quota: 0 };
	}
}

// Export singleton instance
export const offlineBookService = new OfflineBookService();
