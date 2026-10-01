// Course sections are subfolders of a course: courses/<course>/<NN-section-name>/<lesson>.md.
// Shared by the sidebar builder (config time) and the site's lesson lists, so both use one order.

/** Folder name → display title: "02-lorem-section-2" → "Common vulnerabilities". */
export function sectionTitle(folder, overrides = {}) {
	if (overrides?.[folder]) return overrides[folder];
	const words = folder.replace(/^\d+[-_.\s]*/, '').replace(/[-_]+/g, ' ').trim() || folder;
	return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Sections sort by folder name, so a numeric prefix (01-, 02-) sets their order. */
export const compareSections = (a, b) => a.localeCompare(b, undefined, { numeric: true });

/**
 * Lesson order within a course: lessons at the course root first, then each section in folder
 * order; within each, by `sidebar.order`, then by id. `section` is '' for root lessons.
 * @param {{ section: string, order?: number, id: string }} a
 * @param {{ section: string, order?: number, id: string }} b
 */
export const compareLessons = (a, b) =>
	(a.section === b.section ? 0 : !a.section ? -1 : !b.section ? 1 : compareSections(a.section, b.section)) ||
	(a.order ?? Infinity) - (b.order ?? Infinity) ||
	a.id.localeCompare(b.id);
