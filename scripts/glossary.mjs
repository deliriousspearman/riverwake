// Glossary (content/glossary/*.yml): the build-time checks, and the term matching that
// plugins/remark-glossary.mjs uses to mark the first use of each term on lesson and lab pages.
// Pure functions, shared by the plugins.

/**
 * Problems with the glossary as a whole (empty if it's fine): a term or alias used by two entries
 * (matching is by first use, so it must be unambiguous) and "see also" links to unknown entries.
 * @param {{ id: string, term: string, aliases?: string[], seeAlso?: string[] }[]} entries
 */
export function glossaryProblems(entries) {
	const problems = [];
	const owner = new Map(); // lower-case name → entry id
	for (const entry of entries) {
		for (const name of [entry.term, ...(entry.aliases ?? [])]) {
			const key = name.trim().toLowerCase();
			if (owner.has(key) && owner.get(key) !== entry.id) {
				problems.push(`"${name}" is used by both ${owner.get(key)} and ${entry.id}`);
			}
			owner.set(key, entry.id);
		}
	}
	const ids = new Set(entries.map((e) => e.id));
	for (const entry of entries) {
		for (const other of entry.seeAlso ?? []) {
			if (other === entry.id) problems.push(`${entry.id}: "see also" lists itself`);
			else if (!ids.has(other)) problems.push(`${entry.id}: "see also" lists unknown term ${other}`);
		}
	}
	return problems;
}

// Acronyms ("ACL", "AD CS", "CIA triad") only match as written; ordinary words match in any case.
const caseSensitive = (name) => (name.match(/\p{Lu}/gu) ?? []).length >= 2;
const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A matcher for a list of terms: finds whole-word uses of each term or alias, with an optional
 * plural "s"/"es" ("ACLs", "hashes"), longest names first ("AS-REP roasting" before "AS-REP").
 * @param {{ id: string, term: string, aliases?: string[] }[]} terms
 */
export function glossaryMatcher(terms) {
	const names = terms
		.flatMap(({ id, term, aliases = [] }) => [term, ...aliases].map((name) => ({ id, name, exact: caseSensitive(name) })))
		.sort((a, b) => b.name.length - a.name.length);
	const byName = new Map(names.map((n) => [n.name.toLowerCase(), n]));
	const pattern = names.map((n) => escape(n.name)).join('|');
	const regex = new RegExp(`(?<![\\p{L}\\p{N}_-])(${pattern})(?:es|s)?(?![\\p{L}\\p{N}_-])`, 'giu');
	return {
		/**
		 * The first use in `text` of a term not yet in `seen` (a Set of ids), or null.
		 * @returns {{ id: string, index: number, length: number } | null}
		 */
		first(text, seen) {
			if (!names.length) return null;
			regex.lastIndex = 0;
			for (const match of text.matchAll(regex)) {
				const found = byName.get(match[1].toLowerCase());
				if (!found || seen.has(found.id)) continue;
				if (found.exact && match[1] !== found.name) continue;
				return { id: found.id, index: match.index, length: match[0].length };
			}
			return null;
		},
	};
}
