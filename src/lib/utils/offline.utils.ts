// src/lib/utils/offline.utils.ts
import { offlineBookService, type OfflineBook } from '$services/offline.services';

/**
 * Format bytes to human readable format
 */
export function formatBytes(bytes: number, decimals = 2): string {
	if (bytes === 0) return '0 Bytes';

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];

	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Get storage usage information
 */
export async function getStorageInfo(): Promise<{
	used: string;
	quota: string;
	usedBytes: number;
	quotaBytes: number;
	percentage: number;
}> {
	const { used, quota } = await offlineBookService.getStorageUsage();

	return {
		used: formatBytes(used),
		quota: formatBytes(quota),
		usedBytes: used,
		quotaBytes: quota,
		percentage: quota > 0 ? Math.round((used / quota) * 100) : 0
	};
}

/**
 * Clean up old offline books (older than specified days)
 */
export async function cleanupOldBooks(daysOld = 30): Promise<number> {
	const books = await offlineBookService.getAllBooks();
	const cutoffTime = Date.now() - daysOld * 24 * 60 * 60 * 1000;

	let removedCount = 0;

	for (const book of books) {
		if (book.lastAccessed < cutoffTime) {
			try {
				await offlineBookService.removeBook(book.url);
				removedCount++;
			} catch (error) {
				console.error(`Failed to remove old book: ${book.title}`, error);
			}
		}
	}

	return removedCount;
}

/**
 * Get offline books sorted by last accessed
 */
export async function getOfflineBooksSorted(): Promise<OfflineBook[]> {
	const books = await offlineBookService.getAllBooks();
	return books.sort((a, b) => b.lastAccessed - a.lastAccessed);
}

/**
 * Estimate content size in bytes
 */
export function estimateContentSize(content: string): number {
	// Rough estimate: each character is about 1 byte in UTF-8 for English text
	// Add some overhead for metadata
	return content.length + 1000; // 1KB overhead for metadata
}

/**
 * Check if browser supports offline storage
 */
export function isOfflineStorageSupported(): boolean {
	return typeof window !== 'undefined' && 'indexedDB' in window && indexedDB !== null;
}

/**
 * Get offline book count and total size
 */
export async function getOfflineStats(): Promise<{
	count: number;
	totalSize: string;
	totalSizeBytes: number;
}> {
	const books = await offlineBookService.getAllBooks();
	const totalBytes = books.reduce((total, book) => total + estimateContentSize(book.content), 0);

	return {
		count: books.length,
		totalSize: formatBytes(totalBytes),
		totalSizeBytes: totalBytes
	};
}
