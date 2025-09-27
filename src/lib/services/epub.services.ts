// src/lib/services/epub.services.ts
import JSZip from 'jszip';
import { offlineBookService } from './offline.services';
import type { OfflineBook } from '$lib/types';

class EpubService {
	async parseEpubFile(file: File): Promise<{ title: string; author: string; content: string }> {
		try {
			const zip = new JSZip();
			const zipContent = await zip.loadAsync(file);

			const containerXml = await zipContent.file('META-INF/container.xml')?.async('text');
			if (!containerXml) {
				throw new Error('Invalid EPUB: Missing container.xml');
			}

			const opfPath = this.extractOpfPath(containerXml);
			const opfContent = await zipContent.file(opfPath)?.async('text');
			if (!opfContent) {
				throw new Error('Invalid EPUB: Missing OPF file');
			}

			const opfData = this.parseOpf(opfContent);
			const basePath = opfPath.split('/').slice(0, -1).join('/');

			let combinedContent = '';
			for (const spineItem of opfData.spine) {
				const chapterPath = basePath ? `${basePath}/${spineItem.href}` : spineItem.href;
				const chapterContent = await zipContent.file(chapterPath)?.async('text');
				if (chapterContent) {
					const cleanContent = this.cleanHtmlContent(chapterContent);
					combinedContent += `\n\n${cleanContent}`;
				}
			}

			return {
				title: opfData.metadata.title || file.name.replace('.epub', ''),
				author: opfData.metadata.author || 'Unknown Author',
				content: combinedContent.trim()
			};
		} catch (error) {
			console.error('Error parsing EPUB:', error);
			throw new Error(
				`Failed to parse EPUB file: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	private extractOpfPath(containerXml: string): string {
		const parser = new DOMParser();
		const doc = parser.parseFromString(containerXml, 'text/xml');
		const rootfile = doc.querySelector('rootfile');
		const fullPath = rootfile?.getAttribute('full-path');
		if (!fullPath) {
			throw new Error('Invalid container.xml: Missing rootfile path');
		}
		return fullPath;
	}

	private parseOpf(opfContent: string) {
		const parser = new DOMParser();
		const doc = parser.parseFromString(opfContent, 'text/xml');

		const metadata = {
			title: doc.querySelector('dc\\:title, title')?.textContent || '',
			author: doc.querySelector('dc\\:creator, creator')?.textContent || ''
		};

		const manifest = new Map();
		doc.querySelectorAll('manifest item').forEach((item) => {
			const id = item.getAttribute('id');
			const href = item.getAttribute('href');
			if (id && href) {
				manifest.set(id, { href, mediaType: item.getAttribute('media-type') });
			}
		});

		const spine: Array<{ id: string; href: string }> = [];
		doc.querySelectorAll('spine itemref').forEach((itemref) => {
			const idref = itemref.getAttribute('idref');
			if (idref && manifest.has(idref)) {
				const manifestItem = manifest.get(idref);
				spine.push({
					id: idref,
					href: manifestItem.href
				});
			}
		});

		return { metadata, spine };
	}

	private cleanHtmlContent(htmlContent: string): string {
		const parser = new DOMParser();
		const doc = parser.parseFromString(htmlContent, 'text/html');
		doc.querySelectorAll('script, style').forEach((el) => el.remove());
		return doc.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
	}

	private generateId(): string {
		return `epub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}

	async saveEpubAsOfflineBook(
		title: string,
		author: string,
		content: string
	): Promise<OfflineBook> {
		const bookId = this.generateId();
		const offlineBook: OfflineBook = {
			id: bookId,
			url: bookId, // Use the generated ID as the URL for offline books
			title,
			author,
			content,
			fileType: 'epub',
			downloadedAt: Date.now(),
			lastAccessed: Date.now()
		};

		await offlineBookService.init();
		await offlineBookService.saveBook(offlineBook);

		return offlineBook;
	}
}

export const epubService = new EpubService();