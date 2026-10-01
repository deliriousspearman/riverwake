// Pro lab flags: content/lab-flags/<lab slug>.yml, the values learners submit on a lab's page to
// track their progress (src/lib/lab-flags.ts). There's no server, so the browser checks a flag
// itself: the site gets only a salted SHA-256 hash of each flag, never the value. The values stay in
// this (private) repository, never in docs/labs/*.md, whose frontmatter is copied into the public
// site's JavaScript. A hash can't be reversed, but a short or guessable flag could be found by trying
// guesses against it, so short flags get a warning.
//
// Each flag's id (the start of its hash) is the key learners' progress is stored under: renaming a
// flag's label keeps progress, and changing its value resets it.
import { createHash } from 'node:crypto';

/** Flags shorter than this are easy to guess from their hash. */
export const SHORT_FLAG = 12;

/** The hash the site publishes for a flag; src/lib/lab-flags.ts hashes a submitted flag the same way. */
export const flagHash = (slug, flag) => createHash('sha256').update(`codex-flag:${slug}:${flag.trim()}`).digest('hex');

/**
 * Problems with one lab's flags file (messages; empty if it's fine). `lab` is the lab's checked
 * entry, or undefined if no lab has this file's name.
 */
export function labFlagProblems(slug, flags, lab, labSlugs) {
	if (!lab) return [`there's no pro lab "${slug}" (docs/labs/${slug}.md): name the file after one of ${labSlugs.join(', ') || '(none yet)'}`];
	const problems = [];
	const machines = new Map(lab.data.machines.map((m) => [m.name.toLowerCase(), m.name]));
	flags.forEach((f, i) => {
		if (f.machine && !machines.has(f.machine.toLowerCase())) {
			problems.push(`flag ${i + 1} (${f.label}): machine "${f.machine}" isn't one of this lab's machines (${[...machines.values()].join(', ')})`);
		}
	});
	const repeated = (key) => {
		const seen = new Map();
		return flags.flatMap((f, i) => {
			const k = key(f);
			if (seen.has(k)) return [[seen.get(k) + 1, i + 1]];
			seen.set(k, i);
			return [];
		});
	};
	for (const [a, b] of repeated((f) => f.flag.trim())) problems.push(`flags ${a} and ${b} have the same value`);
	for (const [a, b] of repeated((f) => `${(f.machine ?? '').toLowerCase()}\0${f.label.toLowerCase()}`)) problems.push(`flags ${a} and ${b} have the same machine and label`);
	if (lab.data.flags !== undefined && lab.data.flags !== flags.length) {
		problems.push(`docs/labs/${slug}.md says \`flags: ${lab.data.flags}\`, but this file has ${flags.length}: remove \`flags\` from the lab page (the count comes from here) or make them match`);
	}
	return problems;
}

/** Warnings: flags short enough to guess. */
export function labFlagWarnings(slug, flags) {
	const short = flags.map((f, i) => (f.flag.trim().length < SHORT_FLAG ? `${i + 1} (${f.label})` : null)).filter(Boolean);
	return short.length ? [`content/lab-flags/${slug}.yml: flag(s) ${short.join(', ')} are shorter than ${SHORT_FLAG} characters, so easy to guess; use long random flags.`] : [];
}

/** What the site gets for a lab's flags: names and hashes, in the file's order, never the values. */
export const publicFlags = (slug, flags) =>
	flags.map((f) => {
		const hash = flagHash(slug, f.flag);
		return { id: hash.slice(0, 16), machine: f.machine ?? null, label: f.label, hash };
	});
