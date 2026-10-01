// Shared test helpers: throwaway folders of content files, removed when the test ends.
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** A new empty folder, deleted after the current test (`t` is the node:test context). */
export function tempDir(t) {
	const dir = mkdtempSync(join(tmpdir(), 'codex-test-'));
	t.after(() => rmSync(dir, { recursive: true, force: true }));
	return dir;
}

/** Writes `files` ({ 'relative/path': contents }) under `dir`; a number makes a file of that many bytes. */
export function writeFiles(dir, files) {
	for (const [path, contents] of Object.entries(files)) {
		const file = join(dir, path);
		mkdirSync(dirname(file), { recursive: true });
		if (typeof contents === 'number') {
			writeFileSync(file, '');
			truncateSync(file, contents);
		} else writeFileSync(file, contents);
	}
	return dir;
}

/** Markdown with YAML frontmatter. */
export const page = (frontmatter, body = 'Text.') => `---\n${frontmatter}\n---\n\n${body}\n`;

/** Runs `fn` with NODE_ENV set to `value`, then restores it. */
export function withNodeEnv(value, fn) {
	const before = process.env.NODE_ENV;
	process.env.NODE_ENV = value;
	try {
		return fn();
	} finally {
		if (before === undefined) delete process.env.NODE_ENV;
		else process.env.NODE_ENV = before;
	}
}

/**
 * Imports one of the site's TypeScript modules (src/…) for testing: transpiled with the project's
 * TypeScript into node_modules/.cache/codex-tests/, where its packages (react, …) resolve. Its own
 * imports of other src/ modules (`../lib/preferences`) are transpiled alongside it.
 */
export async function importTs(path) {
	const { default: ts } = await import('typescript');
	const root = new URL('../', import.meta.url);
	const done = new Map();
	/** Transpiles `path` (and the src/ modules it imports) and returns its output file's URL. */
	const transpile = (path) => {
		if (done.has(path)) return done.get(path);
		const out = new URL(`node_modules/.cache/codex-tests/${path.replace(/[/.]/g, '_')}.mjs`, root);
		done.set(path, out);
		const source = readFileSync(new URL(path, root), 'utf8');
		let { outputText } = ts.transpileModule(source, {
			compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
		});
		outputText = outputText.replace(/(from\s+|import\s*\(?\s*)'(\.\.?\/[^']+)'/g, (match, before, spec) => {
			const base = new URL(spec, new URL(path, root));
			const found = ['.ts', '.tsx', ''].map((ext) => new URL(`${base.href}${ext}`)).find((url) => existsSync(url) && statSync(url).isFile());
			if (!found) return match;
			// Plain JavaScript (scripts/*.mjs) is imported from where it is.
			if (/\.m?js$/.test(found.href)) return `${before}'${found.href}'`;
			return `${before}'${transpile(found.href.slice(root.href.length)).href}'`;
		});
		mkdirSync(new URL('./', out), { recursive: true });
		writeFileSync(out, outputText);
		return out;
	};
	// A fresh copy of the module itself on each call (its src/ imports are shared).
	return import(`${transpile(path).href}?${Date.now()}`);
}
