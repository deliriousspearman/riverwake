// Pro labs: lab environments described on the site (docs/labs/<slug>.md, `kind: lab`).
// The site only shows information about each lab; it doesn't run or control them. The field types
// are checked in scripts/schema.mjs; this checks the rules a schema can't express, and is used by
// plugins/lms-content.mjs, which also works out the lab cards' osCounts and labSummary with it.

export const OPERATING_SYSTEMS = ['Windows', 'Linux', 'FreeBSD', 'Other'];

/**
 * Problems with one lab's frontmatter, as messages (empty if it's fine).
 * @param {Record<string, any>} data the entry's data
 * @param {{ hasFlagFile?: boolean }} options whether content/lab-flags/<slug>.yml exists
 */
export function labProblems(data, { hasFlagFile = false } = {}) {
	const problems = [];
	for (const field of ['level', 'environment', 'entryPoint']) {
		if (data[field] === undefined) problems.push(`\`${field}\` is required`);
	}
	// The count, unless the lab's flags are in content/lab-flags/ (then it comes from there).
	if (data.flags === undefined && !hasFlagFile) problems.push('`flags` is required (the number of flags), unless the lab has a flags file in content/lab-flags/');
	if (!data.machines?.length) problems.push('`machines` needs at least one machine');

	const domainJoined = (data.machines ?? []).filter((m) => m.domainJoined).map((m) => m.name);
	if (data.environment === 'domain') {
		if (!data.domain) problems.push('`domain` is required for a domain environment (e.g. corp.example)');
		if (!domainJoined.length) problems.push('a domain environment needs at least one machine with `domainJoined: true`');
	}
	if (data.environment === 'standalone') {
		if (data.domain) problems.push('`domain` is only for domain environments (remove it, or set `environment: domain`)');
		if (domainJoined.length) problems.push(`machines can't be domain joined in a standalone environment: ${domainJoined.join(', ')}`);
	}

	const names = (data.machines ?? []).map((m) => m.name.toLowerCase());
	const duplicates = [...new Set(names.filter((n, i) => names.indexOf(n) !== i))];
	if (duplicates.length) problems.push(`machine names must be unique: ${duplicates.join(', ')}`);

	return problems;
}

/** Machines per operating system, most common first: [["Windows", 4], ["Linux", 2]]. */
export function osCounts(machines) {
	const counts = new Map();
	for (const { os } of machines) counts.set(os, (counts.get(os) ?? 0) + 1);
	return [...counts].sort((a, b) => b[1] - a[1] || OPERATING_SYSTEMS.indexOf(a[0]) - OPERATING_SYSTEMS.indexOf(b[0]));
}

/** "6 machines · 10 flags" */
export function labSummary({ machines, flags }) {
	const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
	return `${plural(machines.length, 'machine')} · ${plural(flags, 'flag')}`;
}
