// Course and lesson attachments: files learners can download, listed in `attachments` frontmatter
// and stored in git under static/files/ (uploaded through the CMS or committed directly).
// The page schema (scripts/schema.mjs) checks them with these rules, and Attachments in
// src/components/DocParts.tsx shows the type and size worked out here.
import { existsSync, statSync } from 'node:fs';
import { extname } from 'node:path';
import { STATIC_DIR } from './content.mjs';

// Keep in sync with `max_file_size` on the attachment field in cms/config.yml. Larger files belong
// somewhere else, linked from the lesson.
export const ATTACHMENT_MAX_MB = 10;

// File types learners may download, by extension → label shown next to the file. Anything a
// browser could run or render as a page from this site (HTML, SVG, XML, JavaScript) is left out on
// purpose: served from the site's own origin, it could run script there. Executables are left out
// too. Add a type here (and to the CMS hint) if a course needs it.
export const ATTACHMENT_TYPES = {
	pdf: 'PDF',
	txt: 'Text',
	md: 'Markdown',
	csv: 'CSV',
	json: 'JSON',
	yaml: 'YAML',
	yml: 'YAML',
	log: 'Log',
	conf: 'Config',
	py: 'Python',
	sh: 'Shell script',
	ps1: 'PowerShell',
	pcap: 'Packet capture',
	pcapng: 'Packet capture',
	zip: 'ZIP',
	'7z': '7-Zip',
	gz: 'Gzip',
	tgz: 'Tar archive',
	tar: 'Tar archive',
	docx: 'Word',
	xlsx: 'Excel',
	pptx: 'PowerPoint',
	odt: 'Document',
	ods: 'Spreadsheet',
	odp: 'Presentation',
	png: 'Image',
	jpg: 'Image',
	jpeg: 'Image',
	webp: 'Image',
	gif: 'Image',
};

/** Lower-case extension without the dot, e.g. "pcap". */
export const extensionOf = (path) => extname(path).slice(1).toLowerCase();

/**
 * Problems with an attachment path (empty if it's fine): the path must be under /files/, have an
 * allowed type, exist under `publicDir` and fit the size limit. `publicDir` is for tests.
 */
export function attachmentProblems(path, publicDir = STATIC_DIR) {
	if (typeof path !== 'string' || !/^\/files\/[\w./-]+$/.test(path) || path.includes('..')) {
		return ['must be a path under /files/, like /files/<course>/<name>.pdf (letters, numbers, - _ . / only)'];
	}
	const type = extensionOf(path);
	if (!Object.hasOwn(ATTACHMENT_TYPES, type)) {
		return [`file type ".${type}" isn't allowed; use one of: ${Object.keys(ATTACHMENT_TYPES).join(', ')}`];
	}
	const file = `${publicDir}${path}`;
	if (!existsSync(file) || !statSync(file).isFile()) return [`file not found: static${path}`];
	if (statSync(file).size > ATTACHMENT_MAX_MB * 1024 * 1024) {
		return [`file is larger than ${ATTACHMENT_MAX_MB} MB; compress it, split it, or host it elsewhere and link to it`];
	}
	return [];
}

/** "840 B", "12 KB", "3.4 MB". */
export function formatBytes(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
	const mb = bytes / 1024 / 1024;
	return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}

/** Type label and size of an attachment that passed attachmentProblems. */
export function attachmentInfo(path, publicDir = STATIC_DIR) {
	return { type: ATTACHMENT_TYPES[extensionOf(path)], size: formatBytes(statSync(`${publicDir}${path}`).size) };
}
