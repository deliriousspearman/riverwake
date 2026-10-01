// The admin editor's configuration (cms/config.yml): valid for Sveltia CMS (its own JSON schema),
// and in step with the content schemas (scripts/schema.mjs) in both directions, so a field the editor
// saves is one the build accepts, and every setting the build reads can be edited. Also its page
// preview (cms/preview.mjs): the site's blocks as built, the build's message for a broken one, and
// nothing from content that could run.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { parse } from 'yaml';
import { pageHast, toDom } from '../cms/preview.mjs';
import { bannerSchema, glossarySchema, labFlagsSchema, pageSchema, pathwaySchema, removedPagesSchema } from '../scripts/schema.mjs';

const require = createRequire(import.meta.url);
const Ajv = require('ajv');

// The template's ${VAR} placeholders (scripts/prepare.mjs) get example values.
const template = readFileSync(new URL('../cms/config.yml', import.meta.url), 'utf8');
const config = parse(template.replace(/\$\{(\w+)\}/g, (_, name) => (/URL$/.test(name) ? 'https://example.com' : 'example')));
const collection = (name) => config.collections.find((c) => c.name === name);
const file = (collectionName, name) => collection(collectionName).files.find((f) => f.name === name);

// Page settings deliberately not in the admin editor (the guide's "What the editor can't do").
const NOT_IN_EDITOR = ['draft', 'sidebar.label'];

/** A zod schema's fields as dotted paths (`sidebar.order`, `attachments.file`), through optional/array wrappers. */
function schemaPaths(schema, prefix = '') {
	let s = schema;
	for (;;) {
		const t = s.def.type;
		if (t === 'optional' || t === 'nullable' || t === 'default') s = s.def.innerType;
		else if (t === 'pipe') s = s.def.out;
		else if (t === 'array') s = s.def.element;
		else break;
	}
	if (s.def.type !== 'object') return [];
	return Object.entries(s.shape).flatMap(([key, value]) => [`${prefix}${key}`, ...schemaPaths(value, `${prefix}${key}.`)]);
}

/** The editor's fields as dotted paths, through object and list sub-fields. The page text (`body`) isn't frontmatter. */
function fieldPaths(fields, prefix = '') {
	return fields
		.filter((f) => f.name !== 'body')
		.flatMap((f) => [`${prefix}${f.name}`, ...(f.fields ? fieldPaths(f.fields, `${prefix}${f.name}.`) : [])]);
}

test('the admin editor configuration is valid for Sveltia CMS', () => {
	const schema = JSON.parse(readFileSync(new URL('../node_modules/@sveltia/cms/schema/sveltia-cms.json', import.meta.url), 'utf8'));
	const validate = new Ajv({ strict: false, allErrors: true, logger: false }).compile(schema);
	assert.ok(validate(config), JSON.stringify(validate.errors?.slice(0, 5), null, 2));
});

test('every page field in the admin editor is one the build accepts, and the reverse', () => {
	const allowed = new Set(schemaPaths(pageSchema));
	const editable = new Set();
	for (const name of ['courses', 'lessons', 'labs', 'guide']) {
		for (const path of fieldPaths(collection(name).fields)) {
			assert.ok(allowed.has(path), `cms/config.yml ${name} has a field "${path}" that scripts/schema.mjs (pageSchema) doesn't know`);
			editable.add(path);
		}
	}
	const missing = [...allowed].filter((path) => !editable.has(path) && !NOT_IN_EDITOR.includes(path));
	assert.deepEqual(missing, [], `page settings no admin editor collection can set: ${missing.join(', ')}`);
});

test('pathway, glossary, banner, removed-pages and lab-flags fields match their schemas exactly', () => {
	const cases = [
		['pathways', collection('pathways').fields, pathwaySchema],
		['glossary', collection('glossary').fields, glossarySchema],
		['settings/banner', file('settings', 'banner').fields, bannerSchema],
		['settings/removed', file('settings', 'removed').fields, removedPagesSchema],
		['lab-flags', collection('lab-flags').fields, labFlagsSchema],
	];
	for (const [name, fields, schema] of cases) {
		assert.deepEqual(fieldPaths(fields).sort(), schemaPaths(schema).sort(), `cms/config.yml ${name} and scripts/schema.mjs differ`);
	}
});

/** Finds hast elements by a test. */
function findAll(node, test, found = []) {
	if (node.type === 'element' && test(node)) found.push(node);
	for (const child of node.children ?? []) findAll(child, test, found);
	return found;
}
const hasClass = (name) => (node) => [node.properties?.className ?? []].flat().includes(name);
const textOf = (node) => (node.type === 'text' ? node.value : (node.children ?? []).map(textOf).join(''));

test('the editor preview shows the site blocks, and the build message for a broken one', () => {
	const page = [
		'Some **text**.',
		'',
		'```quiz',
		'questions:',
		'  - question: Which?',
		'    options:',
		'      - text: This one',
		'        correct: true',
		'      - Not this',
		'```',
		'',
		'```terminal-red title="Attacker"',
		'$ whoami',
		'```',
		'',
		'```timeline',
		'events: [',
		'```',
		'',
		':::tip[Before you start]',
		'Read this.',
		':::',
	].join('\n');
	const hast = pageHast(page);
	assert.equal(findAll(hast, hasClass('lms-quiz')).length, 1);
	assert.equal(findAll(hast, hasClass('lms-terminal-red')).length, 1);
	const problems = findAll(hast, hasClass('lms-preview-problem'));
	assert.equal(problems.length, 1);
	assert.match(textOf(problems[0]), /This timeline has a problem.*invalid YAML/s);
	assert.equal(textOf(findAll(hast, hasClass('theme-admonition-tip'))[0]), 'Before you startRead this.');
});

test('the editor preview runs nothing from the page: no raw HTML, handlers or javascript: links', () => {
	const hast = pageHast('<script>alert(1)</script>\n\n<img src="x" onerror="alert(2)">\n\n[a](javascript:alert(3)) [b](/courses/)');
	assert.deepEqual(findAll(hast, (n) => ['script', 'img'].includes(n.tagName)), [], 'raw HTML is dropped');
	// A minimal DOM, to see what toDom sets.
	const made = [];
	const doc = {
		createTextNode: (value) => ({ value }),
		createDocumentFragment: () => ({ children: [], append(...nodes) { this.children.push(...nodes); } }),
		createElement: (tag) => {
			const el = { tag, attributes: {}, children: [], setAttribute(name, value) { this.attributes[name] = value; }, append(...nodes) { this.children.push(...nodes); } };
			made.push(el);
			return el;
		},
	};
	toDom(hast, doc);
	toDom({ type: 'element', tagName: 'button', properties: { onClick: 'alert(4)', className: ['x'], dataQuizCheck: '' }, children: [] }, doc);
	const links = made.filter((el) => el.tag === 'a').map((el) => el.attributes.href ?? null);
	assert.deepEqual(links, [null, '/courses/']);
	const button = made.find((el) => el.tag === 'button');
	assert.deepEqual(button.attributes, { class: 'x', 'data-quiz-check': '' });
});

test("the admin editor's page loads nothing from the internet: its policy names only the site and GitLab", () => {
	const page = readFileSync(new URL('../cms/index.html', import.meta.url), 'utf8');
	const policy = page.match(/http-equiv="content-security-policy"\s+content="([^"]*)"/)[1];
	// Every source that isn't a keyword or scheme is the GitLab placeholder, filled in by prepare.mjs.
	const hosts = policy
		.split(';')
		.flatMap((directive) => directive.trim().split(/\s+/).slice(1))
		.filter((source) => !source.startsWith("'") && !/^(data|blob):$/.test(source));
	assert.deepEqual([...new Set(hosts)], ['${CMS_GITLAB_URL}'], 'fonts and scripts are self-hosted (scripts/prepare.mjs)');
});
